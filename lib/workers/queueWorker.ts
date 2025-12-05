/**
 * Queue Worker
 * Processes jobs from the BullMQ queue
 */

import { Worker, WorkerOptions, Job as BullJob } from 'bullmq';
import { getRedisClient } from '../redis';
import { updateJobStatus, getJob } from '../jobManager';
import { executeGenerateEmailsJob } from './generateEmailsWorker';
import { executeVerifyEmailsJob } from './verifyEmailsWorker';
import { executeScrapeEmailsJob } from './scrapeEmailsWorker';
import type { JobData } from '../queue';
import type { JobType } from '../jobManager';

// Worker configuration
const workerOptions: WorkerOptions = {
  connection: getRedisClient(),
  concurrency: parseInt(process.env.JOB_CONCURRENCY || '3'), // Process 3 jobs concurrently
  limiter: {
    max: 10, // Max 10 jobs
    duration: 1000, // Per second
  },
};

let workers: Map<JobType, Worker<JobData>> = new Map();
let workerRestartAttempts = 0;
const MAX_RESTART_ATTEMPTS = 5;
const RESTART_DELAY_MS = 5000; // 5 seconds

/**
 * Process a job based on its type
 */
async function processJob(job: BullJob<JobData>): Promise<void> {
  const { jobId, type, metadata, userId } = job.data;

  console.log(`Processing job ${jobId} of type ${type}`);

  try {
    // Check if job was cancelled before starting
    const currentJob = await getJob(jobId);
    if (currentJob?.status === 'cancelled') {
      console.log(`Job ${jobId} was cancelled before processing started`);
      return; // Exit early, don't process cancelled jobs
    }

    // Update job status to running (if not already)
    await updateJobStatus(jobId, 'running');

    // Route to appropriate worker based on job type
    switch (type) {
      case 'generate-emails':
        await executeGenerateEmailsJob(jobId);
        break;

      case 'verify-emails':
        await executeVerifyEmailsJob(jobId);
        break;

      case 'scrape-emails':
        await executeScrapeEmailsJob(jobId);
        break;

      case 'generate-verified-emails':
        // This uses a different endpoint, handled separately
        // But we can add it here if needed
        throw new Error(`Job type ${type} should be handled by its own endpoint`);

      case 'find-emails':
      case 'ai-generate':
      case 'send-emails':
        // These can be added later
        throw new Error(`Job type ${type} not yet implemented in queue worker`);

      default:
        throw new Error(`Unknown job type: ${type}`);
    }

    // Check if job was cancelled during processing
    const finalJob = await getJob(jobId);
    if (finalJob?.status === 'cancelled') {
      console.log(`Job ${jobId} was cancelled during processing`);
      return; // Don't mark as completed if cancelled
    }

    console.log(`Job ${jobId} completed successfully`);
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    
    // Check if job was cancelled (might have been cancelled during error handling)
    const errorJob = await getJob(jobId);
    if (errorJob?.status === 'cancelled') {
      console.log(`Job ${jobId} was cancelled, not marking as failed`);
      return; // Don't mark as failed if it was cancelled
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateJobStatus(jobId, 'failed', errorMessage);
    throw error; // Re-throw to mark job as failed in queue
  }
}

/**
 * Create and start workers for all job types
 */
export function startWorkers(): void {
  if (workers.size > 0) {
    console.log('Workers already started');
    return;
  }

  // Create a single worker that processes all job types
  const worker = new Worker<JobData>(
    'email-jobs',
    async (job: BullJob<JobData>) => {
      return processJob(job);
    },
    workerOptions
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} (${job.data.type}) completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} (${job?.data.type}) failed:`, err);
  });

  worker.on('error', (err) => {
    console.error('❌ Worker error:', err);
    // Don't restart on every error - BullMQ handles retries
    // Only restart if worker completely crashes
  });

  worker.on('active', (job) => {
    console.log(`🔄 Job ${job.id} (${job.data.type}) started processing`);
  });

  worker.on('ready', () => {
    console.log('✅ Worker ready to process jobs');
    // Reset restart attempts on successful connection
    workerRestartAttempts = 0;
  });

  worker.on('stalled', (jobId) => {
    console.warn(`⚠️  Job ${jobId} stalled - will be retried`);
  });

  worker.on('closed', () => {
    console.log('⚠️  Worker closed unexpectedly');
    workers.delete('main' as JobType);
    
    // Auto-restart worker if it crashes
    if (workerRestartAttempts < MAX_RESTART_ATTEMPTS) {
      workerRestartAttempts++;
      console.log(`🔄 Attempting to restart worker (attempt ${workerRestartAttempts}/${MAX_RESTART_ATTEMPTS})...`);
      
      setTimeout(() => {
        try {
          startWorkers();
          console.log('✅ Worker restarted successfully');
        } catch (error) {
          console.error('❌ Failed to restart worker:', error);
          if (workerRestartAttempts >= MAX_RESTART_ATTEMPTS) {
            console.error('🛑 Max restart attempts reached. Manual intervention required.');
          }
        }
      }, RESTART_DELAY_MS);
    } else {
      console.error('🛑 Worker failed to restart after maximum attempts. Please restart the server.');
    }
  });

  // Store worker with a generic key
  workers.set('main' as JobType, worker);

  console.log('🎯 Worker initialized and listening for jobs');
}

/**
 * Stop all workers
 */
export async function stopWorkers(): Promise<void> {
  const promises = Array.from(workers.values()).map((worker) => worker.close());
  await Promise.all(promises);
  workers.clear();
  console.log('All workers stopped');
}

/**
 * Get worker status
 */
export function getWorkerStatus() {
  return {
    activeWorkers: workers.size,
    isRunning: workers.size > 0,
  };
}

