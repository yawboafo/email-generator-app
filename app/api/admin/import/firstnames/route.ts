import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface FirstNameRecord {
  name: string;
  gender: 'male' | 'female' | 'neutral';
  countryCode: string;
  frequency?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, mode = 'add' } = body; // mode: 'add' or 'replace'

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: 'Data must be a non-empty array' },
        { status: 400 }
      );
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Process in batches
    const batchSize = 1000;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);

      for (const record of batch) {
        try {
          const { name, gender, countryCode, frequency = 1 } = record as FirstNameRecord;

          if (!name || !gender || !countryCode) {
            errors.push(`Skipping invalid record: ${JSON.stringify(record)}`);
            skipped++;
            continue;
          }

          // Find country
          const country = await prisma.country.findUnique({
            where: { code: countryCode },
          });

          if (!country) {
            errors.push(`Country not found: ${countryCode}`);
            skipped++;
            continue;
          }

          // Import based on mode
          if (mode === 'replace') {
            await prisma.firstName.upsert({
              where: {
                name_countryId_gender: {
                  name,
                  countryId: country.id,
                  gender,
                },
              },
              update: { frequency },
              create: {
                id: `${country.id}-${name}-${gender}`,
                name,
                gender,
                countryId: country.id,
                frequency,
                updatedAt: new Date(),
              },
            });
          } else {
            // Add mode - only create if doesn't exist
            await prisma.firstName.create({
              data: {
                id: `${country.id}-${name}-${gender}`,
                name,
                gender,
                countryId: country.id,
                frequency,
                updatedAt: new Date(),
              },
            }).catch(() => {
              skipped++;
            });
          }

          imported++;
        } catch (err) {
          errors.push(`Error processing record: ${err instanceof Error ? err.message : 'Unknown error'}`);
          skipped++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors: errors.slice(0, 10), // Return first 10 errors
    });
  } catch (error) {
    console.error('Error importing first names:', error);
    return NextResponse.json(
      { error: 'Failed to import first names', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
