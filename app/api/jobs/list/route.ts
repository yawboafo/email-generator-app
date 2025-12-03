/**
 * Job List API
 * GET /api/jobs/list - List jobs with optional filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { listJobs, getJobStats, JobType, JobStatus } from '@/lib/jobManager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as JobType | null;
    const status = searchParams.get('status');
    const userId = searchParams.get('userId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const statsOnly = searchParams.get('stats') === 'true';

    // Return stats if requested
    if (statsOnly) {
      const stats = await getJobStats(userId);
      return NextResponse.json({
        success: true,
        stats,
      });
    }

    // Parse status filter (can be comma-separated)
    let statusFilter: JobStatus | JobStatus[] | undefined;
    if (status) {
      const statuses = status.split(',') as JobStatus[];
      statusFilter = statuses.length === 1 ? statuses[0] : statuses;
    }

    const jobs = await listJobs({
      type: type || undefined,
      status: statusFilter,
      userId,
      limit,
    });

    return NextResponse.json({
      success: true,
      jobs: jobs.map(job => ({
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        metadata: job.metadata,
        resultData: job.resultData,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt,
      })),
      count: jobs.length,
    });
  } catch (error) {
    console.error('Error listing jobs:', error);
    return NextResponse.json(
      { error: 'Failed to list jobs' },
      { status: 500 }
    );
  }
}
