/**
 * Job Management API
 * POST /api/jobs - Create a new job
 */

import { NextRequest, NextResponse } from 'next/server';
import { createJob, JobType, JobMetadata } from '@/lib/jobManager';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { type, metadata } = body;

    if (!type) {
      return NextResponse.json(
        { error: 'Job type is required' },
        { status: 400 }
      );
    }

    const validTypes: JobType[] = [
      'generate-emails',
      'generate-verified-emails',
      'verify-emails',
      'scrape-emails',
      'find-emails',
      'ai-generate',
      'send-emails',
    ];

    if (!validTypes.includes(type as JobType)) {
      return NextResponse.json(
        { error: 'Invalid job type' },
        { status: 400 }
      );
    }

    // Use authenticated user's ID
    const jobId = await createJob(
      type as JobType,
      metadata || {},
      currentUser.userId
    );

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Job created successfully',
    });
  } catch (error) {
    console.error('Error creating job:', error);
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    );
  }
}
