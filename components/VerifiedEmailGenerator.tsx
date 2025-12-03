'use client';

import { useState, useEffect } from 'react';
import type { 
  Country, 
  Gender, 
  AgeRange, 
  NamePattern, 
  Provider 
} from '@/types';
import allCountries from '@/data/countries.json';

interface VerifiedEmailGeneratorProps {
  onGenerate: (emails: string[], meta: any, params?: any) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

interface ProgressState {
  totalGenerated: number;
  totalVerified: number;
  validCount: number;
  invalidCount: number;
  riskyCount: number;
  unknownCount: number;
  progress: number;
}

export default function VerifiedEmailGenerator({ 
  onGenerate, 
  isLoading, 
  setIsLoading 
}: VerifiedEmailGeneratorProps) {
  const [targetCount, setTargetCount] = useState<number>(100);
  const [batchSize, setBatchSize] = useState<number>(50);
  const [verificationService, setVerificationService] = useState<'mailsso' | 'emaillistverify' | 'mailboxlayer' | 'reacher'>('mailsso');
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
  const [countrySearch, setCountrySearch] = useState<string>('');
  const [providersExpanded, setProvidersExpanded] = useState(false);
  
  // Progress tracking
  const [progress, setProgress] = useState<ProgressState>({
    totalGenerated: 0,
    totalVerified: 0,
    validCount: 0,
    invalidCount: 0,
    riskyCount: 0,
    unknownCount: 0,
    progress: 0
  });
  const [timeStarted, setTimeStarted] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  const countriesList = allCountries as Array<{ code: string; name: string }>;
  
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
  }, []);
  
  // Timer for elapsed time
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading && timeStarted) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - timeStarted);
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading, timeStarted]);
  
  const filteredCountries = countriesList.filter(c => 
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const handleProviderToggle = (domain: string) => {
    setSelectedProviders(prev => 
      prev.includes(domain) 
        ? prev.filter(p => p !== domain)
        : [...prev, domain]
    );
  };

  const formatElapsedTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setProgress({
      totalGenerated: 0,
      totalVerified: 0,
      validCount: 0,
      invalidCount: 0,
      riskyCount: 0,
      unknownCount: 0,
      progress: 0
    });

    if (selectedProviders.length === 0) {
      setError('Please select at least one email provider');
      return;
    }

    if (targetCount < 1 || targetCount > 1000) {
      setError('Target count must be between 1 and 1,000');
      return;
    }

    setIsLoading(true);
    setTimeStarted(Date.now());

    try {
      const requestBody = {
        targetCount,
        batchSize,
        verificationService,
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
        }
      };

      const response = await fetch('/api/generate-verified-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.details 
          ? `${errorData.message}\n\n${errorData.details}`
          : errorData.message || errorData.error || 'Failed to generate verified emails';
        throw new Error(errorMessage);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        
        // Process complete messages
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line.startsWith('data: ')) {
            try {
              const message = JSON.parse(line.substring(6));
              
              if (message.type === 'progress') {
                setProgress(message.data);
              } else if (message.type === 'complete') {
                const data = message.data;
                setProgress({
                  totalGenerated: data.progress.totalGenerated,
                  totalVerified: data.progress.totalVerified,
                  validCount: data.progress.validCount,
                  invalidCount: data.progress.invalidCount,
                  riskyCount: data.progress.riskyCount,
                  unknownCount: data.progress.unknownCount,
                  progress: 100
                });
                
                // Pass verified emails to parent
                onGenerate(data.emails, {
                  ...data.meta,
                  progress: data.progress
                }, { 
                  country, 
                  pattern, 
                  providers: selectedProviders,
                  verified: true
                });
              } else if (message.type === 'error') {
                throw new Error(message.data.message);
              }
            } catch (e) {
              console.error('Error parsing SSE message:', e);
            }
          }
        }
        
        // Keep the last incomplete line in buffer
        buffer = lines[lines.length - 1];
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Verified email generation error:', errorMessage);
    } finally {
      setIsLoading(false);
      setTimeStarted(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg shadow-md border border-green-200">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">✅ Generate Verified Emails Only</h2>
        <span className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-full">
          Premium Feature
        </span>
      </div>
      
      <div className="bg-white p-4 rounded-lg border border-green-300">
        <p className="text-sm text-gray-700 leading-relaxed">
          <strong className="text-green-700">How it works:</strong> This feature generates emails in batches, 
          immediately verifies each one using our email verification system, and continues until the exact 
          number of <strong>valid verified emails</strong> is reached. Only deliverable emails are returned.
        </p>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Progress Display */}
      {isLoading && (
        <div className="bg-white p-6 rounded-lg border border-green-300 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Generation Progress</h3>
            <span className="text-sm text-gray-600">{formatElapsedTime(elapsedTime)}</span>
          </div>
          
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">
                Valid Emails Collected: {progress.validCount} / {targetCount}
              </span>
              <span className="text-sm font-medium text-green-600">
                {Math.round((progress.validCount / targetCount) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-green-500 to-emerald-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((progress.validCount / targetCount) * 100, 100)}%` }}
              />
            </div>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="text-xs text-blue-600 font-medium mb-1">Generated</div>
              <div className="text-2xl font-bold text-blue-700">{progress.totalGenerated}</div>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
              <div className="text-xs text-purple-600 font-medium mb-1">Verified</div>
              <div className="text-2xl font-bold text-purple-700">{progress.totalVerified}</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <div className="text-xs text-green-600 font-medium mb-1">Valid ✓</div>
              <div className="text-2xl font-bold text-green-700">{progress.validCount}</div>
            </div>
            <div className="bg-red-50 p-3 rounded-lg border border-red-200">
              <div className="text-xs text-red-600 font-medium mb-1">Invalid ✗</div>
              <div className="text-2xl font-bold text-red-700">{progress.invalidCount}</div>
            </div>
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
              <div className="text-xs text-amber-600 font-medium mb-1">Risky ⚠</div>
              <div className="text-2xl font-bold text-amber-700">{progress.riskyCount}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-600 font-medium mb-1">Unknown ?</div>
              <div className="text-2xl font-bold text-gray-700">{progress.unknownCount}</div>
            </div>
          </div>
          
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Generating and verifying emails...</span>
          </div>
        </div>
      )}

      {/* Target Count */}
      <div>
        <label htmlFor="targetCount" className="block text-sm font-medium text-gray-900 mb-2">
          Target Number of Valid Emails
        </label>
        <input
          type="number"
          id="targetCount"
          min="1"
          max="1000"
          value={targetCount}
          onChange={(e) => setTargetCount(parseInt(e.target.value) || 1)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white"
          disabled={isLoading}
        />
        <p className="text-xs text-gray-500 mt-1">Max: 1,000 verified emails per request</p>
      </div>

      {/* Batch Size */}
      <div>
        <label htmlFor="batchSize" className="block text-sm font-medium text-gray-900 mb-2">
          Batch Size (emails to generate per batch)
        </label>
        <input
          type="number"
          id="batchSize"
          min="10"
          max="200"
          value={batchSize}
          onChange={(e) => setBatchSize(parseInt(e.target.value) || 50)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white"
          disabled={isLoading}
        />
        <p className="text-xs text-gray-500 mt-1">Higher batch sizes are faster but use more API calls</p>
      </div>

      {/* Verification Service Selector */}
      <div>
        <label htmlFor="verificationService" className="block text-sm font-medium text-gray-900 mb-2">
          Email Verification Service
        </label>
        <select
          id="verificationService"
          value={verificationService}
          onChange={(e) => setVerificationService(e.target.value as any)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white"
          disabled={isLoading}
        >
          <option value="mailsso">Mails.so (Bulk API - Fastest) ⚡</option>
          <option value="emaillistverify">EmailListVerify (Cloud)</option>
          <option value="mailboxlayer">Mailboxlayer (Cloud)</option>
          <option value="reacher">Reacher (Self-hosted - Requires Docker) 🐳</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          {verificationService === 'mailsso' && '✅ Supports bulk verification (50 emails/request)'}
          {verificationService === 'emaillistverify' && '☁️ Cloud-based, good accuracy'}
          {verificationService === 'mailboxlayer' && '☁️ Cloud-based with SMTP checks'}
          {verificationService === 'reacher' && '⚠️ Requires Docker running on port 8080'}
        </p>
      </div>

      {/* Email Providers */}
      <div className="border rounded-lg bg-white">
        <button
          type="button"
          onClick={() => setProvidersExpanded(!providersExpanded)}
          disabled={isLoading}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">
              Email Providers
            </span>
            {selectedProviders.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                {selectedProviders.length} selected
              </span>
            )}
          </div>
          <svg 
            className={`w-5 h-5 text-gray-500 transition-transform ${providersExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {providersExpanded && (
          <div className="px-4 pb-4 border-t">
            <div className="flex items-center justify-between mb-3 mt-3">
              <span className="text-xs text-gray-600">
                Select email domains for generation
              </span>
              {providerList.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedProviders.length === providerList.length) {
                      setSelectedProviders([]);
                    } else {
                      setSelectedProviders(providerList.map(p => p.domain));
                    }
                  }}
                  disabled={isLoading}
                  className="text-xs text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                >
                  {selectedProviders.length === providerList.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
              {providerList.map((provider) => (
                <label
                  key={`provider-${provider.id}-${provider.domain}`}
                  className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedProviders.includes(provider.domain)}
                    onChange={() => handleProviderToggle(provider.domain)}
                    disabled={isLoading}
                    className="rounded text-green-600 focus:ring-green-500 disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-900">{provider.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Demographics Section */}
      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Demographics</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Country */}
          <div>
            <label htmlFor="country" className="block text-sm font-medium text-gray-900 mb-2">
              Country / Region
            </label>
            <select
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value as Country)}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white disabled:opacity-50"
            >
              {countriesList.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Age Range */}
          <div>
            <label htmlFor="ageRange" className="block text-sm font-medium text-gray-900 mb-2">
              Age Range
            </label>
            <select
              id="ageRange"
              value={ageRange}
              onChange={(e) => setAgeRange(e.target.value as AgeRange)}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white disabled:opacity-50"
            >
              <option value="18-25">18-25</option>
              <option value="26-35">26-35</option>
              <option value="36-45">36-45</option>
              <option value="46-60">46-60</option>
              <option value="60+">60+</option>
            </select>
          </div>

          {/* Gender */}
          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-gray-900 mb-2">
              Gender
            </label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender)}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white disabled:opacity-50"
            >
              <option value="any">Any</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>

          {/* Name Pattern */}
          <div>
            <label htmlFor="pattern" className="block text-sm font-medium text-gray-900 mb-2">
              Name Pattern
            </label>
            <select
              id="pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value as NamePattern)}
              disabled={isLoading || loadingPatterns}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white disabled:opacity-50"
            >
              {patternList.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-3 px-4 rounded-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 shadow-lg"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Generating & Verifying...
          </span>
        ) : (
          '✅ Generate Verified Emails'
        )}
      </button>
    </form>
  );
}
