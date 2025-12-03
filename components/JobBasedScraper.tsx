'use client';

import { useState } from 'react';
import { useJob } from '@/hooks/useJob';

interface JobBasedScraperProps {
  onEmailsFound?: (emails: string[]) => void;
}

export default function JobBasedScraper({ onEmailsFound }: JobBasedScraperProps) {
  const [domains, setDomains] = useState<string>('');
  const [maxPagesPerDomain, setMaxPagesPerDomain] = useState<number>(10);
  const [error, setError] = useState<string>('');
  const [jobId, setJobId] = useState<string | null>(null);

  const { job, isRunning, isCompleted, isFailed, cancelJob, deleteJob } = useJob(jobId, {
    persistKey: 'email-scraping-job',
    onComplete: (completedJob) => {
      if (completedJob.resultData?.data?.emails) {
        onEmailsFound?.(completedJob.resultData.data.emails);
      }
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const domainList = domains.split('\n').map(d => d.trim()).filter(Boolean);

    if (domainList.length === 0) {
      setError('Please enter at least one domain');
      return;
    }

    if (domainList.length > 100) {
      setError('Maximum 100 domains per job');
      return;
    }

    try {
      const response = await fetch('/api/scrape-emails-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domains: domainList,
          maxPagesPerDomain,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start scraping job');
      }

      const data = await response.json();
      setJobId(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleCancel = async () => {
    if (jobId) {
      try {
        await cancelJob(jobId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to cancel job');
      }
    }
  };

  const handleDelete = async () => {
    if (jobId && window.confirm('Are you sure you want to delete this job? This cannot be undone.')) {
      try {
        await deleteJob(jobId);
        setJobId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete job');
      }
    }
  };

  return (
    <div className="space-y-6 bg-gradient-to-br from-green-50 to-teal-50 p-6 rounded-xl shadow-lg border-2 border-green-200">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-green-600">🌐</span>
          Job-Based Email Scraper
        </h2>
        <span className="text-xs bg-green-600 text-white px-3 py-1 rounded-full font-semibold">
          PERSISTENT
        </span>
      </div>

      {/* Info Box */}
      <div className="bg-green-100 border-l-4 border-green-600 p-4 rounded">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-green-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-green-800">
            <p className="font-semibold mb-1">Persistent Domain Scraping</p>
            <ul className="space-y-1 text-xs">
              <li>✓ Resume from checkpoint after interruption</li>
              <li>✓ Per-domain processing with delays</li>
              <li>✓ Real-time progress updates</li>
              <li>✓ Recommended for 5+ domains</li>
            </ul>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Job Status Display */}
      {job && (
        <div className="bg-white p-6 rounded-lg border-2 border-green-300 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Scraping Job Status</h3>
              <p className="text-sm text-gray-600">ID: {job.id.slice(0, 8)}...</p>
            </div>
            <div className="flex items-center gap-2">
              {isRunning && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-green-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Scraping
                </span>
              )}
              {isCompleted && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  ✓ Completed
                </span>
              )}
              {isFailed && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  ✗ Failed
                </span>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm font-medium text-gray-700">{job.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-green-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>

          {/* Metadata */}
          {job.metadata && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {job.metadata.processedDomains !== undefined && (
                <div>
                  <span className="text-gray-600">Domains Scraped:</span>
                  <span className="font-semibold text-gray-900 ml-2">{job.metadata.processedDomains}</span>
                </div>
              )}
              {job.metadata.emailsFound !== undefined && (
                <div>
                  <span className="text-gray-600">Emails Found:</span>
                  <span className="font-semibold text-green-700 ml-2">{job.metadata.emailsFound}</span>
                </div>
              )}
            </div>
          )}

          {/* Results Summary */}
          {isCompleted && job.resultData?.data && (
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-green-50 p-3 rounded">
                  <p className="text-gray-600 text-xs">Total Emails</p>
                  <p className="text-xl font-bold text-green-700">{job.resultData.data.emails?.length || 0}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded">
                  <p className="text-gray-600 text-xs">Successful</p>
                  <p className="text-xl font-bold text-blue-700">{job.resultData.data.meta?.successfulScrapes || 0}</p>
                </div>
                <div className="bg-red-50 p-3 rounded">
                  <p className="text-gray-600 text-xs">Failed</p>
                  <p className="text-xl font-bold text-red-700">{job.resultData.data.meta?.failedScrapes || 0}</p>
                </div>
              </div>
              {job.resultData.data.meta?.averageEmailsPerDomain && (
                <p className="text-xs text-gray-600 mt-3">
                  Average: {job.resultData.data.meta.averageEmailsPerDomain.toFixed(1)} emails per domain
                </p>
              )}
              
              {/* View Scraped Emails */}
              {job.resultData.data.emails && job.resultData.data.emails.length > 0 && (
                <>
                  <details className="bg-gray-50 rounded-lg mt-3">
                    <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition">
                      View Scraped Emails ({job.resultData.data.emails.length})
                    </summary>
                    <div className="px-4 py-3 max-h-64 overflow-y-auto">
                      <textarea
                        readOnly
                        value={job.resultData.data.emails.join('\n')}
                        className="w-full h-48 px-3 py-2 text-xs font-mono border border-gray-300 rounded-md bg-white text-gray-900"
                      />
                    </div>
                  </details>
                  
                  {/* Export Options */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(job.resultData.data.emails.join('\n'));
                      }}
                      className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md transition"
                    >
                      📋 Copy All
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([job.resultData.data.emails.join('\n')], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `scraped-emails-${job.id.slice(0, 8)}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md transition"
                    >
                      💾 Download
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Error Message */}
          {isFailed && job.errorMessage && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm font-semibold text-red-700">Error:</p>
              <p className="text-sm text-red-600 mt-1">{job.errorMessage}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-4 flex gap-2">
            {isRunning && (
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md transition duration-200"
              >
                Cancel Job
              </button>
            )}
            {(isCompleted || isFailed) && (
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md transition duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Job
              </button>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Domains Input */}
        <div>
          <label htmlFor="domains" className="block text-sm font-medium text-gray-900 mb-2">
            Domains to Scrape (one per line)
          </label>
          <textarea
            id="domains"
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
            rows={6}
            placeholder="example.com&#10;company.com&#10;startup.io"
            disabled={isRunning}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white placeholder-gray-400 font-mono text-sm disabled:bg-gray-100 resize-none"
          />
          {domains && (
            <p className="text-sm text-gray-500 mt-2">
              {domains.split('\n').filter(d => d.trim()).length} domains to scrape
            </p>
          )}
        </div>

        {/* Max Pages */}
        <div>
          <label htmlFor="maxPages" className="block text-sm font-medium text-gray-900 mb-2">
            Max Pages per Domain
          </label>
          <input
            type="number"
            id="maxPages"
            min="1"
            max="100"
            value={maxPagesPerDomain}
            onChange={(e) => setMaxPagesPerDomain(parseInt(e.target.value) || 10)}
            disabled={isRunning}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white disabled:bg-gray-100"
          />
          <p className="text-xs text-gray-500 mt-1">Higher values = more emails but slower scraping</p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isRunning || !domains.trim()}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
        >
          {isRunning ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Scraping...
            </span>
          ) : (
            '🚀 Start Scraping Job'
          )}
        </button>
      </form>

      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
        <h3 className="text-sm font-semibold text-green-900 mb-2">Job Features:</h3>
        <ul className="text-xs text-gray-700 space-y-1">
          <li>✓ Per-domain sequential processing</li>
          <li>✓ 2-second delay between domains (respectful)</li>
          <li>✓ Automatic email deduplication</li>
          <li>✓ Checkpoint resumability</li>
          <li>✓ Handles failures gracefully</li>
        </ul>
      </div>
    </div>
  );
}
