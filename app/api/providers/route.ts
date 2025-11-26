import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const providers = await prisma.emailProvider.findMany({
      where: { active: true },
      select: {
        providerId: true,
        name: true,
        domain: true,
        popularity: true,
      },
      orderBy: [
        { popularity: 'desc' },
        { name: 'asc' }
      ]
    });

    return NextResponse.json({ providers });
  } catch (error) {
    console.error('Error fetching providers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch providers', providers: [] },
      { status: 500 }
    );
  }
}
