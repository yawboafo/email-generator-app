'use client';

import { useState } from 'react';
import type { 
  Country, 
  Gender, 
  AgeRange, 
  NamePattern, 
  Provider,
  GenerateEmailsRequest 
} from '@/types';
import providers from '@/data/providers.json';

interface EmailFormProps {
  onGenerate: (emails: string[], meta: any, params?: any) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export default function EmailForm({ onGenerate, isLoading, setIsLoading }: EmailFormProps) {
  const [count, setCount] = useState<number>(50);
  const [selectedProviders, setSelectedProviders] = useState<string[]>(['gmail.com', 'yahoo.com', 'outlook.com']);
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

  const providerList = providers as Provider[];

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
        }
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
        throw new Error(errorData.error || errorData.message || 'Failed to generate emails');
      }

      const data = await response.json();
      onGenerate(data.emails, data.meta, { country, pattern, providers: selectedProviders });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900 tracking-tight mb-6">Email Generator</h2>
      
      {error && (
        <div className="bg-red-50/50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Count */}
      <div>
        <label htmlFor="count" className="block text-sm font-medium text-slate-700 mb-2">
          Number of Emails
        </label>
        <input
          type="number"
          id="count"
          min="1"
          max="500000"
          value={count}
          onChange={(e) => setCount(parseInt(e.target.value) || 1)}
          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-slate-900 bg-white transition-all duration-200"
        />
        <p className="text-xs text-slate-500 mt-2">Max: 500,000 emails per request</p>
      </div>

      {/* Email Providers */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Email Providers
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {providerList.map((provider) => (
            <label
              key={provider.id}
              className="flex items-center gap-2 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-indigo-300 transition-all duration-200"
            >
              <input
                type="checkbox"
                checked={selectedProviders.includes(provider.domain)}
                onChange={() => handleProviderToggle(provider.domain)}
                className="rounded text-indigo-600 focus:ring-indigo-600 focus:ring-2"
              />
              <span className="text-sm text-slate-700">{provider.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Demographics Section */}
      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4">Demographics</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Country */}
          <div>
            <label htmlFor="country" className="block text-sm font-medium text-slate-700 mb-2">
              Country / Region
            </label>
            <select
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value as Country)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-slate-900 bg-white transition-all duration-200"
            >
              <option value="US">United States</option>
              <option value="GH">Ghana</option>
              <option value="UK">United Kingdom</option>
              <option value="NG">Nigeria</option>
              <option value="IN">India</option>
              <option value="CA">Canada</option>
            </select>
          </div>

          {/* Age Range */}
          <div>
            <label htmlFor="ageRange" className="block text-sm font-medium text-slate-700 mb-2">
              Age Range
            </label>
            <select
              id="ageRange"
              value={ageRange}
              onChange={(e) => setAgeRange(e.target.value as AgeRange)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-slate-900 bg-white transition-all duration-200"
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
            <label htmlFor="gender" className="block text-sm font-medium text-slate-700 mb-2">
              Gender
            </label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-slate-900 bg-white transition-all duration-200"
            >
              <option value="any">Any</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>
        </div>

        {/* Interests */}
        <div className="mt-4">
          <label htmlFor="interests" className="block text-sm font-medium text-slate-700 mb-2">
            Interests (comma-separated, optional)
          </label>
          <input
            type="text"
            id="interests"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="e.g., music, tech, sports, gaming"
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-slate-900 bg-white placeholder-slate-400 transition-all duration-200"
          />
        </div>
      </div>

      {/* Format Rules Section */}
      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4">Format Rules</h3>
        
        {/* Name Pattern */}
        <div className="mb-4">
          <label htmlFor="pattern" className="block text-sm font-medium text-slate-700 mb-2">
            Name Pattern
          </label>
          <select
            id="pattern"
            value={pattern}
            onChange={(e) => setPattern(e.target.value as NamePattern)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-slate-900 bg-white transition-all duration-200"
          >
            <optgroup label="Name-Based">
              <option value="firstname.lastname">firstname.lastname</option>
              <option value="firstnamelastname">firstnamelastname</option>
              <option value="firstinitiallastname">firstinitiallastname</option>
              <option value="firstname_lastname">firstname_lastname</option>
              <option value="firstnamelastinitial">firstnamelastinitial</option>
            </optgroup>
            <optgroup label="Creative">
              <option value="nickname">nickname (interests)</option>
              <option value="petname">petname (buddy, max, luna)</option>
              <option value="hobby">hobby (gamer, artist, coder)</option>
              <option value="city">city (newyork, london, tokyo)</option>
            </optgroup>
            <optgroup label="Combinations">
              <option value="firstname_pet">firstname + pet</option>
              <option value="firstname_city">firstname + city</option>
              <option value="firstname_hobby">firstname + hobby</option>
              <option value="adjective_noun">adjective + noun (coolstar)</option>
              <option value="color_thing">color + thing (bluemoon)</option>
              <option value="thing_year">thing + year (dragon2000)</option>
            </optgroup>
          </select>
        </div>

        {/* Include Numbers */}
        <div className="mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeNumbers}
              onChange={(e) => setIncludeNumbers(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-600 focus:ring-2"
            />
            <span className="text-sm font-medium text-slate-700">Include random numbers</span>
          </label>
          
          {includeNumbers && (
            <div className="mt-3 flex items-center gap-4">
              <div className="flex-1">
                <label htmlFor="minNumber" className="block text-xs text-slate-700 mb-1 font-medium">
                  Min
                </label>
                <input
                  type="number"
                  id="minNumber"
                  value={minNumber}
                  onChange={(e) => setMinNumber(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-slate-900 bg-white transition-all duration-200"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="maxNumber" className="block text-xs text-slate-700 mb-1 font-medium">
                  Max
                </label>
                <input
                  type="number"
                  id="maxNumber"
                  value={maxNumber}
                  onChange={(e) => setMaxNumber(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-slate-900 bg-white transition-all duration-200"
                />
              </div>
            </div>
          )}
        </div>

        {/* Allowed Characters */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            Allowed Characters
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allowLetters}
                onChange={(e) => setAllowLetters(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-600 focus:ring-2"
              />
              <span className="text-sm text-slate-700">Letters (a-z, A-Z)</span>
            </label>
            <label className="flex items-center gap-2">
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
                className="rounded text-indigo-600 focus:ring-indigo-600 focus:ring-2"
              />
              <span className="text-sm text-slate-700">Underscore (_)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allowDot}
                onChange={(e) => setAllowDot(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-600 focus:ring-2"
              />
              <span className="text-sm text-slate-700">Dot (.)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Generating...
          </span>
        ) : 'Generate Emails'}
      </button>
    </form>
  );
}
