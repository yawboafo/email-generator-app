/**
 * Job-Based Email Generation API
 * POST /api/generate-emails-job - Create and start email generation job
 * This endpoint replaces the synchronous generate-emails for long-running operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createJob } from '@/lib/jobManager';
import { executeGenerateEmailsJob } from '@/lib/workers/generateEmailsWorker';
import { validateRequest } from '@/lib/emailGeneratorDb';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';
import type { GenerateEmailsRequest } from '@/types';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(clientId, 100, 60 * 60 * 1000);

    if (!rateLimit.allowed) {
      const resetDate = new Date(rateLimit.resetTime);
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          resetTime: resetDate.toISOString()
        },
        { status: 429 }
      );
    }

    // Parse and validate request
    const body: GenerateEmailsRequest = await request.json();
    const validation = validateRequest(body);
    
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', errors: validation.errors },
        { status: 400 }
      );
    }

    // Create job
    const jobId = await createJob('generate-emails', {
      params: body,
      totalItems: body.count,
      processedItems: 0,
      successCount: 0,
      failureCount: 0,
      partialResults: [],
      lastProcessedIndex: 0,
    });

    // Start job execution in background (don't await)
    executeGenerateEmailsJob(jobId).catch(error => {
      console.error(`Background job ${jobId} error:`, error);
    });

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Email generation job started',
      streamUrl: `/api/jobs/${jobId}/stream`,
      statusUrl: `/api/jobs/${jobId}/status`,
    });
  } catch (error) {
    console.error('Error starting email generation job:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to start job';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
