'use client';

import { useState, useEffect, useRef } from 'react';

type VerificationStatus = 'valid' | 'risky' | 'invalid' | 'unknown' | 'verifying';

interface VerificationResult {
  email: string;
  status: VerificationStatus;
  reason?: string;
  fromCache?: boolean;
  data?: any;
}

interface EmailResultsProps {
  emails: string[];
  meta: {
    count: number;
    providersUsed: string[];
  };
  onSave?: () => void;
}

export default function EmailResults({ emails, meta, onSave }: EmailResultsProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [copySuccess, setCopySuccess] = useState(false);
  const [verificationStatuses, setVerificationStatuses] = useState<Map<string, VerificationResult>>(new Map());
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationProgress, setVerificationProgress] = useState({ current: 0, total: 0 });
  const [verificationStats, setVerificationStats] = useState({
    valid: 0,
    risky: 0,
    invalid: 0,
    unknown: 0
  });
  const previousEmailsRef = useRef<string[]>([]);
  const itemsPerPage = 50;

  const totalPages = Math.ceil(emails.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentEmails = emails.slice(startIndex, endIndex);

  // Auto-trigger verification when emails change
  useEffect(() => {
    // Check if emails have changed
    const emailsChanged = JSON.stringify(emails) !== JSON.stringify(previousEmailsRef.current);
    
    if (emailsChanged && emails.length > 0) {
      previousEmailsRef.current = emails;
      // Reset verification state
      setVerificationStatuses(new Map());
      setVerificationStats({ valid: 0, risky: 0, invalid: 0, unknown: 0 });
      setVerificationProgress({ current: 0, total: emails.length });
      // Start verification
      verifyAllEmails();
    }
  }, [emails]);

  // Verify all emails in batches
  const verifyAllEmails = async () => {
    if (emails.length === 0) return;

    setIsVerifying(true);
    const batchSize = 25; // Verify 25 emails at a time
    const batches = [];

    // Split emails into batches
    for (let i = 0; i < emails.length; i += batchSize) {
      batches.push(emails.slice(i, i + batchSize));
    }

    let processedCount = 0;

    // Process each batch sequentially
    for (const batch of batches) {
      try {
        const response = await fetch('/api/verify-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            emails: batch
          }),
        });

        if (response.ok) {
          const data = await response.json();
          
          // Update verification statuses for this batch
          if (data.results && Array.isArray(data.results)) {
            setVerificationStatuses(prev => {
              const newMap = new Map(prev);
              data.results.forEach((result: VerificationResult) => {
                newMap.set(result.email, result);
              });
              return newMap;
            });

            // Update stats
            if (data.stats) {
              setVerificationStats({
                valid: data.stats.valid || 0,
                risky: data.stats.risky || 0,
                invalid: data.stats.invalid || 0,
                unknown: data.stats.unknown || 0
              });
            }
          }
        } else {
          // If batch fails, mark all emails in batch as unknown
          setVerificationStatuses(prev => {
            const newMap = new Map(prev);
            batch.forEach(email => {
              newMap.set(email, {
                email,
                status: 'unknown',
                reason: 'Verification failed'
              });
            });
            return newMap;
          });
        }
      } catch (error) {
        console.error('Error verifying batch:', error);
        // Mark batch as unknown on error
        setVerificationStatuses(prev => {
          const newMap = new Map(prev);
          batch.forEach(email => {
            newMap.set(email, {
              email,
              status: 'unknown',
              reason: 'Network error'
            });
          });
          return newMap;
        });
      }

      processedCount += batch.length;
      setVerificationProgress({ current: processedCount, total: emails.length });

      // Small delay between batches to avoid overwhelming the API
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    setIsVerifying(false);
  };

  // Get status color and styles
  const getStatusColor = (status: VerificationStatus) => {
    switch (status) {
      case 'valid':
        return 'bg-green-100 text-green-800 border border-green-200';
      case 'risky':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'invalid':
        return 'bg-red-100 text-red-800 border border-red-200';
      case 'verifying':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      default:
        return 'bg-gray-100 text-gray-600 border border-gray-200';
    }
  };

  // Get status icon
  const getStatusIcon = (status: VerificationStatus) => {
    switch (status) {
      case 'valid':
        return '✓';
      case 'risky':
        return '⚠';
      case 'invalid':
        return '✗';
      case 'verifying':
        return '⏳';
      default:
        return '?';
    }
  };

  // Get status label
  const getStatusLabel = (status: VerificationStatus) => {
    switch (status) {
      case 'valid':
        return 'Valid';
      case 'risky':
        return 'Risky';
      case 'invalid':
        return 'Invalid';
      case 'verifying':
        return 'Verifying';
      default:
        return 'Unknown';
    }
  };

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(emails.join('\n'));
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleExportCSV = () => {
    const csv = ['Email Address', ...emails].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generated-emails-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportTXT = () => {
    const txt = emails.join('\n');
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generated-emails-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (emails.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        <h3 className="mt-4 text-sm font-medium text-slate-900">No emails generated yet</h3>
        <p className="mt-2 text-sm text-slate-500">
          Fill in the form and click &quot;Generate Emails&quot; to get started.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header with Stats */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900 tracking-tight mb-6">Generated Emails</h2>
        
        {/* Verification Progress Bar */}
        {isVerifying && (
          <div className="mb-4 bg-blue-50 border border-blue-200 p-4 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-blue-700">
                Verifying emails... {verificationProgress.current} / {verificationProgress.total}
              </p>
              <p className="text-xs text-blue-600">
                {Math.round((verificationProgress.current / verificationProgress.total) * 100)}%
              </p>
            </div>
            <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${(verificationProgress.current / verificationProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl">
            <p className="text-xs text-indigo-600 font-medium mb-1">Total Generated</p>
            <p className="text-2xl font-semibold text-indigo-900">{meta?.count || 0}</p>
          </div>
          
          <div className="bg-green-50/50 border border-green-100 p-4 rounded-xl">
            <p className="text-xs text-green-600 font-medium mb-1">✓ Valid</p>
            <p className="text-2xl font-semibold text-green-900">{verificationStats.valid}</p>
          </div>

          <div className="bg-yellow-50/50 border border-yellow-100 p-4 rounded-xl">
            <p className="text-xs text-yellow-600 font-medium mb-1">⚠ Risky</p>
            <p className="text-2xl font-semibold text-yellow-900">{verificationStats.risky}</p>
          </div>

          <div className="bg-red-50/50 border border-red-100 p-4 rounded-xl">
            <p className="text-xs text-red-600 font-medium mb-1">✗ Invalid</p>
            <p className="text-2xl font-semibold text-red-900">{verificationStats.invalid}</p>
          </div>
          
          <div className="bg-gray-50/50 border border-gray-100 p-4 rounded-xl">
            <p className="text-xs text-gray-600 font-medium mb-1">? Unknown</p>
            <p className="text-2xl font-semibold text-gray-900">{verificationStats.unknown}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {onSave && (
            <button
              onClick={onSave}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all duration-200 font-medium text-sm shadow-sm hover:shadow-md"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              <span>Save Batch</span>
            </button>
          )}
          
          <button
            onClick={handleCopyAll}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl transition-all duration-200 font-medium text-sm shadow-sm hover:shadow-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>{copySuccess ? 'Copied!' : 'Copy All'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-all duration-200 font-medium text-sm shadow-sm hover:shadow-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportTXT}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl transition-all duration-200 font-medium text-sm shadow-sm hover:shadow-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export TXT</span>
          </button>
        </div>
      </div>

      {/* Providers Used */}
      {meta?.providersUsed && meta.providersUsed.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Domains used</p>
          <div className="flex flex-wrap gap-2">
            {meta.providersUsed.map(provider => (
              <span
                key={provider}
                className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm border border-slate-200"
              >
                @{provider}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Email List - Scannable table design */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          <ul className="divide-y divide-slate-200">
            {currentEmails.map((email, index) => {
              const verification = verificationStatuses.get(email);
              const status = verification?.status || (isVerifying ? 'verifying' : 'unknown');
              
              return (
                <li
                  key={startIndex + index}
                  className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors duration-150 group"
                >
                  <span className="text-sm text-slate-700 font-mono flex-1">{email}</span>
                  
                  {/* Verification Status Badge */}
                  <span 
                    className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(status)} ml-3`}
                    title={verification?.reason || getStatusLabel(status)}
                  >
                    {getStatusIcon(status)} {getStatusLabel(status)}
                  </span>

                  <button
                    onClick={() => handleCopyEmail(email)}
                    className="ml-3 p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all duration-150 opacity-0 group-hover:opacity-100"
                    title="Copy email"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            Previous
          </button>

          <span className="text-sm text-slate-600 font-medium">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
