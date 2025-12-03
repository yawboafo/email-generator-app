'use client';

import { useState } from 'react';
import { useJob } from '@/hooks/useJob';

interface JobBasedVerifierProps {
  onVerified?: (results: any[]) => void;
}

export default function JobBasedVerifier({ onVerified }: JobBasedVerifierProps) {
  const [emails, setEmails] = useState<string>('');
  const [service, setService] = useState<string>('mailsso');
  const [error, setError] = useState<string>('');
  const [jobId, setJobId] = useState<string | null>(null);

  const { job, isRunning, isCompleted, isFailed, cancelJob, deleteJob } = useJob(jobId, {
    persistKey: 'email-verification-job',
    onComplete: (completedJob) => {
      if (completedJob.resultData?.data?.results) {
        onVerified?.(completedJob.resultData.data.results);
      }
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailList = emails.split('\n').map(e => e.trim()).filter(Boolean);

    if (emailList.length === 0) {
      setError('Please enter at least one email address');
      return;
    }

    if (emailList.length > 10000) {
      setError('Maximum 10,000 emails per job');
      return;
    }

    try {
      const response = await fetch('/api/verify-emails-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emails: emailList,
          service,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start verification job');
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
    <div className="space-y-6 bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl shadow-lg border-2 border-purple-200">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-purple-600">✓</span>
          Job-Based Email Verifier
        </h2>
        <span className="text-xs bg-purple-600 text-white px-3 py-1 rounded-full font-semibold">
          PERSISTENT
        </span>
      </div>

      {/* Info Box */}
      <div className="bg-purple-100 border-l-4 border-purple-600 p-4 rounded">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-purple-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-purple-800">
            <p className="font-semibold mb-1">Persistent Verification with Deduplication</p>
            <ul className="space-y-1 text-xs">
              <li>✓ Never verifies same email twice (cache-first)</li>
              <li>✓ Resume from checkpoint after interruption</li>
              <li>✓ Real-time progress updates</li>
              <li>✓ Recommended for 100+ emails</li>
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
        <div className="bg-white p-6 rounded-lg border-2 border-purple-300 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Verification Job Status</h3>
              <p className="text-sm text-gray-600">ID: {job.id.slice(0, 8)}...</p>
            </div>
            <div className="flex items-center gap-2">
              {isRunning && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-purple-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Verifying
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
                className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>

          {/* Metadata */}
          {job.metadata && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {job.metadata.processedEmails !== undefined && (
                <div>
                  <span className="text-gray-600">Processed:</span>
                  <span className="font-semibold text-gray-900 ml-2">{job.metadata.processedEmails}</span>
                </div>
              )}
              {job.metadata.cachedCount !== undefined && (
                <div>
                  <span className="text-gray-600">From Cache:</span>
                  <span className="font-semibold text-purple-700 ml-2">{job.metadata.cachedCount}</span>
                </div>
              )}
            </div>
          )}

          {/* Results Summary */}
          {isCompleted && job.resultData?.data?.summary && (
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
              <p className="text-sm font-semibold text-gray-700 mb-2">Results:</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-green-50 p-3 rounded">
                  <p className="text-gray-600">Valid</p>
                  <p className="text-xl font-bold text-green-700">{job.resultData.data.summary.valid}</p>
                </div>
                <div className="bg-yellow-50 p-3 rounded">
                  <p className="text-gray-600">Risky</p>
                  <p className="text-xl font-bold text-yellow-700">{job.resultData.data.summary.risky}</p>
                </div>
                <div className="bg-red-50 p-3 rounded">
                  <p className="text-gray-600">Invalid</p>
                  <p className="text-xl font-bold text-red-700">{job.resultData.data.summary.invalid}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-gray-600">Unknown</p>
                  <p className="text-xl font-bold text-gray-700">{job.resultData.data.summary.unknown}</p>
                </div>
              </div>
              {job.resultData.data.cachedCount > 0 && (
                <p className="text-xs text-purple-600 mt-3 font-medium">
                  💾 {job.resultData.data.cachedCount} results retrieved from cache (instant)
                </p>
              )}
              
              {/* View Detailed Results */}
              {job.resultData.data.results && (
                <details className="bg-gray-50 rounded-lg mt-3">
                  <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition">
                    View All Results ({job.resultData.data.results.length})
                  </summary>
                  <div className="px-4 py-3 max-h-64 overflow-y-auto">
                    <div className="space-y-2">
                      {job.resultData.data.results.map((result: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-gray-100">
                          <span className="font-mono text-gray-700">{result.email}</span>
                          <span className={`px-2 py-0.5 rounded font-semibold ${
                            result.status === 'valid' ? 'bg-green-100 text-green-700' :
                            result.status === 'risky' ? 'bg-yellow-100 text-yellow-700' :
                            result.status === 'invalid' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {result.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              )}
              
              {/* Export Options */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const validEmails = job.resultData.data.results
                      .filter((r: any) => r.status === 'valid')
                      .map((r: any) => r.email)
                      .join('\n');
                    navigator.clipboard.writeText(validEmails);
                  }}
                  className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md transition"
                >
                  📋 Copy Valid
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const allResults = job.resultData.data.results
                      .map((r: any) => `${r.email},${r.status}`)
                      .join('\n');
                    const blob = new Blob([`email,status\n${allResults}`], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `verification-${job.id.slice(0, 8)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-md transition"
                >
                  💾 Download CSV
                </button>
              </div>
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
        {/* Emails Input */}
        <div>
          <label htmlFor="emails" className="block text-sm font-medium text-gray-900 mb-2">
            Email Addresses (one per line)
          </label>
          <textarea
            id="emails"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            rows={8}
            placeholder="email1@example.com&#10;email2@example.com&#10;email3@example.com"
            disabled={isRunning}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white placeholder-gray-400 font-mono text-sm disabled:bg-gray-100 resize-none"
          />
          {emails && (
            <p className="text-sm text-gray-500 mt-2">
              {emails.split('\n').filter(e => e.trim()).length} emails to verify
            </p>
          )}
        </div>

        {/* Service Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-3">
            Verification Service
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setService('mailsso')}
              disabled={isRunning}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                service === 'mailsso'
                  ? 'border-purple-600 bg-purple-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300'
              } disabled:opacity-50`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900">Mails.so</span>
                {service === 'mailsso' && <span className="text-purple-600">✓</span>}
              </div>
              <span className="text-xs text-gray-500">Fast & Reliable</span>
            </button>

            <button
              type="button"
              onClick={() => setService('emaillistverify')}
              disabled={isRunning}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                service === 'emaillistverify'
                  ? 'border-purple-600 bg-purple-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300'
              } disabled:opacity-50`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900">EmailListVerify</span>
                {service === 'emaillistverify' && <span className="text-purple-600">✓</span>}
              </div>
              <span className="text-xs text-gray-500">Detailed Results</span>
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isRunning || !emails.trim()}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
        >
          {isRunning ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Verifying...
            </span>
          ) : (
            '🔍 Start Verification Job'
          )}
        </button>
      </form>

      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
        <h3 className="text-sm font-semibold text-purple-900 mb-2">Job Features:</h3>
        <ul className="text-xs text-gray-700 space-y-1">
          <li>✓ Cache-first: Never verifies same email twice</li>
          <li>✓ Batch processing: 50 emails per batch</li>
          <li>✓ Resumable from checkpoints</li>
          <li>✓ Saves all results to database</li>
          <li>✓ Real-time progress streaming</li>
        </ul>
      </div>
    </div>
  );
}
