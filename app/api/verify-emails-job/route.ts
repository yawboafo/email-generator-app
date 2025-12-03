/**
 * Job-Based Email Verification API
 * POST /api/verify-emails-job - Create and start email verification job
 */

import { NextRequest, NextResponse } from 'next/server';
import { createJob } from '@/lib/jobManager';
import { executeVerifyEmailsJob } from '@/lib/workers/verifyEmailsWorker';
import { VerificationService } from '@/lib/emailVerification';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emails, service, apiKey } = body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: 'Emails array is required' },
        { status: 400 }
      );
    }

    if (emails.length > 10000) {
      return NextResponse.json(
        { error: 'Maximum 10,000 emails per job' },
        { status: 400 }
      );
    }

    // Validate service if provided
    const validServices: VerificationService[] = ['mailsso', 'emaillistverify', 'mailboxlayer', 'reacher'];
    if (service && !validServices.includes(service)) {
      return NextResponse.json(
        { error: 'Invalid verification service' },
        { status: 400 }
      );
    }

    // Create job
    const jobId = await createJob('verify-emails', {
      params: { emails, service, apiKey },
      totalItems: emails.length,
      processedItems: 0,
      successCount: 0,
      failureCount: 0,
      partialResults: [],
      lastProcessedIndex: 0,
    });

    // Start job execution in background
    executeVerifyEmailsJob(jobId).catch(error => {
      console.error(`Background job ${jobId} error:`, error);
    });

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Email verification job started',
      streamUrl: `/api/jobs/${jobId}/stream`,
      statusUrl: `/api/jobs/${jobId}/status`,
    });
  } catch (error) {
    console.error('Error starting verification job:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to start job';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
