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
      prisma.savedEmail.count(),
      prisma.emailGeneration.count(),
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
        savedEmails: stats[6],
        emailGenerations: stats[7],
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
