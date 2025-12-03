/**
 * Email Verification Worker
 * Handles background email verification jobs with deduplication and progress tracking
 */

import { 
  verifyEmailsBulk, 
  VerificationService,
  getCachedVerification 
} from '@/lib/emailVerification';
import { 
  updateJobStatus, 
  updateJobProgress, 
  saveJobResult, 
  saveCheckpoint,
  getJobWithMetadata 
} from '@/lib/jobManager';

interface VerifyEmailsJobMetadata {
  params: {
    emails: string[];
    service?: VerificationService;
    apiKey?: string;
  };
  totalItems: number;
  processedItems: number;
  successCount: number;
  failureCount: number;
  partialResults: Array<{
    email: string;
    status: string;
    isValid: boolean;
    fromCache: boolean;
  }>;
  lastProcessedIndex: number;
  checkpoint?: {
    processedEmails: string[];
    results: any[];
  };
}

const BATCH_SIZE = 50; // Verify 50 emails at a time (matches Mails.so bulk limit)

/**
 * Execute email verification job with deduplication
 */
export async function executeVerifyEmailsJob(jobId: string): Promise<void> {
  try {
    // Mark job as running
    await updateJobStatus(jobId, 'running');

    // Get job with metadata
    const job = await getJobWithMetadata<VerifyEmailsJobMetadata>(jobId);
    
    if (!job || !job.metadata) {
      throw new Error('Job not found or missing metadata');
    }

    const { emails, service, apiKey } = job.metadata.params;
    const checkpoint = job.metadata.checkpoint;
    
    // Resume from checkpoint if exists
    const processedEmails = new Set(checkpoint?.processedEmails || []);
    let allResults = checkpoint?.results || [];

    // Filter out already processed emails
    const remainingEmails = emails.filter(email => !processedEmails.has(email));

    // Split into batches
    const batches: string[][] = [];
    for (let i = 0; i < remainingEmails.length; i += BATCH_SIZE) {
      batches.push(remainingEmails.slice(i, i + BATCH_SIZE));
    }

    const totalBatches = batches.length;
    let processedBatches = 0;

    // Process each batch
    for (const batch of batches) {
      // Check if job was cancelled
      const currentJob = await getJobWithMetadata(jobId);
      if (currentJob?.status === 'cancelled') {
        console.log(`Job ${jobId} was cancelled`);
        return;
      }

      try {
        // Check cache first for each email
        const uncachedEmails: string[] = [];
        const cachedResults: any[] = [];

        for (const email of batch) {
          const cached = await getCachedVerification(email);
          if (cached) {
            cachedResults.push(cached);
            processedEmails.add(email);
          } else {
            uncachedEmails.push(email);
          }
        }

        // Verify uncached emails
        let batchResults: any[] = cachedResults;
        
        if (uncachedEmails.length > 0) {
          const verificationResults = await verifyEmailsBulk(
            uncachedEmails,
            service,
            apiKey
          );

          batchResults = [...batchResults, ...verificationResults.results];
          
          // Mark as processed
          uncachedEmails.forEach(email => processedEmails.add(email));
        }

        allResults = allResults.concat(batchResults);
        processedBatches++;

        // Update progress
        const progress = Math.floor((processedEmails.size / emails.length) * 100);
        await updateJobProgress(jobId, progress, {
          processedItems: processedEmails.size,
          successCount: allResults.filter(r => r.isValid).length,
          failureCount: allResults.filter(r => !r.isValid).length,
          partialResults: allResults.slice(-100), // Keep last 100 for preview
        });

        // Save checkpoint every batch
        await saveCheckpoint(jobId, {
          processedEmails: Array.from(processedEmails),
          results: allResults,
        });

        // Add small delay between batches to avoid rate limits
        if (processedBatches < totalBatches) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (batchError) {
        console.error(`Error verifying batch:`, batchError);
        
        // Continue with next batch on error
        await updateJobProgress(jobId, Math.floor((processedBatches / totalBatches) * 100), {
          failureCount: (job.metadata.failureCount || 0) + batch.length,
        });
      }
    }

    // Categorize results
    const valid = allResults.filter(r => r.status === 'valid');
    const risky = allResults.filter(r => r.status === 'risky');
    const invalid = allResults.filter(r => r.status === 'invalid');
    const unknown = allResults.filter(r => r.status === 'unknown');

    // Save final result
    await saveJobResult(jobId, {
      success: true,
      data: {
        results: allResults,
        summary: {
          total: emails.length,
          valid: valid.length,
          risky: risky.length,
          invalid: invalid.length,
          unknown: unknown.length,
          cached: allResults.filter(r => r.fromCache).length,
          verified: allResults.filter(r => !r.fromCache).length,
        },
      },
      stats: {
        total: emails.length,
        processed: allResults.length,
        successful: valid.length + risky.length,
        failed: invalid.length,
        duration: Date.now() - new Date(job.createdAt).getTime(),
      },
    });

    console.log(`Job ${jobId} completed. Verified ${allResults.length} emails.`);
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await updateJobStatus(jobId, 'failed', errorMessage);
    await saveJobResult(jobId, {
      success: false,
      error: errorMessage,
    });
  }
}
