/**
 * Job Management API
 * POST /api/jobs - Create a new job
 */

import { NextRequest, NextResponse } from 'next/server';
import { createJob, JobType, JobMetadata } from '@/lib/jobManager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, metadata, userId } = body;

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

    const jobId = await createJob(
      type as JobType,
      metadata || {},
      userId
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
