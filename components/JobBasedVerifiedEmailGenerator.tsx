'use client';

import { useState, useEffect } from 'react';
import { useJob } from '@/hooks/useJob';
import type { Country, Gender, AgeRange, NamePattern, Provider } from '@/types';
import allCountries from '@/data/countries.json';

interface JobBasedVerifiedEmailGeneratorProps {
  onGenerate?: (emails: string[], meta: any) => void;
}

export default function JobBasedVerifiedEmailGenerator({ onGenerate }: JobBasedVerifiedEmailGeneratorProps) {
  const [targetCount, setTargetCount] = useState<number>(100);
  const [verificationService, setVerificationService] = useState<'mailsso' | 'emaillistverify'>('mailsso');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [providerList, setProviderList] = useState<Provider[]>([]);
  const [patternList, setPatternList] = useState<any[]>([]);
  const [loadingPatterns, setLoadingPatterns] = useState(true);
  const [country, setCountry] = useState<Country>('US');
  const [ageRange, setAgeRange] = useState<AgeRange>('26-35');
  const [gender, setGender] = useState<Gender>('any');
  const [pattern, setPattern] = useState<NamePattern>('firstname.lastname');
  const [includeNumbers, setIncludeNumbers] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [jobId, setJobId] = useState<string | null>(null);

  const countriesList = allCountries as Array<{ code: string; name: string }>;

  const { job, isRunning, isCompleted, isFailed, cancelJob, deleteJob } = useJob(jobId, {
    persistKey: 'verified-email-generation-job',
    onComplete: (completedJob) => {
      if (completedJob.resultData?.data?.validEmails) {
        onGenerate?.(completedJob.resultData.data.validEmails, {
          count: completedJob.resultData.data.validEmails.length,
          source: 'job-based-verified'
        });
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
          // Select top 10 most popular providers by default
          const defaultProviders = data.providers.slice(0, 10).map((p: Provider) => p.domain);
          setSelectedProviders(defaultProviders);
        }
      } catch (err) {
        console.error('Failed to fetch providers:', err);
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
          // Set default pattern if current pattern not in list
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
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (selectedProviders.length === 0) {
      setError('Please select at least one provider');
      return;
    }

    if (targetCount < 1 || targetCount > 10000) {
      setError('Target count must be between 1 and 10,000');
      return;
    }

    try {
      const response = await fetch('/api/generate-verified-emails-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetCount,
          country,
          ageRange,
          gender,
          pattern,
          includeNumbers,
          providers: selectedProviders,
          verificationService,
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

  const toggleProvider = (domain: string) => {
    if (isRunning) return;
    setSelectedProviders(prev =>
      prev.includes(domain)
        ? prev.filter(d => d !== domain)
        : [...prev, domain]
    );
  };

  return (
    <div className="space-y-6 bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-xl shadow-lg border-2 border-emerald-200">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-emerald-600">✓</span>
          Job-Based Verified Email Generator
        </h2>
        <span className="text-xs bg-emerald-600 text-white px-3 py-1 rounded-full font-semibold">
          PERSISTENT
        </span>
      </div>

      {/* Info Box */}
      <div className="bg-emerald-100 border-l-4 border-emerald-600 p-4 rounded">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-emerald-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-emerald-800">
            <p className="font-semibold mb-1">Generate & Verify with Persistence</p>
            <ul className="space-y-1 text-xs">
              <li>✓ Generates emails then verifies in batches</li>
              <li>✓ Resume from checkpoint after interruption</li>
              <li>✓ Cache-first verification (no duplicates)</li>
              <li>✓ Returns only valid emails</li>
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
        <div className="bg-white p-6 rounded-lg border-2 border-emerald-300 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Generation Job Status</h3>
              <p className="text-sm text-gray-600">ID: {job.id.slice(0, 8)}...</p>
            </div>
            <div className="flex items-center gap-2">
              {isRunning && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                  <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-emerald-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating
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
                className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>

          {/* Metadata */}
          {job.metadata && (
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              {job.metadata.generated !== undefined && (
                <div>
                  <span className="text-gray-600">Generated:</span>
                  <span className="font-semibold text-gray-900 ml-2">{job.metadata.generated}</span>
                </div>
              )}
              {job.metadata.verified !== undefined && (
                <div>
                  <span className="text-gray-600">Verified:</span>
                  <span className="font-semibold text-emerald-700 ml-2">{job.metadata.verified}</span>
                </div>
              )}
              {job.metadata.valid !== undefined && (
                <div>
                  <span className="text-gray-600">Valid:</span>
                  <span className="font-semibold text-green-700 ml-2">{job.metadata.valid}</span>
                </div>
              )}
              {job.metadata.cachedCount !== undefined && job.metadata.cachedCount > 0 && (
                <div>
                  <span className="text-gray-600">From Cache:</span>
                  <span className="font-semibold text-purple-700 ml-2">{job.metadata.cachedCount}</span>
                </div>
              )}
            </div>
          )}

          {/* Results Summary */}
          {isCompleted && job.resultData?.data && (
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
              <p className="text-sm font-semibold text-gray-700 mb-2">Results:</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-green-50 p-3 rounded">
                  <p className="text-gray-600">Valid Emails</p>
                  <p className="text-2xl font-bold text-green-700">
                    {job.resultData.data.validEmails?.length || 0}
                  </p>
                </div>
                <div className="bg-blue-50 p-3 rounded">
                  <p className="text-gray-600">Total Generated</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {job.resultData.data.totalGenerated || 0}
                  </p>
                </div>
              </div>
              {job.resultData.data.cachedCount > 0 && (
                <p className="text-xs text-purple-600 mt-3 font-medium">
                  💾 {job.resultData.data.cachedCount} verifications from cache (instant)
                </p>
              )}

              {/* View Valid Emails */}
              {job.resultData.data.validEmails && job.resultData.data.validEmails.length > 0 && (
                <details className="bg-gray-50 rounded-lg mt-3">
                  <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition">
                    View Valid Emails ({job.resultData.data.validEmails.length})
                  </summary>
                  <div className="px-4 py-3 max-h-64 overflow-y-auto">
                    <div className="space-y-1">
                      {job.resultData.data.validEmails.map((email: string, idx: number) => (
                        <div key={idx} className="text-xs py-1 px-2 rounded hover:bg-gray-100 font-mono text-gray-700">
                          {email}
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
                    const validEmails = job.resultData.data.validEmails.join('\n');
                    navigator.clipboard.writeText(validEmails);
                  }}
                  className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md transition"
                >
                  📋 Copy All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const emails = job.resultData.data.validEmails.join('\n');
                    const blob = new Blob([emails], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `verified-emails-${job.id.slice(0, 8)}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-md transition"
                >
                  💾 Download TXT
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
        {/* Target Count */}
        <div>
          <label htmlFor="targetCount" className="block text-sm font-medium text-gray-900 mb-2">
            Target Valid Emails
          </label>
          <input
            type="number"
            id="targetCount"
            value={targetCount}
            onChange={(e) => setTargetCount(parseInt(e.target.value) || 0)}
            min={1}
            max={10000}
            disabled={isRunning}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 bg-white disabled:bg-gray-100"
          />
          <p className="text-xs text-gray-500 mt-1">System will generate and verify until it gets this many valid emails (max 10,000)</p>
        </div>

        {/* Country Selection */}
        <div>
          <label htmlFor="country" className="block text-sm font-medium text-gray-900 mb-2">
            Country
          </label>
          <select
            id="country"
            value={country}
            onChange={(e) => setCountry(e.target.value as Country)}
            disabled={isRunning}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 bg-white disabled:bg-gray-100"
          >
            {countriesList.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Pattern Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Email Pattern
          </label>
          <select
            value={pattern}
            onChange={(e) => setPattern(e.target.value as NamePattern)}
            disabled={isRunning || loadingPatterns}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 bg-white disabled:bg-gray-100"
          >
            {loadingPatterns ? (
              <option>Loading patterns...</option>
            ) : patternList.length > 0 ? (
              patternList.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.template} {p.description ? `- ${p.description}` : ''}
                </option>
              ))
            ) : (
              <>
                <option value="firstname.lastname">firstname.lastname</option>
                <option value="firstname_lastname">firstname_lastname</option>
                <option value="firstnamelastname">firstnamelastname</option>
                <option value="f.lastname">f.lastname</option>
                <option value="firstname.l">firstname.l</option>
                <option value="firstname">firstname</option>
                <option value="lastname.firstname">lastname.firstname</option>
              </>
            )}
          </select>
        </div>

        {/* Include Numbers */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="includeNumbers"
            checked={includeNumbers}
            onChange={(e) => setIncludeNumbers(e.target.checked)}
            disabled={isRunning}
            className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 disabled:opacity-50"
          />
          <label htmlFor="includeNumbers" className="text-sm font-medium text-gray-900">
            Include random numbers (1-999)
          </label>
        </div>

        {/* Gender & Age */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Gender
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender)}
              disabled={isRunning}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 bg-white disabled:bg-gray-100"
            >
              <option value="any">Any</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Age Range
            </label>
            <select
              value={ageRange}
              onChange={(e) => setAgeRange(e.target.value as AgeRange)}
              disabled={isRunning}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 bg-white disabled:bg-gray-100"
            >
              <option value="18-25">18-25</option>
              <option value="26-35">26-35</option>
              <option value="36-45">36-45</option>
              <option value="46-55">46-55</option>
              <option value="56+">56+</option>
            </select>
          </div>
        </div>

        {/* Provider Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-3">
            Email Providers ({selectedProviders.length} selected)
          </label>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
            {providerList.map((provider) => (
              <button
                key={provider.domain}
                type="button"
                onClick={() => toggleProvider(provider.domain)}
                disabled={isRunning}
                className={`p-2 text-left text-sm rounded-md transition-colors ${
                  selectedProviders.includes(provider.domain)
                    ? 'bg-emerald-100 border-2 border-emerald-500 text-emerald-900'
                    : 'bg-gray-50 border border-gray-300 text-gray-700 hover:bg-gray-100'
                } disabled:opacity-50`}
              >
                {provider.domain}
              </button>
            ))}
          </div>
        </div>

        {/* Verification Service */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-3">
            Verification Service
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setVerificationService('mailsso')}
              disabled={isRunning}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                verificationService === 'mailsso'
                  ? 'border-emerald-600 bg-emerald-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300'
              } disabled:opacity-50`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900">Mails.so</span>
                {verificationService === 'mailsso' && <span className="text-emerald-600">✓</span>}
              </div>
              <span className="text-xs text-gray-500">Fast & Reliable</span>
            </button>

            <button
              type="button"
              onClick={() => setVerificationService('emaillistverify')}
              disabled={isRunning}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                verificationService === 'emaillistverify'
                  ? 'border-emerald-600 bg-emerald-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300'
              } disabled:opacity-50`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900">EmailListVerify</span>
                {verificationService === 'emaillistverify' && <span className="text-emerald-600">✓</span>}
              </div>
              <span className="text-xs text-gray-500">Detailed Results</span>
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isRunning || selectedProviders.length === 0}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          {isRunning ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generating & Verifying...
            </span>
          ) : (
            '🚀 Start Generation Job'
          )}
        </button>
      </form>

      <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
        <h3 className="text-sm font-semibold text-emerald-900 mb-2">Job Features:</h3>
        <ul className="text-xs text-gray-700 space-y-1">
          <li>✓ Generates emails in batches of 100</li>
          <li>✓ Verifies in batches of 50 (cache-first)</li>
          <li>✓ Stops when target valid count reached</li>
          <li>✓ Resumable from checkpoints</li>
          <li>✓ Real-time progress streaming</li>
        </ul>
      </div>
    </div>
  );
}
