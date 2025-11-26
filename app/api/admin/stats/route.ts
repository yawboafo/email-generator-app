import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const stats = await Promise.all([
      prisma.country.count(),
      prisma.firstName.count(),
      prisma.lastName.count(),
      prisma.city.count(),
      prisma.emailProvider.count(),
      prisma.patternElement.count(),
      prisma.pattern.count(),
      prisma.savedEmail.count(),
      prisma.emailGeneration.count(),
      prisma.verifiedEmail.count(),
      prisma.verifiedEmail.count({ where: { status: 'valid' } }),
      prisma.verifiedEmail.count({ where: { status: 'risky' } }),
    ]);

    // Get sample data
    const countries = await prisma.country.findMany({
      select: { code: true, name: true, _count: { select: { firstNames: true, lastNames: true, cities: true } } },
    });

    return NextResponse.json({
      stats: {
        countries: stats[0],
        firstNames: stats[1],
        lastNames: stats[2],
        cities: stats[3],
        emailProviders: stats[4],
        patternElements: stats[5],
        patterns: stats[6],
        savedEmails: stats[7],
        emailGenerations: stats[8],
        verifiedEmails: stats[9],
        validEmails: stats[10],
        riskyEmails: stats[11],
      },
      countries,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch database stats' },
      { status: 500 }
    );
  }
}
