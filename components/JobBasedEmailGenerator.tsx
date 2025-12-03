/**
 * Job-Based Email Generator Component
 * Example component demonstrating persistent background jobs
 */

'use client';

import { useState } from 'react';
import { useJob } from '@/hooks/useJob';

export default function JobBasedEmailGenerator() {
  const [count, setCount] = useState(1000);
  const [providers, setProviders] = useState(['gmail.com', 'outlook.com']);
  const [country, setCountry] = useState('US');
  const [jobId, setJobId] = useState<string | null>(null);
  
  const {
    job,
    loading,
    error,
    isRunning,
    isCompleted,
    cancelJob,
  } = useJob(jobId, {
    persistKey: 'email-generation-job',
    onProgress: (job) => {
      console.log('Progress:', job.progress, '%');
    },
    onComplete: (job) => {
      console.log('Job completed!', job.resultData);
    },
    onError: (error) => {
      console.error('Job error:', error);
    },
  });

  const handleGenerate = async () => {
    try {
      const response = await fetch('/api/generate-emails-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count,
          providers,
          country,
          ageRange: '18-65',
          gender: 'any',
          pattern: '{firstname}.{lastname}',
          interests: [],
          includeNumbers: false,
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        setJobId(data.jobId);
      }
    } catch (err) {
      console.error('Failed to start job:', err);
    }
  };

  const handleCancel = async () => {
    if (jobId) {
      try {
        await cancelJob(jobId);
      } catch (err) {
        console.error('Failed to cancel job:', err);
      }
    }
  };

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold">Generate Emails (Job-Based)</h2>
      
      {job && (
        <div className="p-4 bg-slate-50 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">
              Status: <span className="capitalize">{job.status}</span>
            </div>
            <div className="text-sm text-slate-600">
              Job ID: {job.id.slice(0, 8)}...
            </div>
          </div>
          
          <div className="w-full bg-slate-200 rounded-full h-3 mb-2">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${job.progress}%` }}
            />
          </div>
          
          <div className="text-sm text-slate-600">
            Progress: {job.progress}%
          </div>

          {job.metadata && (
            <div className="mt-3 text-sm space-y-1">
              {job.metadata.processedItems !== undefined && (
                <div>Processed: {job.metadata.processedItems} / {job.metadata.totalItems}</div>
              )}
              {job.metadata.successCount !== undefined && (
                <div>Success: {job.metadata.successCount}</div>
              )}
            </div>
          )}

          {job.errorMessage && (
            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {job.errorMessage}
            </div>
          )}

          {isCompleted && job.resultData && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
              <div className="text-sm font-medium text-green-800 mb-2">
                ✓ Generation Complete!
              </div>
              <div className="text-sm text-green-700">
                Generated {job.resultData.data?.emails?.length || 0} emails
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Count</label>
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value))}
            className="w-full p-2 border rounded"
            disabled={isRunning}
            min="1"
            max="100000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Country Code</label>
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full p-2 border rounded"
            disabled={isRunning}
            placeholder="US"
          />
        </div>
      </div>

      <div className="flex gap-3">
        {!isRunning && !isCompleted && (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-slate-300"
          >
            {loading ? 'Starting...' : 'Generate Emails'}
          </button>
        )}

        {isRunning && (
          <button
            onClick={handleCancel}
            className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Cancel Job
          </button>
        )}

        {isCompleted && (
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Start New Job
          </button>
        )}
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded text-sm">
        <div className="font-medium text-blue-900 mb-1">
          ✨ Persistent Background Jobs
        </div>
        <ul className="text-blue-700 space-y-1 text-xs">
          <li>✓ Jobs continue running even if you close the tab</li>
          <li>✓ Progress is saved - refresh anytime</li>
          <li>✓ Resume after days - jobs are persistent</li>
        </ul>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          Error: {error}
        </div>
      )}
    </div>
  );
}
