import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface CityRecord {
  name: string;
  countryCode: string;
  population?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, mode = 'add' } = body;

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: 'Data must be a non-empty array' },
        { status: 400 }
      );
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    const batchSize = 1000;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);

      for (const record of batch) {
        try {
          const { name, countryCode, population } = record as CityRecord;

          if (!name || !countryCode) {
            errors.push(`Skipping invalid record: ${JSON.stringify(record)}`);
            skipped++;
            continue;
          }

          const country = await prisma.country.findUnique({
            where: { code: countryCode },
          });

          if (!country) {
            errors.push(`Country not found: ${countryCode}`);
            skipped++;
            continue;
          }

          if (mode === 'replace') {
            await prisma.city.upsert({
              where: {
                name_countryId: {
                  name,
                  countryId: country.id,
                },
              },
              update: { population },
              create: {
                name,
                countryId: country.id,
                population,
              },
            });
          } else {
            await prisma.city.create({
              data: {
                name,
                countryId: country.id,
                population,
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
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error('Error importing cities:', error);
    return NextResponse.json(
      { error: 'Failed to import cities', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
