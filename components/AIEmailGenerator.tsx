'use client';

import { useState, useEffect } from 'react';
import { EXAMPLE_PROMPTS, getSupportedCountriesCount } from '@/lib/aiEmailGenerator';
import allCountries from '@/data/countries.json';
import type { GenerationMethod, Provider } from '@/types';

interface AIEmailGeneratorProps {
  onGenerate: (emails: string[], meta: any) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export default function AIEmailGenerator({ onGenerate, isLoading, setIsLoading }: AIEmailGeneratorProps) {
  const [prompt, setPrompt] = useState<string>('');
  const [count, setCount] = useState<number>(100);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [providerList, setProviderList] = useState<Provider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [error, setError] = useState<string>('');
  const [showExamples, setShowExamples] = useState<boolean>(false);
  const [countriesCount, setCountriesCount] = useState<number>(0);
  const [showCountries, setShowCountries] = useState<boolean>(false);
  const [generationMethod, setGenerationMethod] = useState<GenerationMethod>('pattern');
  const [providersExpanded, setProvidersExpanded] = useState(false);
  const countries = allCountries as Array<{ code: string; name: string }>;

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
          providers: selectedProviders,
          method: generationMethod
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

      {/* Generation Method Selection */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          🤖 AI Generation Method
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
            generationMethod === 'pattern' 
              ? 'border-blue-500 bg-white shadow-md' 
              : 'border-gray-200 bg-white hover:border-blue-300'
          }`}>
            <input
              type="radio"
              name="generationMethod"
              value="pattern"
              checked={generationMethod === 'pattern'}
              onChange={(e) => setGenerationMethod(e.target.value as GenerationMethod)}
              className="mt-1 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="font-semibold text-gray-900">Pattern-Based (Original)</div>
              <div className="text-xs text-gray-600 mt-1">
                Fast, reliable generation using our original prompt-based system
              </div>
            </div>
          </label>

          <label className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
            generationMethod === 'deepseek' 
              ? 'border-purple-500 bg-white shadow-md' 
              : 'border-gray-200 bg-white hover:border-purple-300'
          }`}>
            <input
              type="radio"
              name="generationMethod"
              value="deepseek"
              checked={generationMethod === 'deepseek'}
              onChange={(e) => setGenerationMethod(e.target.value as GenerationMethod)}
              className="mt-1 text-purple-600 focus:ring-purple-500"
            />
            <div className="flex-1">
              <div className="font-semibold text-gray-900">DeepSeek AI</div>
              <div className="text-xs text-gray-600 mt-1">
                AI-powered creative email generation with natural variations
              </div>
            </div>
          </label>

          <label className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
            generationMethod === 'openai' 
              ? 'border-green-500 bg-white shadow-md' 
              : 'border-gray-200 bg-white hover:border-green-300'
          }`}>
            <input
              type="radio"
              name="generationMethod"
              value="openai"
              checked={generationMethod === 'openai'}
              onChange={(e) => setGenerationMethod(e.target.value as GenerationMethod)}
              className="mt-1 text-green-600 focus:ring-green-500"
            />
            <div className="flex-1">
              <div className="font-semibold text-gray-900">OpenAI</div>
              <div className="text-xs text-gray-600 mt-1">
                GPT-powered intelligent email creation with context awareness
              </div>
            </div>
          </label>
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
              <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
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
                  className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                >
                  {selectedProviders.length === providerList.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>
            {loadingProviders ? (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                <p className="text-sm text-gray-600 mt-2">Loading providers...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                {providerList.map((provider) => (
                  <label
                    key={provider.domain}
                    className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-gray-50"
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
            )}
          </div>
        )}
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
