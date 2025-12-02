import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface PatternRecord {
  type: string; // 'petNames', 'cities', 'hobbies', etc.
  value: string;
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
        const { type, value } = record as PatternRecord;

        if (!type || !value) {
          errors.push(`Skipping invalid record: ${JSON.stringify(record)}`);
          skipped++;
          continue;
        }

        if (mode === 'replace') {
          await prisma.patternElement.upsert({
            where: {
              type_value: { type, value },
            },
            update: {},
            create: { id: `${type}-${value}`, type, value, updatedAt: new Date() },
          });
        } else {
          await prisma.patternElement.create({
            data: { id: `${type}-${value}`, type, value, updatedAt: new Date() },
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
    console.error('Error importing patterns:', error);
    return NextResponse.json(
      { error: 'Failed to import patterns', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
