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

  // Fetch job status
  const fetchJobStatus = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/jobs/${id}/status`);
      
      // If 401 or 403, the job doesn't belong to current user or user not authenticated - clear it
      if (response.status === 401 || response.status === 403) {
        if (persistKey) {
          localStorage.removeItem(persistKey);
        }
        setJob(null);
        setError(null); // Don't show error for stale jobs
        return null;
      }
      
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
  }, [onError, persistKey]);

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
        fetchJobStatus(savedJobId).then((job) => {
          // If job not accessible or completed, clear from localStorage
          if (!job || job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
            localStorage.removeItem(persistKey);
          }
        });
      }
    }
  }, [jobId, persistKey, fetchJobStatus]);

  // Stream job progress
  const streamJob = useCallback((id: string) => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    isCompletedRef.current = false;
    
    let cancelled = false;
    
    // Check if job is accessible before streaming
    fetchJobStatus(id).then((job) => {
      // Check if cancelled while fetching
      if (cancelled || isCompletedRef.current) {
        return;
      }
      
      if (!job) {
        // Job not accessible or doesn't exist - stop completely
        isCompletedRef.current = true;
        setJob(null);
        setError(null);
        return;
      }
      
      // If job is already completed, don't start streaming
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        isCompletedRef.current = true;
        onComplete?.(job);
        if (persistKey) {
          localStorage.removeItem(persistKey);
        }
        return;
      }
      
      // Check again if cancelled before creating EventSource
      if (cancelled || isCompletedRef.current) {
        return;
      }
      
      const eventSource = new EventSource(`/api/jobs/${id}/stream`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        // Check if cancelled before processing
        if (cancelled || isCompletedRef.current) {
          eventSource.close();
          return;
        }
        
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'connected') {
            console.log('Connected to job stream:', data.jobId);
          } else if (data.type === 'progress') {
            const updatedJob: JobStatus = {
              id: data.jobId,
              type: data.jobType || 'unknown',
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
        // Only log actual errors, not normal closures
        if (eventSource.readyState === EventSource.CLOSED) {
          console.log('SSE connection closed for job:', id);
        } else {
          console.error('SSE connection error:', err);
        }
        eventSource.close();
        
        // Try to fetch final status if job isn't completed (only once)
        if (!isCompletedRef.current && !cancelled) {
          fetchJobStatus(id).then((job) => {
            if (cancelled || isCompletedRef.current) return;
            
            // If job is null (403 or not found), stop trying
            if (!job) {
              isCompletedRef.current = true;
              setJob(null);
              return;
            }
            
            // If job is actually completed, trigger completion
            if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
              isCompletedRef.current = true;
              onComplete?.(job);
              
              // Clean up localStorage on completion
              if (persistKey) {
                localStorage.removeItem(persistKey);
              }
            }
          });
        }
      };
    });

    // Return cleanup function
    return () => {
      cancelled = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [onProgress, onComplete, onError, persistKey, fetchJobStatus]);

  // Start streaming when jobId is available
  useEffect(() => {
    if (jobId && autoStart) {
      const cleanup = streamJob(jobId);
      return cleanup;
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to cancel job');
      }

      const data = await response.json();
      
      // Close stream
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // Fetch updated job status to reflect cancelled state
      const updatedJob = await fetchJobStatus(id);
      if (updatedJob) {
        setJob(updatedJob);
        isCompletedRef.current = true;
      }

      // Clear from localStorage
      if (persistKey) {
        localStorage.removeItem(persistKey);
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel job';
      setError(errorMessage);
      onError?.(errorMessage);
      throw err;
    }
  }, [persistKey, fetchJobStatus, onError]);

  // Delete job
  const deleteJob = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/jobs/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete job');
      }

      // Close stream if open
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Clear from localStorage
      if (persistKey) {
        localStorage.removeItem(persistKey);
      }

      // Clear job state
      setJob(null);

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete job';
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
    deleteJob,
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
