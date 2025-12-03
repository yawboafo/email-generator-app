import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Set a timeout for the query
export const maxDuration = 10; // 10 seconds max

export async function GET() {
  try {
    // Use raw SQL for faster counts on large tables
    const [
      countries,
      firstNames,
      lastNames,
      cities,
      emailProviders,
      patternElements,
      patterns,
      savedEmails,
      emailGenerations,
    ] = await Promise.all([
      prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM "Country"`,
      prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM "FirstName"`,
      prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM "LastName"`,
      prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM "City"`,
      prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM "EmailProvider"`,
      prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM "PatternElement"`,
      prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM "Pattern"`,
      prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM "SavedEmail"`,
      prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM "EmailGeneration"`,
    ]);

    return NextResponse.json({
      stats: {
        countries: Number(countries[0].count),
        firstNames: Number(firstNames[0].count),
        lastNames: Number(lastNames[0].count),
        cities: Number(cities[0].count),
        emailProviders: Number(emailProviders[0].count),
        patternElements: Number(patternElements[0].count),
        patterns: Number(patterns[0].count),
        savedEmails: Number(savedEmails[0].count),
        emailGenerations: Number(emailGenerations[0].count),
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch database stats' },
      { status: 500 }
    );
  }
}
