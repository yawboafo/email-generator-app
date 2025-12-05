/**
 * Job-Based Email Generation API
 * POST /api/generate-emails-job - Create and start email generation job
 * This endpoint replaces the synchronous generate-emails for long-running operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createJob } from '@/lib/jobManager';
import { addJobToQueue } from '@/lib/queue';
import { validateRequest } from '@/lib/emailGeneratorDb';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';
import { getCurrentUser } from '@/lib/auth';
import type { GenerateEmailsRequest } from '@/types';

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

    // Check for duplicate pending/active jobs (deduplication)
    const prisma = (await import('@/lib/prisma')).default;
    const recentJob = await prisma.job.findFirst({
      where: {
        userId: currentUser.userId,
        type: 'generate-emails',
        status: {
          in: ['pending', 'active']
        },
        createdAt: {
          gte: new Date(Date.now() - 5000) // Within last 5 seconds
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (recentJob) {
      console.warn(`⚠️ Duplicate job creation blocked for user ${currentUser.userId}`);
      return NextResponse.json({
        success: true,
        jobId: recentJob.id,
        message: 'Using existing job (duplicate prevented)',
        streamUrl: `/api/jobs/${recentJob.id}/stream`,
        statusUrl: `/api/jobs/${recentJob.id}/status`,
        isDuplicate: true
      });
    }

    // Create job with userId
    const jobId = await createJob('generate-emails', {
      params: body,
      totalItems: body.count,
      processedItems: 0,
      successCount: 0,
      failureCount: 0,
      partialResults: [],
      lastProcessedIndex: 0,
    }, currentUser.userId);

    // Add job to queue for processing
    await addJobToQueue(jobId, 'generate-emails', {
      params: body,
      totalItems: body.count,
      processedItems: 0,
      successCount: 0,
      failureCount: 0,
      partialResults: [],
      lastProcessedIndex: 0,
    }, currentUser.userId);

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
