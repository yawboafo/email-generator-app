/**
 * Job-Based Email Scraping API
 * POST /api/scrape-emails-job - Create and start email scraping job
 */

import { NextRequest, NextResponse } from 'next/server';
import { createJob } from '@/lib/jobManager';
import { executeScrapeEmailsJob } from '@/lib/workers/scrapeEmailsWorker';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domains, maxPagesPerDomain = 5 } = body;

    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return NextResponse.json(
        { error: 'Domains array is required' },
        { status: 400 }
      );
    }

    if (domains.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 domains per job' },
        { status: 400 }
      );
    }

    // Validate domains
    const validDomains = domains.filter(domain => {
      return typeof domain === 'string' && domain.length > 0;
    });

    if (validDomains.length === 0) {
      return NextResponse.json(
        { error: 'No valid domains provided' },
        { status: 400 }
      );
    }

    // Create job
    const jobId = await createJob('scrape-emails', {
      params: { domains: validDomains, maxPagesPerDomain },
      totalItems: validDomains.length,
      processedItems: 0,
      successCount: 0,
      failureCount: 0,
      partialResults: [],
      lastProcessedIndex: 0,
    });

    // Start job execution in background
    executeScrapeEmailsJob(jobId).catch(error => {
      console.error(`Background job ${jobId} error:`, error);
    });

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Email scraping job started',
      streamUrl: `/api/jobs/${jobId}/stream`,
      statusUrl: `/api/jobs/${jobId}/status`,
    });
  } catch (error) {
    console.error('Error starting scraping job:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to start job';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
