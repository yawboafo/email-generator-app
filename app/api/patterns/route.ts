import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const patterns = await prisma.pattern.findMany({
      where: { active: true },
      select: {
        name: true,
        template: true,
        description: true,
        category: true,
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });

    // Group patterns by category
    const grouped = patterns.reduce((acc, pattern) => {
      if (!acc[pattern.category]) {
        acc[pattern.category] = [];
      }
      acc[pattern.category].push(pattern);
      return acc;
    }, {} as Record<string, typeof patterns>);

    return NextResponse.json({ patterns, grouped });
  } catch (error) {
    console.error('Error fetching patterns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch patterns', patterns: [], grouped: {} },
      { status: 500 }
    );
  }
}
