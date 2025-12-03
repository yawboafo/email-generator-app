'use client';

import { useState, useEffect } from 'react';
import { useJob } from '@/hooks/useJob';
import type { Country, Gender, AgeRange, NamePattern, Provider } from '@/types';
import allCountries from '@/data/countries.json';

interface JobBasedEmailFormProps {
  onGenerate?: (emails: string[], meta: any) => void;
}

export default function JobBasedEmailForm({ onGenerate }: JobBasedEmailFormProps) {
  const [count, setCount] = useState<number>(1000);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [providerList, setProviderList] = useState<Provider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [patternList, setPatternList] = useState<Array<{name: string; template: string; description: string; category: string}>>([]);
  const [loadingPatterns, setLoadingPatterns] = useState(true);
  const [country, setCountry] = useState<Country>('US');
  const [ageRange, setAgeRange] = useState<AgeRange>('26-35');
  const [gender, setGender] = useState<Gender>('any');
  const [interests, setInterests] = useState<string>('');
  const [pattern, setPattern] = useState<NamePattern>('firstname.lastname');
  const [includeNumbers, setIncludeNumbers] = useState<boolean>(true);
  const [minNumber, setMinNumber] = useState<number>(1);
  const [maxNumber, setMaxNumber] = useState<number>(999);
  const [allowLetters, setAllowLetters] = useState<boolean>(true);
  const [allowNumbers, setAllowNumbers] = useState<boolean>(true);
  const [allowUnderscore, setAllowUnderscore] = useState<boolean>(false);
  const [allowDot, setAllowDot] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [providersExpanded, setProvidersExpanded] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const countriesList = allCountries as Array<{ code: string; name: string }>;

  // Job tracking
  const { job, isRunning, isCompleted, isFailed, cancelJob, deleteJob } = useJob(jobId, {
    persistKey: 'email-generation-job',
    onComplete: (completedJob) => {
      if (completedJob.resultData?.data?.emails) {
        onGenerate?.(completedJob.resultData.data.emails, completedJob.resultData.data.meta);
      }
    },
  });

  // Fetch providers from database
  useEffect(() => {
    async function fetchProviders() {
      try {
        const res = await fetch('/api/providers');
        const data = await res.json();
        if (data.providers && data.providers.length > 0) {
          setProviderList(data.providers);
          const defaultProviders = data.providers.slice(0, 3).map((p: Provider) => p.domain);
          setSelectedProviders(defaultProviders);
        }
      } catch (err) {
        console.error('Failed to fetch providers:', err);
      } finally {
        setLoadingProviders(false);
      }
    }
    fetchProviders();
  }, []);

  // Fetch patterns from database
  useEffect(() => {
    async function fetchPatterns() {
      try {
        const res = await fetch('/api/patterns');
        const data = await res.json();
        if (data.patterns && data.patterns.length > 0) {
          setPatternList(data.patterns);
          if (!data.patterns.find((p: any) => p.name === pattern)) {
            setPattern(data.patterns[0].name as NamePattern);
          }
        }
      } catch (err) {
        console.error('Failed to fetch patterns:', err);
      } finally {
        setLoadingPatterns(false);
      }
    }
    fetchPatterns();
  }, [pattern]);

  const handleProviderToggle = (domain: string) => {
    setSelectedProviders(prev => 
      prev.includes(domain) 
        ? prev.filter(p => p !== domain)
        : [...prev, domain]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (selectedProviders.length === 0) {
      setError('Please select at least one email provider');
      return;
    }

    if (count < 1 || count > 500000) {
      setError('Count must be between 1 and 500,000');
      return;
    }

    try {
      const response = await fetch('/api/generate-emails-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          count,
          providers: selectedProviders,
          country,
          ageRange,
          gender,
          interests: interests.split(',').map(i => i.trim()).filter(Boolean),
          pattern,
          includeNumbers,
          numberRange: [minNumber, maxNumber],
          allowedCharacters: {
            letters: allowLetters,
            numbers: allowNumbers,
            underscore: allowUnderscore,
            dot: allowDot
          },
          method: 'pattern'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start generation job');
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
    <form onSubmit={handleSubmit} className="space-y-6 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl shadow-lg border-2 border-blue-200">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-blue-600">⚡</span>
          Job-Based Email Generator
        </h2>
        <span className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full font-semibold">
          PERSISTENT
        </span>
      </div>

      {/* Info Box */}
      <div className="bg-blue-100 border-l-4 border-blue-600 p-4 rounded">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Persistent Background Jobs</p>
            <ul className="space-y-1 text-xs">
              <li>✓ Survives page refresh and browser restart</li>
              <li>✓ Resume anytime from last checkpoint</li>
              <li>✓ Real-time progress updates</li>
              <li>✓ Recommended for 1,000+ emails</li>
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
        <div className="bg-white p-6 rounded-lg border-2 border-blue-300 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Job Status</h3>
              <p className="text-sm text-gray-600">ID: {job.id.slice(0, 8)}...</p>
            </div>
            <div className="flex items-center gap-2">
              {isRunning && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Running
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
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>

          {/* Metadata */}
          {job.metadata && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {job.metadata.processedItems !== undefined && (
                <div>
                  <span className="text-gray-600">Processed:</span>
                  <span className="font-semibold text-gray-900 ml-2">{job.metadata.processedItems}</span>
                </div>
              )}
              {job.metadata.successCount !== undefined && (
                <div>
                  <span className="text-gray-600">Generated:</span>
                  <span className="font-semibold text-gray-900 ml-2">{job.metadata.successCount}</span>
                </div>
              )}
            </div>
          )}

          {/* Results */}
          {isCompleted && job.resultData?.data?.emails && (
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-green-700">
                  ✓ Generated {job.resultData.data.emails.length.toLocaleString()} emails
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(job.resultData.data.emails.join('\n'));
                    }}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md transition"
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
                      a.download = `emails-${job.id.slice(0, 8)}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md transition"
                  >
                    💾 Download
                  </button>
                </div>
              </div>
              
              <details className="bg-gray-50 rounded-lg">
                <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition">
                  View Generated Emails ({job.resultData.data.emails.length})
                </summary>
                <div className="px-4 py-3 max-h-64 overflow-y-auto">
                  <textarea
                    readOnly
                    value={job.resultData.data.emails.join('\n')}
                    className="w-full h-48 px-3 py-2 text-xs font-mono border border-gray-300 rounded-md bg-white text-gray-900"
                  />
                </div>
              </details>
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

      {/* Count */}
      <div>
        <label htmlFor="count" className="block text-sm font-medium text-gray-900 mb-2">
          Number of Emails
        </label>
        <input
          type="number"
          id="count"
          min="1"
          max="500000"
          value={count}
          onChange={(e) => setCount(parseInt(e.target.value) || 1)}
          disabled={isRunning}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white disabled:bg-gray-100"
        />
        <p className="text-xs text-gray-500 mt-1">Recommended: 1,000+ for job-based generation</p>
      </div>

      {/* Email Providers */}
      <div className="border rounded-lg">
        <button
          type="button"
          onClick={() => setProvidersExpanded(!providersExpanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          disabled={isRunning}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">Email Providers</span>
            {selectedProviders.length > 0 && (
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                {selectedProviders.length} selected
              </span>
            )}
          </div>
          <svg className={`w-5 h-5 text-gray-500 transition-transform ${providersExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {providersExpanded && (
          <div className="p-4 border-t max-h-64 overflow-y-auto">
            {loadingProviders ? (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {providerList.map((provider) => (
                  <label key={provider.domain} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedProviders.includes(provider.domain)}
                      onChange={() => handleProviderToggle(provider.domain)}
                      disabled={isRunning}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-900 flex-1">{provider.name}</span>
                    <span className="text-xs text-gray-500">{provider.domain}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Country */}
      <div>
        <label htmlFor="country" className="block text-sm font-medium text-gray-900 mb-2">
          Country
        </label>
        <select
          id="country"
          value={country}
          onChange={(e) => setCountry(e.target.value as Country)}
          disabled={isRunning}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white disabled:bg-gray-100"
        >
          {countriesList.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Pattern */}
      <div>
        <label htmlFor="pattern" className="block text-sm font-medium text-gray-900 mb-2">
          Email Pattern
        </label>
        <select
          id="pattern"
          value={pattern}
          onChange={(e) => setPattern(e.target.value as NamePattern)}
          disabled={isRunning || loadingPatterns}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white disabled:bg-gray-100"
        >
          {loadingPatterns ? (
            <option value="">Loading patterns...</option>
          ) : (
            Object.entries(
              patternList.reduce((acc, p) => {
                if (!acc[p.category]) acc[p.category] = [];
                acc[p.category].push(p);
                return acc;
              }, {} as Record<string, typeof patternList>)
            ).map(([category, patterns]) => (
              <optgroup key={category} label={category}>
                {patterns.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} {p.description && `— ${p.description}`}
                  </option>
                ))}
              </optgroup>
            ))
          )}
        </select>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isRunning || loadingProviders}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        {isRunning ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Generating...
          </span>
        ) : (
          '🚀 Start Generation Job'
        )}
      </button>
    </form>
  );
}
