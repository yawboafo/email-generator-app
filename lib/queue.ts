/**
 * Job Queue Manager
 * BullMQ-based job queue system
 */

import { Queue, QueueOptions } from 'bullmq';
import { getRedisClient } from './redis';
import type { JobType } from './jobManager';

export interface JobData {
  jobId: string;
  type: JobType;
  metadata: any;
  userId: string;
}

// Queue configuration
const queueOptions: QueueOptions = {
  connection: getRedisClient(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep max 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
};

// Main job queue
let jobQueue: Queue<JobData> | null = null;

export function getJobQueue(): Queue<JobData> {
  if (jobQueue) {
    return jobQueue;
  }

  jobQueue = new Queue<JobData>('email-jobs', queueOptions);

  return jobQueue;
}

/**
 * Add a job to the queue
 */
export async function addJobToQueue(
  jobId: string,
  type: JobType,
  metadata: any,
  userId: string
): Promise<void> {
  const queue = getJobQueue();
  
  await queue.add(
    type,
    {
      jobId,
      type,
      metadata,
      userId,
    },
    {
      jobId, // Use the database job ID as the queue job ID
    }
  );
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const queue = getJobQueue();
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
}

/**
 * Remove a job from the queue (for cancellation)
 * Handles both waiting and active jobs
 */
export async function removeJobFromQueue(jobId: string): Promise<void> {
  const queue = getJobQueue();
  const job = await queue.getJob(jobId);
  
  if (!job) {
    return; // Job not in queue (might already be processed)
  }

  const state = await job.getState();
  console.log(`🗑️  Removing job ${jobId} from queue (state: ${state})`);
  
  if (state === 'waiting' || state === 'delayed') {
    // Remove waiting/delayed jobs from queue
    await job.remove();
    console.log(`✅ Job ${jobId} removed from queue`);
  } else if (state === 'active') {
    // For active jobs, we can't force stop them, but we can mark them
    // The worker will check the database status and stop itself
    // Try to move it to failed state
    try {
      await job.moveToFailed(new Error('Job cancelled by user'), '0', true);
      console.log(`✅ Active job ${jobId} marked as failed (cancelled)`);
    } catch (error) {
      // Job might complete before we can move it - that's okay
      console.log(`⚠️  Could not move active job ${jobId} to failed:`, error);
      // Try to just remove it
      try {
        await job.remove();
        console.log(`✅ Job ${jobId} forcefully removed`);
      } catch (removeError) {
        console.log(`⚠️  Could not remove job ${jobId}:`, removeError);
      }
    }
  } else if (state === 'completed' || state === 'failed') {
    // Remove completed/failed jobs
    try {
      await job.remove();
      console.log(`✅ ${state} job ${jobId} removed from queue`);
    } catch (error) {
      console.log(`⚠️  Could not remove ${state} job ${jobId}:`, error);
    }
  }
}

/**
 * Close queue connection
 */
export async function closeQueue(): Promise<void> {
  if (jobQueue) {
    await jobQueue.close();
    jobQueue = null;
  }
}

