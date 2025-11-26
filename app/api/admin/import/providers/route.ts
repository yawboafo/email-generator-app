import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface ProviderRecord {
  providerId: string;
  name: string;
  domain: string;
  popularity?: number;
  active?: boolean;
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
        const { providerId, name, domain, popularity = 50, active = true } = record as ProviderRecord;

        if (!providerId || !name || !domain) {
          errors.push(`Skipping invalid record: ${JSON.stringify(record)}`);
          skipped++;
          continue;
        }

        if (mode === 'replace') {
          await prisma.emailProvider.upsert({
            where: { providerId },
            update: { name, domain, popularity, active },
            create: { providerId, name, domain, popularity, active },
          });
        } else {
          await prisma.emailProvider.create({
            data: { providerId, name, domain, popularity, active },
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
    console.error('Error importing providers:', error);
    return NextResponse.json(
      { error: 'Failed to import providers', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
