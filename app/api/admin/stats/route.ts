import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

// Set a timeout for the query
export const maxDuration = 10; // 10 seconds max

export async function GET(request: NextRequest) {
  try {
    // Check if user is admin
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      select: { email: true },
    });

    if (!user || user.email !== 'admin@yaw.com') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Use approximate counts for large tables, exact counts for small tables
    // reltuples returns -1 if table hasn't been analyzed, so we'll use exact count as fallback
    const [statsResult] = await prisma.$queryRaw<Array<{
      countries: bigint;
      firstNames: bigint;
      lastNames: bigint;
      cities: bigint;
      emailProviders: bigint;
      patternElements: bigint;
      patterns: bigint;
      savedEmails: bigint;
      emailGenerations: bigint;
      totalUsers: bigint;
    }>>`
      SELECT
        (SELECT CASE WHEN reltuples = -1 THEN (SELECT COUNT(*) FROM "Country") ELSE reltuples::bigint END FROM pg_class WHERE relname = 'Country') as countries,
        (SELECT reltuples::bigint FROM pg_class WHERE relname = 'FirstName') as "firstNames",
        (SELECT reltuples::bigint FROM pg_class WHERE relname = 'LastName') as "lastNames",
        (SELECT CASE WHEN reltuples = -1 THEN (SELECT COUNT(*) FROM "City") ELSE reltuples::bigint END FROM pg_class WHERE relname = 'City') as cities,
        (SELECT CASE WHEN reltuples = -1 THEN (SELECT COUNT(*) FROM "EmailProvider") ELSE reltuples::bigint END FROM pg_class WHERE relname = 'EmailProvider') as "emailProviders",
        (SELECT CASE WHEN reltuples = -1 THEN (SELECT COUNT(*) FROM "PatternElement") ELSE reltuples::bigint END FROM pg_class WHERE relname = 'PatternElement') as "patternElements",
        (SELECT CASE WHEN reltuples = -1 THEN (SELECT COUNT(*) FROM "Pattern") ELSE reltuples::bigint END FROM pg_class WHERE relname = 'Pattern') as patterns,
        (SELECT CASE WHEN reltuples = -1 THEN (SELECT COUNT(*) FROM "SavedEmail") ELSE reltuples::bigint END FROM pg_class WHERE relname = 'SavedEmail') as "savedEmails",
        (SELECT CASE WHEN reltuples = -1 THEN (SELECT COUNT(*) FROM "EmailGeneration") ELSE reltuples::bigint END FROM pg_class WHERE relname = 'EmailGeneration') as "emailGenerations",
        (SELECT COUNT(*)::bigint FROM "User") as "totalUsers"
    `;

    return NextResponse.json({
      stats: {
        countries: Math.max(Number(statsResult.countries || 0), 0),
        firstNames: Math.max(Number(statsResult.firstNames || 0), 0),
        lastNames: Math.max(Number(statsResult.lastNames || 0), 0),
        cities: Math.max(Number(statsResult.cities || 0), 0),
        emailProviders: Math.max(Number(statsResult.emailProviders || 0), 0),
        patternElements: Math.max(Number(statsResult.patternElements || 0), 0),
        patterns: Math.max(Number(statsResult.patterns || 0), 0),
        savedEmails: Math.max(Number(statsResult.savedEmails || 0), 0),
        emailGenerations: Math.max(Number(statsResult.emailGenerations || 0), 0),
        totalUsers: Math.max(Number(statsResult.totalUsers || 0), 0),
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
