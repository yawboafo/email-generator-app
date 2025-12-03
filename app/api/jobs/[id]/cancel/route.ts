/**
 * Job Cancel API
 * POST /api/jobs/[id]/cancel - Cancel a running job
 */

import { NextRequest, NextResponse } from 'next/server';
import { cancelJob, getJob } from '@/lib/jobManager';
import { getCurrentUser } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      );
    }

    const { id: jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Check job exists and verify ownership
    const job = await getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.userId !== currentUser.userId) {
      return NextResponse.json(
        { error: 'Forbidden - You do not have access to this job' },
        { status: 403 }
      );
    }

    await cancelJob(jobId);

    return NextResponse.json({
      success: true,
      message: 'Job cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling job:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to cancel job';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
