import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface CountryRecord {
  code: string;
  name: string;
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

    for (const record of data) {
      try {
        const { code, name } = record as CountryRecord;

        if (!code || !name) {
          errors.push(`Skipping invalid record: ${JSON.stringify(record)}`);
          skipped++;
          continue;
        }

        if (mode === 'replace') {
          await prisma.country.upsert({
            where: { code },
            update: { name },
            create: { code, name },
          });
        } else {
          await prisma.country.create({
            data: { code, name },
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

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error('Error importing countries:', error);
    return NextResponse.json(
      { error: 'Failed to import countries', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
