'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Job {
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

interface JobStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
}

interface WorkerHealth {
  healthy: boolean;
  workers: {
    running: boolean;
    active: number;
  };
  redis: {
    connected: boolean;
    status: string;
  };
}

export default function JobsDashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [workerHealth, setWorkerHealth] = useState<WorkerHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [refreshInterval, setRefreshInterval] = useState<number>(5000);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showResultsModal, setShowResultsModal] = useState(false);

  // Fetch jobs
  const fetchJobs = async () => {
    try {
      const statusParam = filter !== 'all' ? `&status=${filter}` : '';
      const response = await fetch(`/api/jobs/dashboard?userId=${user?.id}${statusParam}`);
      const data = await response.json();
      
      setJobs(data.jobs);
      setStats(data.summary);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  // Fetch worker health
  const fetchWorkerHealth = async () => {
    try {
      const response = await fetch('/api/workers/health');
      const data = await response.json();
      setWorkerHealth(data);
    } catch (error) {
      console.error('Error fetching worker health:', error);
    }
  };

  // Initial fetch
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([fetchJobs(), fetchWorkerHealth()]);
      setLoading(false);
    };
    fetchAll();
  }, [user, filter]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchJobs();
      fetchWorkerHealth();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, filter]);

  // Cancel job
  const cancelJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/cancel`, {
        method: 'POST',
      });
      if (response.ok) {
        fetchJobs();
      }
    } catch (error) {
      console.error('Error cancelling job:', error);
    }
  };

  // Restart workers
  const restartWorkers = async () => {
    try {
      const response = await fetch('/api/workers/start', {
        method: 'POST',
      });
      if (response.ok) {
        fetchWorkerHealth();
      }
    } catch (error) {
      console.error('Error restarting workers:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'running': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'completed': return 'bg-green-100 text-green-800 border-green-300';
      case 'failed': return 'bg-red-100 text-red-800 border-red-300';
      case 'cancelled': return 'bg-orange-100 text-orange-800 border-orange-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getTypeLabel = (type: string) => {
    return type.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const formatDuration = (start: string, end?: string | null) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const duration = Math.floor((endTime - startTime) / 1000);
    
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.floor(duration / 60)}m`;
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Jobs Dashboard</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300"
            />
            Auto-refresh ({refreshInterval / 1000}s)
          </label>
          <button
            onClick={() => { fetchJobs(); fetchWorkerHealth(); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Worker Status Card */}
      <div className={`mb-6 p-6 rounded-lg border-2 ${
        workerHealth?.healthy 
          ? 'bg-green-50 border-green-300' 
          : 'bg-red-50 border-red-300'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-2">
              {workerHealth?.healthy ? '✅ System Healthy' : '⚠️ System Issues'}
            </h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Workers:</span>{' '}
                <span className="font-medium">
                  {workerHealth?.workers.running ? 
                    `Running (${workerHealth.workers.active})` : 
                    'Not Running'
                  }
                </span>
              </div>
              <div>
                <span className="text-gray-600">Redis:</span>{' '}
                <span className="font-medium">
                  {workerHealth?.redis.connected ? 'Connected' : workerHealth?.redis.status}
                </span>
              </div>
            </div>
          </div>
          {!workerHealth?.healthy && (
            <button
              onClick={restartWorkers}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Restart Workers
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`p-4 rounded-lg border-2 transition ${
              filter === 'all' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">Total</div>
          </button>
          <button
            onClick={() => setFilter('running')}
            className={`p-4 rounded-lg border-2 transition ${
              filter === 'running' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl font-bold text-blue-600">{stats.running}</div>
            <div className="text-sm text-gray-600">Running</div>
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`p-4 rounded-lg border-2 transition ${
              filter === 'pending' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
            <div className="text-sm text-gray-600">Pending</div>
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`p-4 rounded-lg border-2 transition ${
              filter === 'completed' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-gray-600">Completed</div>
          </button>
          <button
            onClick={() => setFilter('failed')}
            className={`p-4 rounded-lg border-2 transition ${
              filter === 'failed' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <div className="text-sm text-gray-600">Failed</div>
          </button>
          <button
            onClick={() => setFilter('cancelled')}
            className={`p-4 rounded-lg border-2 transition ${
              filter === 'cancelled' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl font-bold text-orange-600">{stats.cancelled}</div>
            <div className="text-sm text-gray-600">Cancelled</div>
          </button>
        </div>
      )}

      {/* Jobs List */}
      <div className="bg-white rounded-lg shadow">
        {jobs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg">No jobs found</p>
            <p className="text-sm mt-2">Start a new job to see it here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-mono text-gray-900">{job.id.slice(0, 12)}...</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{getTypeLabel(job.type)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              job.status === 'completed' ? 'bg-green-500' :
                              job.status === 'failed' ? 'bg-red-500' :
                              job.status === 'running' ? 'bg-blue-500' :
                              'bg-gray-400'
                            }`}
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">{job.progress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {formatDuration(job.createdAt, job.completedAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500">
                        {formatDate(job.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {job.status === 'running' || job.status === 'pending' ? (
                          <button
                            onClick={() => cancelJob(job.id)}
                            className="text-sm text-red-600 hover:text-red-800 font-medium"
                          >
                            Cancel
                          </button>
                        ) : null}
                        {job.status === 'completed' && job.resultData && (
                          <button
                            onClick={() => {
                              setSelectedJob(job);
                              setShowResultsModal(true);
                            }}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            View Results
                          </button>
                        )}
                        {job.errorMessage && (
                          <button
                            onClick={() => alert(job.errorMessage)}
                            className="text-sm text-orange-600 hover:text-orange-800 font-medium"
                          >
                            View Error
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Results Modal */}
      {showResultsModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Job Results</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {getTypeLabel(selectedJob.type)} • ID: {selectedJob.id.slice(0, 12)}...
                </p>
              </div>
              <button
                onClick={() => {
                  setShowResultsModal(false);
                  setSelectedJob(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Summary Stats */}
              {selectedJob.resultData?.summary && (
                <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(selectedJob.resultData.summary).map(([key, value]) => (
                    <div key={key} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="text-2xl font-bold text-gray-900">{String(value)}</div>
                      <div className="text-sm text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Results Data */}
              {selectedJob.resultData?.emails && Array.isArray(selectedJob.resultData.emails) ? (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">
                    Generated Emails ({selectedJob.resultData.emails.length.toLocaleString()})
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <textarea
                      readOnly
                      value={selectedJob.resultData.emails.join('\n')}
                      className="w-full h-64 font-mono text-sm bg-white rounded border border-gray-300 p-3 resize-none"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedJob.resultData.emails.join('\n'));
                        alert('Copied to clipboard!');
                      }}
                      className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      📋 Copy All Emails
                    </button>
                  </div>
                </div>
              ) : selectedJob.resultData?.results && Array.isArray(selectedJob.resultData.results) ? (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">
                    Verification Results ({selectedJob.resultData.results.length.toLocaleString()})
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full border border-gray-200 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Email</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedJob.resultData.results.slice(0, 100).map((result: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm font-mono">{result.email}</td>
                            <td className="px-4 py-2">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                result.status === 'valid' ? 'bg-green-100 text-green-800' :
                                result.status === 'risky' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {result.status}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {result.reason || 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {selectedJob.resultData.results.length > 100 && (
                      <p className="text-sm text-gray-500 mt-2 text-center">
                        Showing first 100 of {selectedJob.resultData.results.length.toLocaleString()} results
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Raw Results</h4>
                  <pre className="bg-gray-50 rounded-lg p-4 border border-gray-200 overflow-x-auto text-xs">
                    {JSON.stringify(selectedJob.resultData, null, 2)}
                  </pre>
                </div>
              )}

              {/* Metadata */}
              {selectedJob.metadata && (
                <div className="mt-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Job Metadata</h4>
                  <pre className="bg-gray-50 rounded-lg p-4 border border-gray-200 overflow-x-auto text-xs">
                    {JSON.stringify(selectedJob.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowResultsModal(false);
                  setSelectedJob(null);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
