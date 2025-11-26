import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Pool } from 'pg';
import copyFrom from 'pg-copy-streams';
import { Readable } from 'stream';
import pLimit from 'p-limit';

const BATCH_SIZE = 10000; // Larger batch size for better performance
const CONCURRENT_BATCHES = 4; // Process 4 batches in parallel

// Country cache - loaded once per import session
let countryCache: Map<string, string> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Create a dedicated connection pool for COPY operations
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Allow multiple connections for parallel batches
});

/**
 * Load all countries into memory for fast lookups
 */
async function getCountryCache(): Promise<Map<string, string>> {
  const now = Date.now();
  
  // Return cached data if still fresh
  if (countryCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return countryCache;
  }

  // Reload country cache
  const countries = await prisma.country.findMany({
    select: { code: true, id: true },
  });

  countryCache = new Map(countries.map((c: { code: string; id: string }) => [c.code, c.id]));
  cacheTimestamp = now;
  
  console.log(`Country cache loaded: ${countryCache.size} countries`);
  return countryCache;
}

/**
 * Use PostgreSQL COPY command for ultra-fast bulk insert
 * This bypasses Prisma and writes directly to the database
 */
async function bulkInsertWithCopy(
  tableName: string,
  columns: string[],
  records: any[][]
): Promise<number> {
  if (records.length === 0) return 0;

  const client = await pool.connect();
  
  try {
    // Create COPY command
    const copyCommand = `COPY "${tableName}" (${columns.map(c => `"${c}"`).join(',')}) FROM STDIN WITH (FORMAT csv)`;
    
    // Convert records to CSV format
    const csvData = records
      .map(record => 
        record.map(value => {
          if (value === null || value === undefined) return '';
          const str = String(value);
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',')
      )
      .join('\n') + '\n';

    // Create a readable stream from the CSV data
    const stream = Readable.from([csvData]);
    const copyStream = client.query(copyFrom.from(copyCommand));

    // Pipe the data through COPY
    await new Promise((resolve, reject) => {
      stream.pipe(copyStream)
        .on('finish', resolve)
        .on('error', reject);
    });

    return records.length;
  } finally {
    client.release();
  }
}

/**
 * Process a batch of records and insert using COPY
 */
async function processBatch(
  records: Array<{
    firstName: string;
    lastName: string;
    gender: 'male' | 'female' | 'neutral';
    countryCode: string;
  }>,
  countryMap: Map<string, string>,
  mode: string
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    // Prepare data for bulk insert
    const firstNameRecords: any[][] = [];
    const lastNameRecords: any[][] = [];
    const seenFirstNames = new Set<string>();
    const seenLastNames = new Set<string>();

    for (const record of records) {
      const countryId = countryMap.get(record.countryCode);
      
      if (!countryId) {
        errors.push(`Country ${record.countryCode} not found`);
        skipped++;
        continue;
      }

      // Create unique key for deduplication within batch
      const firstNameKey = `${record.firstName}:${countryId}`;
      const lastNameKey = record.lastName ? `${record.lastName}:${countryId}` : null;

      // Add first name (deduplicate within batch)
      if (record.firstName && !seenFirstNames.has(firstNameKey)) {
        firstNameRecords.push([
          record.firstName,
          record.gender,
          countryId,
        ]);
        seenFirstNames.add(firstNameKey);
      }

      // Add last name (deduplicate within batch)
      if (record.lastName && lastNameKey && !seenLastNames.has(lastNameKey)) {
        lastNameRecords.push([
          record.lastName,
          countryId,
        ]);
        seenLastNames.add(lastNameKey);
      }
    }

    if (mode === 'replace') {
      // For replace mode, we need to use upsert logic
      // This is slower but necessary for updates
      // Note: COPY doesn't support ON CONFLICT, so we fall back to Prisma
      for (const record of records) {
        const countryId = countryMap.get(record.countryCode);
        if (!countryId) continue;

        try {
          if (record.firstName) {
            await prisma.firstName.upsert({
              where: {
                name_countryId_gender: {
                  name: record.firstName,
                  countryId: countryId,
                  gender: record.gender,
                },
              },
              update: {},
              create: {
                name: record.firstName,
                gender: record.gender,
                countryId: countryId,
              },
            });
          }

          if (record.lastName) {
            await prisma.lastName.upsert({
              where: {
                name_countryId: {
                  name: record.lastName,
                  countryId: countryId,
                },
              },
              update: {},
              create: {
                name: record.lastName,
                countryId: countryId,
              },
            });
          }
          imported++;
        } catch (error: any) {
          errors.push(`Failed to upsert: ${error.message}`);
        }
      }
    } else {
      // Add mode: Use COPY with ON CONFLICT DO NOTHING via raw SQL
      // This is the fastest approach for bulk inserts
      
      // Use temporary table approach for ON CONFLICT support with COPY
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');

        // Insert first names
        if (firstNameRecords.length > 0) {
          // Create temp table
          await client.query(`
            CREATE TEMP TABLE temp_first_names (
              name TEXT,
              gender TEXT,
              "countryId" INTEGER
            ) ON COMMIT DROP
          `);

          // COPY into temp table
          const copyCommand = `COPY temp_first_names (name, gender, "countryId") FROM STDIN WITH (FORMAT csv)`;
          const csvData = firstNameRecords
            .map(record => record.map(v => String(v)).join(','))
            .join('\n') + '\n';
          
          const stream = Readable.from([csvData]);
          const copyStream = client.query(copyFrom.from(copyCommand));
          
          await new Promise((resolve, reject) => {
            stream.pipe(copyStream)
              .on('finish', resolve)
              .on('error', reject);
          });

          // Insert from temp table with ON CONFLICT DO NOTHING
          const result = await client.query(`
            INSERT INTO "FirstName" (name, gender, "countryId")
            SELECT name, gender::"Gender", "countryId"
            FROM temp_first_names
            ON CONFLICT (name, "countryId") DO NOTHING
          `);
          
          imported += result.rowCount || 0;
        }

        // Insert last names
        if (lastNameRecords.length > 0) {
          // Create temp table
          await client.query(`
            CREATE TEMP TABLE temp_last_names (
              name TEXT,
              "countryId" INTEGER
            ) ON COMMIT DROP
          `);

          // COPY into temp table
          const copyCommand = `COPY temp_last_names (name, "countryId") FROM STDIN WITH (FORMAT csv)`;
          const csvData = lastNameRecords
            .map(record => record.map(v => String(v)).join(','))
            .join('\n') + '\n';
          
          const stream = Readable.from([csvData]);
          const copyStream = client.query(copyFrom.from(copyCommand));
          
          await new Promise((resolve, reject) => {
            stream.pipe(copyStream)
              .on('finish', resolve)
              .on('error', reject);
          });

          // Insert from temp table with ON CONFLICT DO NOTHING
          const result = await client.query(`
            INSERT INTO "LastName" (name, "countryId")
            SELECT name, "countryId"
            FROM temp_last_names
            ON CONFLICT (name, "countryId") DO NOTHING
          `);
          
          imported += result.rowCount || 0;
        }

        await client.query('COMMIT');
        
        skipped = records.length - imported;
      } catch (error: any) {
        await client.query('ROLLBACK');
        errors.push(`Batch insert failed: ${error.message}`);
        throw error;
      } finally {
        client.release();
      }
    }

    return { imported, skipped, errors };
  } catch (error: any) {
    return { imported, skipped, errors: [...errors, error.message] };
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { data, mode, batch, totalRecords } = body;

    if (!data || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    const currentBatch = batch || 0;
    const total = totalRecords || data.length;

    let totalImported = 0;
    let totalSkipped = 0;
    const allErrors: string[] = [];

    // Load country cache once
    const countryMap = await getCountryCache();

    // Validate and prepare data
    const validRecords: Array<{
      firstName: string;
      lastName: string;
      gender: 'male' | 'female' | 'neutral';
      countryCode: string;
    }> = [];

    for (const row of data) {
      try {
        let firstName: string = '';
        let lastName: string = '';
        let gender: string = '';
        let countryCode: string = '';

        if (Array.isArray(row)) {
          firstName = row[0] || '';
          lastName = row[1] || '';
          gender = row[2] || '';
          countryCode = row[3] || '';
        } else {
          const keys = Object.keys(row);
          const values = Object.values(row);
          
          const allEmpty = values.every(v => !v || String(v).trim() === '');
          if (allEmpty) {
            totalSkipped++;
            continue;
          }
          
          if (keys.length >= 4 && !keys.some(k => k.includes('first') || k.includes('name'))) {
            firstName = String(values[0] || '').trim();
            lastName = String(values[1] || '').trim();
            gender = String(values[2] || '').trim();
            countryCode = String(values[3] || '').trim();
          } else {
            firstName = (row.first_name || row.firstName || row.name || row[keys[0]] || '').toString().trim();
            lastName = (row.last_name || row.lastName || row.surname || row[keys[1]] || '').toString().trim();
            gender = (row.gender || row[keys[2]] || '').toString().trim();
            countryCode = (row.country_code || row.countryCode || row.code || row[keys[3]] || '').toString().trim();
          }
        }

        if (!firstName || !countryCode) {
          if (firstName || lastName || gender || countryCode) {
            allErrors.push(`Missing required fields: first_name="${firstName}", country_code="${countryCode}"`);
          }
          totalSkipped++;
          continue;
        }

        let mappedGender: 'male' | 'female' | 'neutral' = 'neutral';
        if (gender === 'M' || gender === 'male') {
          mappedGender = 'male';
        } else if (gender === 'F' || gender === 'female') {
          mappedGender = 'female';
        }

        validRecords.push({
          firstName: firstName.trim(),
          lastName: lastName ? lastName.trim() : '',
          gender: mappedGender,
          countryCode: countryCode.trim().toUpperCase(),
        });
      } catch (error) {
        allErrors.push(`Invalid record: ${JSON.stringify(row)}`);
      }
    }

    // Split records into batches and process in parallel
    const batches: typeof validRecords[] = [];
    for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
      batches.push(validRecords.slice(i, i + BATCH_SIZE));
    }

    console.log(`Processing ${validRecords.length} records in ${batches.length} batches with ${CONCURRENT_BATCHES} concurrent workers`);

    // Process batches in parallel with concurrency limit
    const limit = pLimit(CONCURRENT_BATCHES);
    const batchPromises = batches.map((batch, index) => 
      limit(() => {
        console.log(`Processing batch ${index + 1}/${batches.length} (${batch.length} records)`);
        return processBatch(batch, countryMap, mode || 'add');
      })
    );

    const results = await Promise.all(batchPromises);

    // Aggregate results
    for (const result of results) {
      totalImported += result.imported;
      totalSkipped += result.skipped;
      allErrors.push(...result.errors);
    }

    const duration = Date.now() - startTime;
    const recordsPerSecond = Math.round((validRecords.length / duration) * 1000);

    console.log(`Import complete: ${totalImported} imported, ${totalSkipped} skipped in ${duration}ms (${recordsPerSecond} records/sec)`);

    return NextResponse.json({
      success: allErrors.length === 0 || totalImported > 0,
      imported: totalImported,
      skipped: totalSkipped,
      errors: allErrors.slice(0, 50),
      batch: currentBatch,
      processed: data.length,
      duration,
      recordsPerSecond,
    });
  } catch (error: any) {
    console.error('Fast bulk import error:', error);
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}
