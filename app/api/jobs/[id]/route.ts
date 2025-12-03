/**
 * Job Management API
 * DELETE /api/jobs/[id] - Delete a job
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Check if job exists
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Only allow deletion of completed, failed, or cancelled jobs
    if (job.status === 'running' || job.status === 'pending') {
      return NextResponse.json(
        { error: 'Cannot delete a running job. Please cancel it first.' },
        { status: 400 }
      );
    }

    // Delete the job
    await prisma.job.delete({
      where: { id: jobId },
    });

    return NextResponse.json({
      success: true,
      message: 'Job deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting job:', error);
    return NextResponse.json(
      { error: 'Failed to delete job' },
      { status: 500 }
    );
  }
}
