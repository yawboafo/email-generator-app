'use client';

import { useState, useEffect } from 'react';
import FileUpload from '@/components/FileUpload';
import BulkImportProgress, { ImportProgress } from '@/components/BulkImportProgress';

interface Stats {
  countries: number;
  firstNames: number;
  lastNames: number;
  cities: number;
  emailProviders: number;
  patternElements: number;
  savedEmails: number;
  emailGenerations: number;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

type ImportType = 'countries' | 'firstnames' | 'lastnames' | 'cities' | 'providers' | 'patterns' | 'bulknames';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<ImportType>('bulknames');
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [importMode, setImportMode] = useState<'add' | 'replace'>('add');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [bulkProgress, setBulkProgress] = useState<ImportProgress>({
    stage: 'idle',
    progress: 0,
    total: 0,
    currentBatch: 0,
    totalBatches: 0,
    imported: 0,
    skipped: 0,
    errors: [],
    message: '',
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleBulkImport = async () => {
    if (parsedData.length === 0) {
      alert('Please upload a file first');
      return;
    }

    const BATCH_SIZE = 5000;
    const totalRecords = parsedData.length;
    const totalBatches = Math.ceil(totalRecords / BATCH_SIZE);

    setBulkProgress({
      stage: 'uploading',
      progress: 0,
      total: totalRecords,
      currentBatch: 0,
      totalBatches,
      imported: 0,
      skipped: 0,
      errors: [],
      message: 'Preparing import...',
    });

    setLoading(true);
    let totalImported = 0;
    let totalSkipped = 0;
    const allErrors: string[] = [];

    try {
      for (let i = 0; i < totalBatches; i++) {
        const start = i * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, totalRecords);
        const batch = parsedData.slice(start, end);

        setBulkProgress(prev => ({
          ...prev,
          stage: 'importing',
          currentBatch: i + 1,
          message: `Importing batch ${i + 1} of ${totalBatches}...`,
        }));

        const res = await fetch('/api/admin/import/bulk-names', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: batch,
            mode: importMode,
            batch: i,
            totalRecords,
          }),
        });

        const result = await res.json();
        
        if (!res.ok) {
          throw new Error(result.error || 'Import failed');
        }

        totalImported += result.imported || 0;
        totalSkipped += result.skipped || 0;
        if (result.errors) {
          allErrors.push(...result.errors);
        }

        setBulkProgress(prev => ({
          ...prev,
          progress: end,
          imported: totalImported,
          skipped: totalSkipped,
          errors: allErrors,
        }));
      }

      setBulkProgress(prev => ({
        ...prev,
        stage: 'complete',
        message: 'Import completed successfully!',
      }));

      fetchStats();
      setParsedData([]);
    } catch (error) {
      setBulkProgress(prev => ({
        ...prev,
        stage: 'error',
        message: error instanceof Error ? error.message : 'Import failed',
        errors: [...allErrors, error instanceof Error ? error.message : 'Unknown error'],
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (activeTab === 'bulknames') {
      return handleBulkImport();
    }

    if (parsedData.length === 0) {
      alert('Please upload a file first');
      return;
    }

    setLoading(true);
    setImportResult(null);

    try {
      const res = await fetch(`/api/admin/import/${activeTab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: parsedData, mode: importMode }),
      });

      const result = await res.json();
      setImportResult(result);
      
      if (result.success) {
        fetchStats(); // Refresh stats
        setParsedData([]); // Clear parsed data
      }
    } catch (error) {
      setImportResult({
        success: false,
        imported: 0,
        skipped: 0,
        errors: ['Failed to import: ' + (error instanceof Error ? error.message : 'Unknown error')],
      });
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: ImportType; label: string; description: string }[] = [
    { id: 'bulknames', label: 'Bulk Names (CSV)', description: 'Import large name datasets (philipperemy format)' },
    { id: 'countries', label: 'Countries', description: 'Import country codes and names' },
    { id: 'firstnames', label: 'First Names', description: 'Import first names by country and gender' },
    { id: 'lastnames', label: 'Last Names', description: 'Import surnames by country' },
    { id: 'cities', label: 'Cities', description: 'Import cities with optional population data' },
    { id: 'providers', label: 'Email Providers', description: 'Import email provider configurations' },
    { id: 'patterns', label: 'Patterns', description: 'Import pattern elements (pet names, hobbies, etc.)' },
  ];

  const getFormatExample = (type: ImportType) => {
    const examples = {
      countries: `[
  { "code": "US", "name": "United States" },
  { "code": "UK", "name": "United Kingdom" }
]`,
      firstnames: `[
  { "name": "John", "gender": "male", "countryCode": "US", "frequency": 100 },
  { "name": "Jane", "gender": "female", "countryCode": "US", "frequency": 95 }
]`,
      lastnames: `[
  { "name": "Smith", "countryCode": "US", "frequency": 1000 },
  { "name": "Johnson", "countryCode": "US", "frequency": 950 }
]`,
      cities: `[
  { "name": "New York", "countryCode": "US", "population": 8336817 },
  { "name": "Los Angeles", "countryCode": "US", "population": 3979576 }
]`,
      providers: `[
  { "providerId": "gmail", "name": "Gmail", "domain": "gmail.com", "popularity": 45, "active": true },
  { "providerId": "yahoo", "name": "Yahoo", "domain": "yahoo.com", "popularity": 20, "active": true }
]`,
      patterns: `[
  { "type": "petNames", "value": "luna" },
  { "type": "hobbies", "value": "gamer" }
]`,
      bulknames: `CSV Format (philipperemy/name-dataset):
Headers can be in any language, we use column position:
Column 1: first_name
Column 2: last_name  
Column 3: gender (M/F/empty)
Column 4: country_code (ISO alpha-2)

Example with English headers:
first_name,last_name,gender,country_code
Laure,Canet,F,FR
Louis,Givran,M,FR
Timothy,Dovin,M,FR

Example with any headers (position matters):
اسلامى معلومات,اسلامى معلومات_1,M,AF
Ahmad,Khan,M,AF`,
    };
    return examples[type as keyof typeof examples] || '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Admin Dashboard
              </h1>
              <p className="mt-1 text-sm text-gray-600">Import and manage database records</p>
            </div>
            <a
              href="/"
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              ← Back to App
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="text-sm font-medium text-gray-600">Countries</div>
              <div className="text-3xl font-bold text-indigo-600 mt-2">{stats.countries.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="text-sm font-medium text-gray-600">First Names</div>
              <div className="text-3xl font-bold text-purple-600 mt-2">{stats.firstNames.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="text-sm font-medium text-gray-600">Last Names</div>
              <div className="text-3xl font-bold text-blue-600 mt-2">{stats.lastNames.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="text-sm font-medium text-gray-600">Cities</div>
              <div className="text-3xl font-bold text-green-600 mt-2">{stats.cities.toLocaleString()}</div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200 bg-gray-50">
            <div className="flex overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setParsedData([]);
                    setImportResult(null);
                  }}
                  className={`flex-shrink-0 px-6 py-4 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-600 bg-white'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {tabs.find((t) => t.id === activeTab)?.label}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {tabs.find((t) => t.id === activeTab)?.description}
              </p>
              {activeTab === 'bulknames' && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2">📦 Bulk Import Instructions</h3>
                  <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                    <li>Supports philipperemy/name-dataset CSV format</li>
                    <li>CSV should have 4 columns in order: first_name, last_name, gender, country_code</li>
                    <li>Headers can be in any language - we use column position</li>
                    <li>Gender: M (male), F (female), or empty (neutral)</li>
                    <li>Country codes must exist in database first (run: <code className="bg-blue-100 px-1 rounded">npm run db:seed-countries</code>)</li>
                    <li>Large files are processed in batches of 5,000 records</li>
                    <li>Progress tracking shows real-time import status</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Import Mode Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Import Mode</label>
              <div className="flex space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    value="add"
                    checked={importMode === 'add'}
                    onChange={(e) => setImportMode(e.target.value as 'add' | 'replace')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">Add (skip duplicates)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={(e) => setImportMode(e.target.value as 'add' | 'replace')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">Replace (upsert existing)</span>
                </label>
              </div>
            </div>

            {/* File Upload */}
            <FileUpload
              onDataParsed={setParsedData}
              acceptedFormats={['.json', '.csv']}
              label="Upload Data File"
            />

            {/* Format Example */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Expected Format (JSON):</h3>
              <pre className="text-xs bg-gray-50 p-4 rounded-lg border border-gray-200 overflow-x-auto">
                {getFormatExample(activeTab)}
              </pre>
              <p className="text-xs text-gray-500 mt-2">
                <strong>CSV Format:</strong> Use column headers matching the field names above
              </p>
            </div>

            {/* Import Button */}
            {parsedData.length > 0 && (
              <div className="mt-6">
                <button
                  onClick={handleImport}
                  disabled={loading}
                  className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Importing {parsedData.length.toLocaleString()} records...
                    </span>
                  ) : (
                    `Import ${parsedData.length.toLocaleString()} Records`
                  )}
                </button>
              </div>
            )}

            {/* Bulk Import Progress */}
            {activeTab === 'bulknames' && bulkProgress.stage !== 'idle' && (
              <div className="mt-6">
                <BulkImportProgress progress={bulkProgress} />
              </div>
            )}

            {/* Import Result */}
            {importResult && (
              <div className={`mt-6 p-4 rounded-lg border ${
                importResult.success 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <h4 className={`font-semibold ${
                  importResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {importResult.success ? '✓ Import Completed' : '✗ Import Failed'}
                </h4>
                <div className="mt-2 text-sm">
                  <p className="text-gray-700">
                    <strong>Imported:</strong> {importResult.imported} records
                  </p>
                  <p className="text-gray-700">
                    <strong>Skipped:</strong> {importResult.skipped} records
                  </p>
                  {importResult.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-red-700 font-medium">Errors:</p>
                      <ul className="list-disc list-inside text-red-600 text-xs mt-1 space-y-1">
                        {importResult.errors.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-xl">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 Tips</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Use <strong>Add mode</strong> to insert new records without affecting existing ones</li>
            <li>• Use <strong>Replace mode</strong> to update existing records or insert new ones</li>
            <li>• CSV files must have headers matching the field names</li>
            <li>• Large files are processed in batches of 1000 records</li>
            <li>• Country codes must exist before importing names or cities</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
