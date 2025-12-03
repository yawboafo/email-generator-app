/**
 * Job Management Hook
 * React hook for tracking and managing background jobs with persistence
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface JobStatus {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  metadata?: any;
  resultData?: any;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

interface UseJobOptions {
  onProgress?: (job: JobStatus) => void;
  onComplete?: (job: JobStatus) => void;
  onError?: (error: string) => void;
  autoStart?: boolean;
  persistKey?: string; // LocalStorage key for persistence
}

export function useJob(jobId: string | null, options: UseJobOptions = {}) {
  const [job, setJob] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const isCompletedRef = useRef(false);

  const {
    onProgress,
    onComplete,
    onError,
    autoStart = true,
    persistKey,
  } = options;

  // Save jobId to localStorage for persistence
  useEffect(() => {
    if (jobId && persistKey) {
      localStorage.setItem(persistKey, jobId);
    }
  }, [jobId, persistKey]);

  // Load jobId from localStorage on mount
  useEffect(() => {
    if (!jobId && persistKey) {
      const savedJobId = localStorage.getItem(persistKey);
      if (savedJobId) {
        // Fetch status to see if job is still relevant
        fetchJobStatus(savedJobId);
      }
    }
  }, []);

  // Fetch job status
  const fetchJobStatus = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/jobs/${id}/status`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch job status');
      }

      const data = await response.json();
      setJob(data.job);
      setError(null);
      return data.job;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch job';
      setError(errorMessage);
      onError?.(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [onError]);

  // Stream job progress
  const streamJob = useCallback((id: string) => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    isCompletedRef.current = false;
    const eventSource = new EventSource(`/api/jobs/${id}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
          console.log('Connected to job stream:', data.jobId);
        } else if (data.type === 'progress') {
          const updatedJob: JobStatus = {
            id: data.jobId,
            type: data.type,
            status: data.status,
            progress: data.progress,
            metadata: data.metadata,
            resultData: data.resultData,
            errorMessage: data.errorMessage,
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt,
            completedAt: data.completedAt,
          };

          setJob(updatedJob);
          onProgress?.(updatedJob);

          // Check if completed
          if (
            !isCompletedRef.current &&
            (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled')
          ) {
            isCompletedRef.current = true;
            onComplete?.(updatedJob);
            
            // Clean up localStorage on completion
            if (persistKey) {
              localStorage.removeItem(persistKey);
            }
          }
        } else if (data.type === 'complete') {
          eventSource.close();
        } else if (data.type === 'error') {
          setError(data.message);
          onError?.(data.message);
          eventSource.close();
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      eventSource.close();
      
      // Try to fetch final status
      if (!isCompletedRef.current) {
        fetchJobStatus(id);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [onProgress, onComplete, onError, persistKey, fetchJobStatus]);

  // Start streaming when jobId is available
  useEffect(() => {
    if (jobId && autoStart) {
      streamJob(jobId);
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [jobId, autoStart, streamJob]);

  // Cancel job
  const cancelJob = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/jobs/${id}/cancel`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to cancel job');
      }

      const data = await response.json();
      
      // Close stream
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Clear from localStorage
      if (persistKey) {
        localStorage.removeItem(persistKey);
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel job';
      setError(errorMessage);
      throw err;
    }
  }, [persistKey]);

  return {
    job,
    loading,
    error,
    fetchJobStatus,
    streamJob,
    cancelJob,
    isRunning: job?.status === 'running' || job?.status === 'pending',
    isCompleted: job?.status === 'completed',
    isFailed: job?.status === 'failed',
    isCancelled: job?.status === 'cancelled',
  };
}

/**
 * Hook for creating and tracking a new job
 */
export function useCreateJob(type: string, options: UseJobOptions = {}) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const jobState = useJob(jobId, options);

  const createJob = useCallback(async (params: any) => {
    try {
      setCreating(true);
      setCreateError(null);

      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          metadata: { params },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create job');
      }

      const data = await response.json();
      setJobId(data.jobId);
      
      return data.jobId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create job';
      setCreateError(errorMessage);
      throw err;
    } finally {
      setCreating(false);
    }
  }, [type]);

  return {
    ...jobState,
    createJob,
    creating,
    createError,
    jobId,
  };
}
