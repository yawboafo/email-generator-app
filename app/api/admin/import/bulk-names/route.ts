import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const BATCH_SIZE = 5000; // Process 5000 records at a time

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, mode, batch, totalRecords } = body;

    if (!data || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    const currentBatch = batch || 0;
    const total = totalRecords || data.length;

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Validate and prepare data
    const validRecords: {
      firstName: string;
      lastName: string;
      gender: 'male' | 'female' | 'neutral';
      countryCode: string;
    }[] = [];

    for (const row of data) {
      try {
        // Expected format: first_name,last_name,gender,country_code
        // Handle both object format (with headers) and array format (positional)
        let firstName: string = '';
        let lastName: string = '';
        let gender: string = '';
        let countryCode: string = '';

        if (Array.isArray(row)) {
          // Array format: [first_name, last_name, gender, country_code]
          firstName = row[0] || '';
          lastName = row[1] || '';
          gender = row[2] || '';
          countryCode = row[3] || '';
        } else {
          // Object format: try different possible header names
          const keys = Object.keys(row);
          const values = Object.values(row);
          
          // Skip if all values are empty or this looks like a header row
          const allEmpty = values.every(v => !v || String(v).trim() === '');
          if (allEmpty) {
            skipped++;
            continue;
          }
          
          // If headers are not standard, use positional based on order
          if (keys.length >= 4 && !keys.some(k => k.includes('first') || k.includes('name'))) {
            firstName = String(values[0] || '').trim();
            lastName = String(values[1] || '').trim();
            gender = String(values[2] || '').trim();
            countryCode = String(values[3] || '').trim();
          } else {
            // Try standard header names
            firstName = (row.first_name || row.firstName || row.name || row[keys[0]] || '').toString().trim();
            lastName = (row.last_name || row.lastName || row.surname || row[keys[1]] || '').toString().trim();
            gender = (row.gender || row[keys[2]] || '').toString().trim();
            countryCode = (row.country_code || row.countryCode || row.code || row[keys[3]] || '').toString().trim();
          }
        }

        // Skip empty rows
        if (!firstName || !countryCode) {
          // Only log if this seems like a real row with some data
          const hasAnyData = firstName || lastName || gender || countryCode;
          if (hasAnyData && !(firstName === 'first_name' && countryCode === 'country_code')) {
            // Skip logging if it looks like a header row
            errors.push(`Row skipped - missing required: first_name="${firstName}", country_code="${countryCode}"`);
          }
          skipped++;
          continue;
        }

        // Map gender: M -> male, F -> female, empty -> neutral
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
        errors.push(`Invalid record: ${JSON.stringify(row)}`);
      }
    }

    // Get unique country codes
    const countryCodes = [...new Set(validRecords.map(r => r.countryCode))];

    // Verify all countries exist
    const existingCountries = await prisma.country.findMany({
      where: { code: { in: countryCodes } },
      select: { code: true, id: true },
    });

    const existingCountryCodes = new Set(existingCountries.map((c: { code: string; id: string }) => c.code));
    const countryIdMap = new Map(existingCountries.map((c: { code: string; id: string }) => [c.code, c.id]));

    // Filter out records with non-existent countries
    const recordsToImport = validRecords.filter(r => {
      if (!existingCountryCodes.has(r.countryCode)) {
        errors.push(`Country ${r.countryCode} not found for name: ${r.firstName} ${r.lastName}`);
        return false;
      }
      return true;
    });

    if (mode === 'replace') {
      // Replace mode: Use upsert for each record
      for (const record of recordsToImport) {
        try {
          const countryId = countryIdMap.get(record.countryCode);
          if (!countryId) continue;

          // Import first name
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

          // Import last name if present
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
          if (error.code === 'P2002') {
            skipped++;
          } else {
            errors.push(`Failed to import ${record.firstName} ${record.lastName}: ${error.message}`);
          }
        }
      }
    } else {
      // Add mode: Skip duplicates using createMany with skipDuplicates
      const firstNamesToCreate = recordsToImport
        .filter(r => r.firstName)
        .map(r => {
          const countryId = countryIdMap.get(r.countryCode);
          if (!countryId) {
            errors.push(`Missing countryId for country code: ${r.countryCode}`);
          }
          return {
            id: `${countryId}-${r.firstName}-${r.gender}`,
            name: r.firstName,
            gender: r.gender,
            countryId: countryId!,
            updatedAt: new Date(),
          };
        });

      const lastNamesToCreate = recordsToImport
        .filter(r => r.lastName)
        .map(r => {
          const countryId = countryIdMap.get(r.countryCode);
          if (!countryId) {
            errors.push(`Missing countryId for country code: ${r.countryCode}`);
          }
          return {
            id: `${countryId}-${r.lastName}`,
            name: r.lastName,
            countryId: countryId!,
            updatedAt: new Date(),
          };
        });

      try {
        // Import first names in smaller batches
        for (let i = 0; i < firstNamesToCreate.length; i += 1000) {
          const batch = firstNamesToCreate.slice(i, i + 1000);
          try {
            // Validate batch data types before insertion
            const invalidRecords = batch.filter(r => typeof r.countryId !== 'string' || !r.countryId);
            if (invalidRecords.length > 0) {
              errors.push(`Invalid countryId types found: ${JSON.stringify(invalidRecords.slice(0, 3))}`);
              continue; // Skip this batch
            }
            
            const result = await prisma.firstName.createMany({
              data: batch,
              skipDuplicates: true,
            });
            imported += result.count;
          } catch (batchError: any) {
            errors.push(`FirstName batch ${i}-${i + 1000} failed: ${batchError.message}`);
            // Log first record in batch for debugging
            if (batch.length > 0) {
              const sample = batch[0];
              errors.push(`Sample record - name: ${sample.name}, gender: ${sample.gender}, countryId: ${sample.countryId} (type: ${typeof sample.countryId})`);
            }
          }
        }

        // Import last names in smaller batches
        for (let i = 0; i < lastNamesToCreate.length; i += 1000) {
          const batch = lastNamesToCreate.slice(i, i + 1000);
          try {
            // Validate batch data types before insertion
            const invalidRecords = batch.filter(r => typeof r.countryId !== 'string' || !r.countryId);
            if (invalidRecords.length > 0) {
              errors.push(`Invalid countryId types found in LastName: ${JSON.stringify(invalidRecords.slice(0, 3))}`);
              continue; // Skip this batch
            }
            
            const result = await prisma.lastName.createMany({
              data: batch,
              skipDuplicates: true,
            });
            imported += result.count;
          } catch (batchError: any) {
            errors.push(`LastName batch ${i}-${i + 1000} failed: ${batchError.message}`);
            // Log first record in batch for debugging
            if (batch.length > 0) {
              const sample = batch[0];
              errors.push(`Sample record - name: ${sample.name}, countryId: ${sample.countryId} (type: ${typeof sample.countryId})`);
            }
          }
        }

        skipped = recordsToImport.length - imported;
      } catch (error: any) {
        errors.push(`Batch import failed: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: errors.length === 0 || imported > 0,
      imported,
      skipped,
      errors: errors.slice(0, 50), // Return first 50 errors
      batch: currentBatch,
      processed: data.length,
    });
  } catch (error: any) {
    console.error('Bulk import error:', error);
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}
