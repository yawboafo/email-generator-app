'use client';

import { useState, useEffect } from 'react';
import { EXAMPLE_PROMPTS, getSupportedCountriesCount } from '@/lib/aiEmailGenerator';
import allCountries from '@/data/countries.json';
import providers from '@/data/providers.json';

interface AIEmailGeneratorProps {
  onGenerate: (emails: string[], meta: any) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export default function AIEmailGenerator({ onGenerate, isLoading, setIsLoading }: AIEmailGeneratorProps) {
  const [prompt, setPrompt] = useState<string>('');
  const [count, setCount] = useState<number>(100);
  const [selectedProviders, setSelectedProviders] = useState<string[]>(['gmail.com', 'yahoo.com', 'outlook.com']);
  const [error, setError] = useState<string>('');
  const [showExamples, setShowExamples] = useState<boolean>(false);
  const [countriesCount, setCountriesCount] = useState<number>(0);
  const [showCountries, setShowCountries] = useState<boolean>(false);
  const countries = allCountries as Array<{ code: string; name: string }>;

  const providerList = providers as Array<{ id: string; name: string; domain: string }>;

  useEffect(() => {
    setCountriesCount(getSupportedCountriesCount());
  }, []);

  const handleProviderToggle = (domain: string) => {
    setSelectedProviders(prev => 
      prev.includes(domain) 
        ? prev.filter(p => p !== domain)
        : [...prev, domain]
    );
  };

  const handleExampleClick = (examplePrompt: string) => {
    setPrompt(examplePrompt);
    setShowExamples(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!prompt.trim()) {
      setError('Please enter a prompt describing the emails you want to generate');
      return;
    }

    if (count < 1 || count > 500000) {
      setError('Count must be between 1 and 500,000');
      return;
    }

    if (selectedProviders.length === 0) {
      setError('Please select at least one email provider');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/ai-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          count,
          providers: selectedProviders
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate emails');
      }

      const data = await response.json();
      
      // Show some context information
      if (data.contexts && data.contexts.length > 0) {
        console.log('AI Generation Contexts (sample):', data.contexts);
      }
      
      onGenerate(data.emails, {
        ...data.meta,
        mode: 'ai',
        contexts: data.contexts
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-lg shadow-md border-2 border-purple-200">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-purple-600">🤖</span>
          AI Email Generator
        </h2>
        <span className="text-xs bg-purple-600 text-white px-3 py-1 rounded-full font-semibold">
          ULTRA SMART
        </span>
      </div>

      {/* Global Coverage Stats */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 rounded-lg text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold">Worldwide Coverage</p>
            <p className="text-sm opacity-90">All countries supported via authentic data and smart fallback</p>
            <p className="text-xs opacity-80 mt-1">Currently {countriesCount}+ with built-in support for any country name</p>
          </div>
          <div className="text-4xl">🌍</div>
        </div>
      </div>

      {/* Browse All Countries */}
      <div className="bg-white p-4 rounded-lg border border-purple-200">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-800">Browse all countries (~195)</p>
          <button
            type="button"
            onClick={() => setShowCountries(!showCountries)}
            className="text-sm text-purple-600 hover:text-purple-800 font-medium"
          >
            {showCountries ? '✕ Hide' : '🌐 Show'}
          </button>
        </div>
        {showCountries && (
          <div className="mt-3 max-h-64 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {countries.map((c) => (
                <span key={c.code} className="text-xs text-gray-700 px-2 py-1 border rounded">
                  {c.name}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Tip: You can type any country name in your prompt (e.g., "Generate emails for bankers in Albania").
            </p>
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded-lg border border-purple-200">
        <p className="text-sm text-gray-700 mb-2">
          ✨ Describe the type of emails you want, and our AI will generate ultra-realistic emails using advanced patterns, 
          alphabets, numbers, and special characters.
        </p>
        <p className="text-xs text-purple-600 font-medium">
          Example: "Generate emails for French bankers" or "Create emails for Japanese developers"
        </p>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* AI Prompt */}
      <div>
        <label htmlFor="prompt" className="block text-sm font-medium text-gray-900 mb-2">
          AI Prompt <span className="text-red-500">*</span>
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the type of emails you want to generate..."
          rows={4}
          className="w-full px-4 py-3 border-2 border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white placeholder-gray-400"
          disabled={isLoading}
        />
        
        <button
          type="button"
          onClick={() => setShowExamples(!showExamples)}
          className="mt-2 text-sm text-purple-600 hover:text-purple-800 font-medium"
        >
          {showExamples ? '✕ Hide' : '💡 Show'} Example Prompts
        </button>

        {showExamples && (
          <div className="mt-3 bg-purple-50 p-4 rounded-lg border border-purple-200 max-h-60 overflow-y-auto">
            <p className="text-xs font-semibold text-purple-800 mb-2">Click any example to use it:</p>
            <div className="space-y-2">
              {EXAMPLE_PROMPTS.map((example, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleExampleClick(example)}
                  className="block w-full text-left text-sm text-gray-700 hover:bg-purple-100 px-3 py-2 rounded transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Count */}
      <div>
        <label htmlFor="ai-count" className="block text-sm font-medium text-gray-900 mb-2">
          Number of Emails
        </label>
        <input
          type="number"
          id="ai-count"
          min="1"
          max="500000"
          value={count}
          onChange={(e) => setCount(parseInt(e.target.value) || 1)}
          className="w-full px-3 py-2 border-2 border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
          disabled={isLoading}
        />
        <p className="text-xs text-gray-500 mt-1">Max: 500,000 emails per request</p>
      </div>

      {/* Email Providers */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          Email Providers
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {providerList.map((provider) => (
            <label
              key={provider.id}
              className={`flex items-center space-x-2 p-2 border-2 rounded cursor-pointer transition-all ${
                selectedProviders.includes(provider.domain)
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedProviders.includes(provider.domain)}
                onChange={() => handleProviderToggle(provider.domain)}
                className="rounded text-purple-600 focus:ring-purple-500"
                disabled={isLoading}
              />
              <span className="text-sm text-gray-900">{provider.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <button
        type="submit"
        disabled={isLoading || !prompt.trim()}
        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-6 rounded-md hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all font-medium text-lg shadow-lg"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Generating with AI...
          </span>
        ) : (
          '🚀 Generate AI Emails'
        )}
      </button>

      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
        <h3 className="text-sm font-semibold text-purple-900 mb-2">AI Features:</h3>
        <ul className="text-xs text-gray-700 space-y-1">
          <li>✓ Context-aware generation from natural language prompts</li>
          <li>✓ Intelligent use of alphabets, numbers, and special characters</li>
          <li>✓ Multiple generation styles: professional, casual, creative, random</li>
          <li>✓ Age-appropriate patterns and naming conventions</li>
          <li>✓ Theme detection (tech, business, creative, nature, etc.)</li>
          <li>✓ Leet speak and modern naming patterns</li>
          <li>✓ Guaranteed unique and realistic email addresses</li>
        </ul>
      </div>
    </form>
  );
}
