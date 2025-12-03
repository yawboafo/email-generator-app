/**
 * Job Manager - Persistent Background Job System
 * Handles long-running tasks with resumability and progress tracking
 */

import prisma from './prisma';

export type JobType = 
  | 'generate-emails'
  | 'generate-verified-emails'
  | 'verify-emails'
  | 'scrape-emails'
  | 'find-emails'
  | 'ai-generate'
  | 'send-emails';

export type JobStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface JobMetadata {
  // Input parameters
  params?: any;
  
  // Progress tracking
  totalItems?: number;
  processedItems?: number;
  successCount?: number;
  failureCount?: number;
  
  // Intermediate results
  partialResults?: any[];
  
  // Resumability
  lastProcessedIndex?: number;
  checkpoint?: any;
  
  // Timestamps
  startedAt?: string;
  pausedAt?: string;
}

export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  stats?: {
    total: number;
    processed: number;
    successful: number;
    failed: number;
    duration: number;
  };
}

/**
 * Create a new job
 */
export async function createJob(
  type: JobType,
  metadata: JobMetadata,
  userId?: string
): Promise<string> {
  const job = await prisma.job.create({
    data: {
      type,
      status: 'pending',
      progress: 0,
      metadata: metadata as any,
      userId,
    },
  });

  return job.id;
}

/**
 * Update job progress
 */
export async function updateJobProgress(
  jobId: string,
  progress: number,
  metadata?: Partial<JobMetadata>
): Promise<void> {
  const currentJob = await prisma.job.findUnique({
    where: { id: jobId },
    select: { metadata: true },
  });

  await prisma.job.update({
    where: { id: jobId },
    data: {
      progress: Math.min(100, Math.max(0, progress)),
      metadata: metadata ? {
        ...(currentJob?.metadata as any || {}),
        ...metadata,
      } : undefined,
      updatedAt: new Date(),
    },
  });
}

/**
 * Update job status
 */
export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  errorMessage?: string
): Promise<void> {
  const data: any = {
    status,
    updatedAt: new Date(),
  };

  if (status === 'running') {
    const currentJob = await prisma.job.findUnique({
      where: { id: jobId },
      select: { metadata: true },
    });
    
    data.metadata = {
      ...(currentJob?.metadata as any || {}),
      startedAt: new Date().toISOString(),
    };
  }

  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    data.completedAt = new Date();
    if (status === 'completed') {
      data.progress = 100;
    }
  }

  if (errorMessage) {
    data.errorMessage = errorMessage;
  }

  await prisma.job.update({
    where: { id: jobId },
    data,
  });
}

/**
 * Save job result
 */
export async function saveJobResult(
  jobId: string,
  result: JobResult
): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      resultData: result as any,
      status: result.success ? 'completed' : 'failed',
      progress: result.success ? 100 : undefined,
      errorMessage: result.error,
      completedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

/**
 * Get job by ID
 */
export async function getJob(jobId: string) {
  return prisma.job.findUnique({
    where: { id: jobId },
  });
}

/**
 * Get job with typed metadata
 */
export async function getJobWithMetadata<T = JobMetadata>(jobId: string): Promise<{
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  metadata: T | null;
  resultData: any;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
} | null> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
  });

  if (!job) return null;

  return {
    ...job,
    status: job.status as JobStatus,
    metadata: job.metadata as T | null,
  };
}

/**
 * List jobs by type and/or status
 */
export async function listJobs(
  filters?: {
    type?: JobType;
    status?: JobStatus | JobStatus[];
    userId?: string;
    limit?: number;
  }
) {
  const where: any = {};

  if (filters?.type) {
    where.type = filters.type;
  }

  if (filters?.status) {
    where.status = Array.isArray(filters.status)
      ? { in: filters.status }
      : filters.status;
  }

  if (filters?.userId) {
    where.userId = filters.userId;
  }

  return prisma.job.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters?.limit || 50,
  });
}

/**
 * Cancel a running job
 */
export async function cancelJob(jobId: string): Promise<void> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  if (job.status === 'completed' || job.status === 'failed') {
    throw new Error('Cannot cancel completed or failed job');
  }

  await updateJobStatus(jobId, 'cancelled');
}

/**
 * Check if job can be resumed
 */
export async function canResumeJob(jobId: string): Promise<boolean> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
  });

  if (!job) return false;

  // Can resume if: pending, running (interrupted), or failed with checkpoint
  return (
    job.status === 'pending' ||
    job.status === 'running' ||
    (job.status === 'failed' && job.metadata && (job.metadata as any).checkpoint)
  );
}

/**
 * Clean up old completed jobs (older than specified days)
 */
export async function cleanupOldJobs(daysOld: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await prisma.job.deleteMany({
    where: {
      status: { in: ['completed', 'failed', 'cancelled'] },
      completedAt: {
        lt: cutoffDate,
      },
    },
  });

  return result.count;
}

/**
 * Get job statistics
 */
export async function getJobStats(userId?: string) {
  const where = userId ? { userId } : {};

  const [total, pending, running, completed, failed, cancelled] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.count({ where: { ...where, status: 'pending' } }),
    prisma.job.count({ where: { ...where, status: 'running' } }),
    prisma.job.count({ where: { ...where, status: 'completed' } }),
    prisma.job.count({ where: { ...where, status: 'failed' } }),
    prisma.job.count({ where: { ...where, status: 'cancelled' } }),
  ]);

  return {
    total,
    pending,
    running,
    completed,
    failed,
    cancelled,
  };
}

/**
 * Store checkpoint for resumability
 */
export async function saveCheckpoint(
  jobId: string,
  checkpoint: any
): Promise<void> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { metadata: true },
  });

  await prisma.job.update({
    where: { id: jobId },
    data: {
      metadata: {
        ...(job?.metadata as any || {}),
        checkpoint,
        lastCheckpointAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    },
  });
}
