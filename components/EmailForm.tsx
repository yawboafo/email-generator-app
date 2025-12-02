'use client';

import { useState, useEffect } from 'react';
import type { 
  Country, 
  Gender, 
  AgeRange, 
  NamePattern, 
  Provider,
  GenerateEmailsRequest 
} from '@/types';
import allCountries from '@/data/countries.json';

interface EmailFormProps {
  onGenerate: (emails: string[], meta: any, params?: any) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export default function EmailForm({ onGenerate, isLoading, setIsLoading }: EmailFormProps) {
  const [count, setCount] = useState<number>(50);
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

  const countriesList = allCountries as Array<{ code: string; name: string }>;
  
  // Fetch providers from database
  useEffect(() => {
    async function fetchProviders() {
      try {
        const res = await fetch('/api/providers');
        const data = await res.json();
        if (data.providers && data.providers.length > 0) {
          setProviderList(data.providers);
          // Auto-select top 3 providers by default
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
          // Set default pattern if current one doesn't exist
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

    setIsLoading(true);

    try {
      const requestBody: GenerateEmailsRequest = {
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
      };

      const response = await fetch('/api/generate-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Combine error message and details for better user visibility
        const errorMessage = errorData.details 
          ? `${errorData.message}\n\n${errorData.details}`
          : errorData.message || errorData.error || 'Failed to generate emails';
        throw new Error(errorMessage);
      }

      const data = await response.json();
      onGenerate(data.emails, data.meta, { country, pattern, providers: selectedProviders });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Email generation error:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Email Generator</h2>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
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
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
        />
        <p className="text-xs text-gray-500 mt-1">Max: 500,000 emails per request</p>
      </div>

      {/* Email Providers */}
      <div className="border rounded-lg">
        <button
          type="button"
          onClick={() => setProvidersExpanded(!providersExpanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">
              Email Providers
            </span>
            {loadingProviders && <span className="text-xs text-gray-400">(loading...)</span>}
            {selectedProviders.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
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
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {selectedProviders.length === providerList.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>
            {providerList.length === 0 && !loadingProviders && (
              <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-3">
                ⚠️ No providers found. Please import providers from the admin panel first.
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
              {providerList.map((provider) => (
                <label
                  key={provider.id}
                  className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedProviders.includes(provider.domain)}
                    onChange={() => handleProviderToggle(provider.domain)}
                    className="rounded text-blue-600 focus:ring-blue-500"
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Country */}
          <div>
            <label htmlFor="country" className="block text-sm font-medium text-gray-900 mb-2">
              Country / Region
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search countries..."
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white mb-1"
              />
              <select
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value as Country)}
                size={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white overflow-y-auto"
              >
                {filteredCountries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Selected: {countriesList.find(c => c.code === country)?.name || country}
              </p>
            </div>
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            >
              <option value="any">Any</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>
        </div>
        
        {/* Country Impact Notice */}
        <div className="mt-4 bg-blue-50 border border-blue-200 p-3 rounded-md">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">🌍 Country Impact:</span> Emails will use authentic names, surnames, and patterns from <span className="font-bold">{countriesList.find(c => c.code === country)?.name || country}</span>.
          </p>
        </div>

        {/* Interests */}
        <div className="mt-4">
          <label htmlFor="interests" className="block text-sm font-medium text-gray-900 mb-2">
            Interests (comma-separated, optional)
          </label>
          <input
            type="text"
            id="interests"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="e.g., music, tech, sports, gaming"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white placeholder-gray-400"
          />
        </div>
      </div>

      {/* Format Rules Section */}
      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Format Rules</h3>
        
        {/* Name Pattern */}
        <div className="mb-4">
          <label htmlFor="pattern" className="block text-sm font-medium text-gray-900 mb-2">
            Name Pattern {loadingPatterns && <span className="text-xs text-gray-400">(loading...)</span>}
          </label>
          <select
            id="pattern"
            value={pattern}
            onChange={(e) => setPattern(e.target.value as NamePattern)}
            disabled={loadingPatterns}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white disabled:bg-gray-100"
          >
            {loadingPatterns ? (
              <option value="">Loading patterns...</option>
            ) : patternList.length === 0 ? (
              <option value="">No patterns available</option>
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
                    <option key={p.name} value={p.name} title={p.description}>
                      {p.name} {p.description && `— ${p.description}`}
                    </option>
                  ))}
                </optgroup>
              ))
            )}
          </select>
          {!loadingPatterns && patternList.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">⚠️ No patterns found. Please add patterns from the admin panel.</p>
          )}
        </div>

        {/* Include Numbers */}
        <div className="mb-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={includeNumbers}
              onChange={(e) => setIncludeNumbers(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-900">Include random numbers</span>
          </label>
          
          {includeNumbers && (
            <div className="mt-2 flex items-center space-x-4">
              <div className="flex-1">
                <label htmlFor="minNumber" className="block text-xs text-gray-900 mb-1">
                  Min
                </label>
                <input
                  type="number"
                  id="minNumber"
                  value={minNumber}
                  onChange={(e) => setMinNumber(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="maxNumber" className="block text-xs text-gray-900 mb-1">
                  Max
                </label>
                <input
                  type="number"
                  id="maxNumber"
                  value={maxNumber}
                  onChange={(e) => setMaxNumber(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Allowed Characters */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Allowed Characters
          </label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={allowLetters}
                onChange={(e) => setAllowLetters(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-900">Letters (a-z, A-Z)</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={allowNumbers}
                onChange={(e) => setAllowNumbers(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-900">Numbers (0-9)</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={allowUnderscore}
                onChange={(e) => setAllowUnderscore(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-900">Underscore (_)</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={allowDot}
                onChange={(e) => setAllowDot(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-900">Dot (.)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        {isLoading ? 'Generating...' : 'Generate Emails'}
      </button>
    </form>
  );
}
