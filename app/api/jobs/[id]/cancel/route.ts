/**
 * Job Cancel API
 * POST /api/jobs/[id]/cancel - Cancel a running job
 */

import { NextRequest, NextResponse } from 'next/server';
import { cancelJob } from '@/lib/jobManager';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
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
