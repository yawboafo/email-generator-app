/**
 * Jobs Dashboard API
 * Get all jobs for the current user with pagination and filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Get current user from authentication
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      );
    }

    const userId = currentUser.userId;

    const status = request.nextUrl.searchParams.get('status');
    const type = request.nextUrl.searchParams.get('type');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0');

    // Build filter
    const where: any = { userId };
    if (status) where.status = status;
    if (type) where.type = type;

    // Get jobs with pagination
    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          type: true,
          status: true,
          progress: true,
          metadata: true,
          resultData: true,
          errorMessage: true,
          createdAt: true,
          updatedAt: true,
          completedAt: true,
        },
      }),
      prisma.job.count({ where }),
    ]);

    // Get summary stats
    const stats = await prisma.job.groupBy({
      by: ['status'],
      where: { userId },
      _count: true,
    });

    const summary = {
      total,
      pending: stats.find(s => s.status === 'pending')?._count || 0,
      running: stats.find(s => s.status === 'running')?._count || 0,
      completed: stats.find(s => s.status === 'completed')?._count || 0,
      failed: stats.find(s => s.status === 'failed')?._count || 0,
      cancelled: stats.find(s => s.status === 'cancelled')?._count || 0,
    };

    return NextResponse.json({
      jobs,
      summary,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}
