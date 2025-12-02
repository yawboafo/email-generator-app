'use client';

import { useState } from 'react';

interface RealEmailFinderProps {
  onEmailsFound: (emails: string[]) => void;
}

type FinderMethod = 'scraper' | 'hunter' | 'apollo' | 'rocketreach';
type ScraperAction = 'url' | 'domain' | 'batch';
type FinderAction = 'domain-search' | 'people-search' | 'person-lookup';

export default function RealEmailFinder({ onEmailsFound }: RealEmailFinderProps) {
  const [method, setMethod] = useState<FinderMethod>('scraper');
  const [action, setAction] = useState<ScraperAction | FinderAction>('url');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const [apiKey, setApiKey] = useState('');
  const [url, setUrl] = useState('');
  const [domain, setDomain] = useState('');
  const [urls, setUrls] = useState('');
  const [maxPages, setMaxPages] = useState(10);
  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [name, setName] = useState('');
  const [jobTitles, setJobTitles] = useState('');
  const [location, setLocation] = useState('');

  const handleScrape = async () => {
    setError('');
    setLoading(true);
    setResult(null);

    try {
      const body: any = { maxPages };

      if (action === 'url') {
        if (!url) throw new Error('Please enter a URL');
        body.url = url;
      } else if (action === 'domain') {
        if (!domain) throw new Error('Please enter a domain');
        body.domain = domain;
      } else if (action === 'batch') {
        if (!urls) throw new Error('Please enter URLs');
        body.urls = urls.split('\n').filter((u: string) => u.trim());
      }

      const response = await fetch('/api/scrape-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Scraping failed');
      }

      setResult(data);
      if (data.emails && data.emails.length > 0) {
        onEmailsFound(data.emails);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleFindEmails = async () => {
    setError('');
    setLoading(true);
    setResult(null);

    try {
      if (!apiKey) throw new Error('Please enter your API key');

      const body: any = {
        service: method,
        action,
        apiKey,
      };

      if (action === 'domain-search') {
        if (!domain) throw new Error('Please enter a domain');
        body.domain = domain;
      } else if (action === 'people-search') {
        if (!companyName && !domain) throw new Error('Please enter company name or domain');
        body.companyName = companyName;
        body.companyDomain = domain;
        if (jobTitles) body.jobTitles = jobTitles.split(',').map((t: string) => t.trim());
        if (location) body.location = location.split(',').map((l: string) => l.trim());
      } else if (action === 'person-lookup') {
        if (method === 'rocketreach') {
          if (!name) throw new Error('Please enter person name');
          body.name = name;
        } else {
          if (!firstName || !lastName) throw new Error('Please enter first and last name');
          body.firstName = firstName;
          body.lastName = lastName;
        }
        if (domain) body.domain = domain;
        if (companyName) body.companyName = companyName;
      }

      const response = await fetch('/api/find-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Finding emails failed');
      }

      setResult(data);
      if (data.emails && data.emails.length > 0) {
        onEmailsFound(data.emails);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (method === 'scraper') {
      handleScrape();
    } else {
      handleFindEmails();
    }
  };

  const copyEmails = () => {
    if (result?.emails) {
      navigator.clipboard.writeText(result.emails.join('\n'));
      alert(`Copied ${result.emails.length} emails to clipboard`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-bold text-slate-900 mb-3">
          Choose Method
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { id: 'scraper', name: 'Web Scraper', icon: '🕷️', badge: 'Free' },
            { id: 'hunter', name: 'Hunter.io', icon: '🎯', badge: '25 free/mo' },
            { id: 'apollo', name: 'Apollo.io', icon: '🚀', badge: '50 free/mo' },
            { id: 'rocketreach', name: 'RocketReach', icon: '🔍', badge: '10 free/mo' },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id as FinderMethod)}
              className={`p-4 rounded-xl border-2 transition-all text-left relative ${
                method === m.id
                  ? 'border-indigo-600 bg-indigo-50 shadow-md'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="text-2xl mb-1">{m.icon}</div>
              <div className="font-semibold text-sm text-slate-900">{m.name}</div>
              <div className="text-xs text-slate-500 mt-1">{m.badge}</div>
              {method === m.id && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {method === 'scraper' ? (
        <div>
          <label className="block text-sm font-bold text-slate-900 mb-3">
            Scraper Action
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAction('url')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                action === 'url'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Single URL
            </button>
            <button
              type="button"
              onClick={() => setAction('domain')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                action === 'domain'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Whole Domain
            </button>
            <button
              type="button"
              onClick={() => setAction('batch')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                action === 'batch'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Batch URLs
            </button>
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-bold text-slate-900 mb-3">
            Search Type
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAction('domain-search')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                action === 'domain-search'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Domain Search
            </button>
            <button
              type="button"
              onClick={() => setAction('people-search')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                action === 'people-search'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              People Search
            </button>
            <button
              type="button"
              onClick={() => setAction('person-lookup')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                action === 'person-lookup'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Person Lookup
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {method !== 'scraper' && (
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              {method === 'hunter' ? 'Hunter.io' : method === 'apollo' ? 'Apollo.io' : 'RocketReach'} API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
            />
            <p className="text-xs text-slate-500 mt-1">
              Get your API key from {method === 'hunter' ? 'hunter.io' : method === 'apollo' ? 'apollo.io' : 'rocketreach.co'}
            </p>
          </div>
        )}

        {method === 'scraper' && action === 'url' && (
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Website URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/contact"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
            />
          </div>
        )}

        {method === 'scraper' && action === 'domain' && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Domain
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Max Pages to Scrape
              </label>
              <input
                type="number"
                value={maxPages}
                onChange={(e) => setMaxPages(parseInt(e.target.value) || 10)}
                min="1"
                max="50"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              />
            </div>
          </>
        )}

        {method === 'scraper' && action === 'batch' && (
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              URLs (one per line)
            </label>
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              rows={6}
              placeholder={"https://example.com/page1\nhttps://example.com/page2"}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent font-mono text-sm"
            />
          </div>
        )}

        {method !== 'scraper' && action === 'domain-search' && (
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Company Domain
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
            />
          </div>
        )}

        {method !== 'scraper' && action === 'people-search' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Google"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Domain (optional)
                </label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="google.com"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Job Titles (comma-separated)
              </label>
              <input
                type="text"
                value={jobTitles}
                onChange={(e) => setJobTitles(e.target.value)}
                placeholder="CEO, CTO, VP Engineering"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Location (optional)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="San Francisco, CA"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              />
            </div>
          </>
        )}

        {method !== 'scraper' && action === 'person-lookup' && (
          <>
            {method === 'rocketreach' ? (
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Google"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Domain (optional)
                </label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="google.com"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                />
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-400 disabled:to-slate-400 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {method === 'scraper' ? 'Scraping...' : 'Finding...'}
            </span>
          ) : (
            `${method === 'scraper' ? 'Scrape' : 'Find'} Real Emails`
          )}
        </button>
      </form>

      {result && (
        <div className="mt-6 p-6 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900">
              ✅ Found {result.count} Real Emails
            </h3>
            {result.emails && result.emails.length > 0 && (
              <button
                onClick={copyEmails}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition"
              >
                Copy All
              </button>
            )}
          </div>

          {result.pagesScraped && (
            <p className="text-sm text-slate-600 mb-2">
              Scraped {result.pagesScraped} page(s)
            </p>
          )}

          {result.pattern && (
            <p className="text-sm text-slate-600 mb-2">
              Email Pattern: <code className="bg-white px-2 py-1 rounded">{result.pattern}</code>
            </p>
          )}

          {result.organization && (
            <p className="text-sm text-slate-600 mb-4">
              Organization: <strong>{result.organization}</strong>
            </p>
          )}

          {result.emails && result.emails.length > 0 && (
            <div className="mt-4 bg-white rounded-lg p-4 max-h-96 overflow-y-auto">
              <div className="space-y-1">
                {result.emails.map((email: string, idx: number) => (
                  <div key={idx} className="font-mono text-sm text-slate-700 py-1 border-b border-slate-100 last:border-0">
                    {email}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.errors && result.errors.length > 0 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm font-medium text-amber-800 mb-2">⚠️ Some pages failed:</p>
              <ul className="text-xs text-amber-700 space-y-1">
                {result.errors.slice(0, 5).map((err: string, idx: number) => (
                  <li key={idx}>• {err}</li>
                ))}
                {result.errors.length > 5 && (
                  <li>• ... and {result.errors.length - 5} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
