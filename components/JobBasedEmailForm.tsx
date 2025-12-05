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
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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

    // Prevent duplicate submissions
    if (isSubmitting) {
      console.warn('⚠️ Duplicate submission blocked');
      return;
    }

    setIsSubmitting(true);
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
    } finally {
      setIsSubmitting(false);
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
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Key Features */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
        <p className="text-xs font-medium text-slate-700 mb-2">Key Features:</p>
        <ul className="space-y-1 text-xs text-slate-600">
          <li>• Batch processing with checkpoints</li>
          <li>• Supports up to 500K emails</li>
          <li>• Custom patterns and providers</li>
        </ul>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Job Status Display */}
      {job && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Job #{job.id.slice(0, 8)}</p>
            {isRunning && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Running
              </span>
            )}
            {isCompleted && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                ✓ Completed
              </span>
            )}
            {isFailed && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                ✗ Failed
              </span>
            )}
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-600">Progress</span>
              <span className="text-xs font-medium text-slate-700">{job.progress}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>

          {/* Metadata */}
          {job.metadata && (job.metadata.processedItems !== undefined || job.metadata.successCount !== undefined) && (
            <div className="flex gap-4 text-xs text-slate-600">
              {job.metadata.processedItems !== undefined && (
                <div>Processed: <span className="font-medium text-slate-900">{job.metadata.processedItems}</span></div>
              )}
              {job.metadata.successCount !== undefined && (
                <div>Generated: <span className="font-medium text-slate-900">{job.metadata.successCount}</span></div>
              )}
            </div>
          )}

          {/* Results */}
          {isCompleted && job.resultData?.data?.emails && (
            <div className="pt-3 border-t border-slate-200">
              <p className="text-sm font-medium text-green-700 mb-2">
                ✓ {job.resultData.data.emails.length.toLocaleString()} emails generated
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(job.resultData.data.emails.join('\n'))}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition font-medium"
                >
                  📋 Copy
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
                  className="text-xs bg-slate-600 hover:bg-slate-700 text-white px-3 py-1.5 rounded-md transition font-medium"
                >
                  💾 Download
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {isFailed && job.errorMessage && (
            <div className="pt-3 border-t border-slate-200">
              <p className="text-xs font-medium text-red-700">Error:</p>
              <p className="text-xs text-red-600 mt-1">{job.errorMessage}</p>
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

      {/* Number of Emails */}
      <div>
        <label htmlFor="count" className="block text-xs font-medium text-slate-700 mb-1.5">
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
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 bg-white disabled:bg-slate-100 disabled:text-slate-500"
        />
        <p className="text-xs text-slate-500 mt-1">Max 500,000 emails per job</p>
      </div>

      {/* Email Providers */}
      <div className="border border-slate-300 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setProvidersExpanded(!providersExpanded)}
          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 transition-colors"
          disabled={isRunning}
        >
          <span className="text-xs font-medium text-slate-700">
            Providers ({selectedProviders.length} selected)
          </span>
          <svg className={`w-4 h-4 text-slate-500 transition-transform ${providersExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {providersExpanded && (
          <div className="p-3 border-t border-slate-200 max-h-48 overflow-y-auto bg-slate-50">
            {loadingProviders ? (
              <div className="text-center py-3">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {providerList.map((provider) => (
                  <label key={provider.domain} className="flex items-center gap-2 px-2 py-1.5 hover:bg-white rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedProviders.includes(provider.domain)}
                      onChange={() => handleProviderToggle(provider.domain)}
                      disabled={isRunning}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="text-xs text-slate-900 flex-1">{provider.domain}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Country */}
      <div>
        <label htmlFor="country" className="block text-xs font-medium text-slate-700 mb-1.5">
          Country
        </label>
        <select
          id="country"
          value={country}
          onChange={(e) => setCountry(e.target.value as Country)}
          disabled={isRunning}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 bg-white disabled:bg-slate-100"
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
        <label htmlFor="pattern" className="block text-xs font-medium text-slate-700 mb-1.5">
          Email Pattern
        </label>
        <select
          id="pattern"
          value={pattern}
          onChange={(e) => setPattern(e.target.value as NamePattern)}
          disabled={isRunning || loadingPatterns}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 bg-white disabled:bg-slate-100"
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
        disabled={isRunning || isSubmitting || loadingProviders || selectedProviders.length === 0}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm"
      >
        {isRunning || isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Generating...
          </span>
        ) : (
          'Start Generation Job'
        )}
      </button>
    </form>
  );
}
