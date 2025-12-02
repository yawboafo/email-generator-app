import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface LastNameRecord {
  name: string;
  countryCode: string;
  frequency?: number;
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
          const { name, countryCode, frequency = 1 } = record as LastNameRecord;

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
            await prisma.lastName.upsert({
              where: {
                name_countryId: {
                  name,
                  countryId: country.id,
                },
              },
              update: { frequency },
              create: {
                id: `${country.id}-${name}`,
                name,
                countryId: country.id,
                frequency,
                updatedAt: new Date(),
              },
            });
          } else {
            await prisma.lastName.create({
              data: {
                id: `${country.id}-${name}`,
                name,
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
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error('Error importing last names:', error);
    return NextResponse.json(
      { error: 'Failed to import last names', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
