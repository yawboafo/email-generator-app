import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Pool } from 'pg';
import copyFrom from 'pg-copy-streams';
import { Readable } from 'stream';
import pLimit from 'p-limit';
import { parse } from 'fast-csv';

const BATCH_SIZE = 10000; // Records per batch
const CONCURRENT_BATCHES = 4; // Process 4 batches in parallel
const STREAM_CHUNK_SIZE = 5000; // Process CSV in chunks of 5000 rows

// Country cache - loaded once per import session
let countryCache: Map<string, string> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Create a dedicated connection pool for COPY operations
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

/**
 * Load all countries into memory for fast lookups
 */
async function getCountryCache(): Promise<Map<string, string>> {
  const now = Date.now();
  
  if (countryCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return countryCache;
  }

  const countries = await prisma.country.findMany({
    select: { code: true, id: true },
  });

  countryCache = new Map(countries.map((c: { code: string; id: string }) => [c.code, c.id]));
  cacheTimestamp = now;
  
  console.log(`Country cache loaded: ${countryCache.size} countries`);
  return countryCache;
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

  if (records.length === 0) {
    return { imported, skipped, errors };
  }

  try {
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

      const firstNameKey = `${record.firstName}:${countryId}`;
      const lastNameKey = record.lastName ? `${record.lastName}:${countryId}` : null;

      if (record.firstName && !seenFirstNames.has(firstNameKey)) {
        firstNameRecords.push([
          record.firstName,
          record.gender,
          countryId,
        ]);
        seenFirstNames.add(firstNameKey);
      }

      if (record.lastName && lastNameKey && !seenLastNames.has(lastNameKey)) {
        lastNameRecords.push([
          record.lastName,
          countryId,
        ]);
        seenLastNames.add(lastNameKey);
      }
    }

    if (mode === 'replace') {
      // Replace mode: Use Prisma upsert
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
                id: `${countryId}-${record.firstName}-${record.gender}`,
                name: record.firstName,
                gender: record.gender,
                countryId: countryId,
                updatedAt: new Date(),
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
                id: `${countryId}-${record.lastName}`,
                name: record.lastName,
                countryId: countryId,
                updatedAt: new Date(),
              },
            });
          }
          imported++;
        } catch (error: any) {
          errors.push(`Failed to upsert: ${error.message}`);
        }
      }
    } else {
      // Add mode: Use COPY with temporary tables
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');

        // Insert first names
        if (firstNameRecords.length > 0) {
          await client.query(`
            CREATE TEMP TABLE temp_first_names (
              name TEXT,
              gender TEXT,
              "countryId" INTEGER
            ) ON COMMIT DROP
          `);

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
          await client.query(`
            CREATE TEMP TABLE temp_last_names (
              name TEXT,
              "countryId" INTEGER
            ) ON COMMIT DROP
          `);

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

/**
 * Parse and validate a single CSV row
 */
function parseRow(row: any): {
  firstName: string;
  lastName: string;
  gender: 'male' | 'female' | 'neutral';
  countryCode: string;
} | null {
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
        return null;
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
      return null;
    }

    let mappedGender: 'male' | 'female' | 'neutral' = 'neutral';
    if (gender === 'M' || gender === 'male') {
      mappedGender = 'male';
    } else if (gender === 'F' || gender === 'female') {
      mappedGender = 'female';
    }

    return {
      firstName: firstName.trim(),
      lastName: lastName ? lastName.trim() : '',
      gender: mappedGender,
      countryCode: countryCode.trim().toUpperCase(),
    };
  } catch (error) {
    return null;
  }
}

/**
 * Stream CSV file and process in chunks
 * This endpoint expects multipart/form-data with a file upload
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const mode = formData.get('mode') as string || 'add';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Load country cache once
    const countryMap = await getCountryCache();

    let totalImported = 0;
    let totalSkipped = 0;
    let totalProcessed = 0;
    const allErrors: string[] = [];
    
    // Buffer to accumulate records
    let recordBuffer: Array<{
      firstName: string;
      lastName: string;
      gender: 'male' | 'female' | 'neutral';
      countryCode: string;
    }> = [];

    // Parallel processing control
    const limit = pLimit(CONCURRENT_BATCHES);
    const batchPromises: Promise<any>[] = [];

    console.log(`Starting streaming import of file: ${file.name} (${file.size} bytes)`);

    // Convert file to stream and parse with fast-csv
    const fileBuffer = await file.arrayBuffer();
    const fileStream = Readable.from(Buffer.from(fileBuffer));

    return new Promise<NextResponse>((resolve) => {
      fileStream
        .pipe(parse({ headers: true, ignoreEmpty: true }))
        .on('data', (row) => {
          const parsed = parseRow(row);
          if (parsed) {
            recordBuffer.push(parsed);
            totalProcessed++;

            // When buffer reaches chunk size, process it
            if (recordBuffer.length >= STREAM_CHUNK_SIZE) {
              const batchToProcess = [...recordBuffer];
              recordBuffer = [];

              // Split into smaller batches and process in parallel
              const batches: typeof batchToProcess[] = [];
              for (let i = 0; i < batchToProcess.length; i += BATCH_SIZE) {
                batches.push(batchToProcess.slice(i, i + BATCH_SIZE));
              }

              for (const batch of batches) {
                const promise = limit(() => processBatch(batch, countryMap, mode))
                  .then(result => {
                    totalImported += result.imported;
                    totalSkipped += result.skipped;
                    allErrors.push(...result.errors);
                  });
                batchPromises.push(promise);
              }
            }
          } else {
            totalSkipped++;
          }
        })
        .on('end', async () => {
          // Process remaining records in buffer
          if (recordBuffer.length > 0) {
            const batches: typeof recordBuffer[] = [];
            for (let i = 0; i < recordBuffer.length; i += BATCH_SIZE) {
              batches.push(recordBuffer.slice(i, i + BATCH_SIZE));
            }

            for (const batch of batches) {
              const promise = limit(() => processBatch(batch, countryMap, mode))
                .then(result => {
                  totalImported += result.imported;
                  totalSkipped += result.skipped;
                  allErrors.push(...result.errors);
                });
              batchPromises.push(promise);
            }
          }

          // Wait for all batches to complete
          await Promise.all(batchPromises);

          const duration = Date.now() - startTime;
          const recordsPerSecond = Math.round((totalProcessed / duration) * 1000);

          console.log(`Streaming import complete: ${totalImported} imported, ${totalSkipped} skipped in ${duration}ms (${recordsPerSecond} records/sec)`);

          resolve(NextResponse.json({
            success: allErrors.length === 0 || totalImported > 0,
            imported: totalImported,
            skipped: totalSkipped,
            processed: totalProcessed,
            errors: allErrors.slice(0, 50),
            duration,
            recordsPerSecond,
            method: 'streaming',
          }));
        })
        .on('error', (error) => {
          console.error('Streaming parse error:', error);
          resolve(NextResponse.json(
            { error: error.message || 'Streaming parse failed' },
            { status: 500 }
          ));
        });
    });
  } catch (error: any) {
    console.error('Streaming import error:', error);
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}
