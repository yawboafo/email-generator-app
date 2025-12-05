'use client';

import { useState, useEffect } from 'react';
import { SavedEmailBatch } from '@/types';
import { getSavedEmailBatches, deleteSavedEmailBatch } from '@/lib/storageDb';

interface SavedEmailsListProps {
  onImport?: (batch: SavedEmailBatch) => void;
  onImportToSend?: (batch: SavedEmailBatch) => void;
  onImportToVerify?: (batch: SavedEmailBatch) => void;
  onRefresh?: () => void;
}

export default function SavedEmailsList({ onImport, onImportToSend, onImportToVerify, onRefresh }: SavedEmailsListProps) {
  const [batches, setBatches] = useState<SavedEmailBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);

  const loadBatches = async () => {
    try {
      const saved = await getSavedEmailBatches();
      setBatches(saved);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error loading batches:', error);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm('Are you sure you want to delete this batch?')) {
      try {
        await deleteSavedEmailBatch(id, name);
        await loadBatches();
      } catch (error) {
        console.error('Error deleting batch:', error);
        alert('Failed to delete batch. Please try again.');
      }
    }
  };

  const handleImport = (batch: SavedEmailBatch) => {
    setSelectedBatch(batch.id);
    if (onImport) {
      onImport(batch);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const downloadBatch = (batch: SavedEmailBatch) => {
    const blob = new Blob([batch.emails.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${batch.name.replace(/[^a-z0-9]/gi, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (batches.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="text-gray-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Saved Batches</h3>
        <p className="text-gray-600">
          Generate some emails and save them to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Saved Email Batches</h2>
            <p className="text-sm text-gray-600 mt-1">
              {batches.length} {batches.length === 1 ? 'batch' : 'batches'} • {batches.reduce((sum, b) => sum + b.count, 0).toLocaleString()} total emails
            </p>
          </div>
          <button
            onClick={loadBatches}
            className="p-2 hover:bg-white rounded-md transition-colors"
            title="Refresh"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Batch Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Count</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Pattern</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Country</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Created</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {batches.map((batch) => (
              <tr 
                key={batch.id} 
                className={`hover:bg-gray-50 transition-colors ${selectedBatch === batch.id ? 'bg-blue-50' : ''}`}
              >
                <td className="px-4 py-4">
                  <div className="font-medium text-gray-900">{batch.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {batch.providers.slice(0, 3).join(', ')}
                    {batch.providers.length > 3 && ` +${batch.providers.length - 3} more`}
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-700">
                  {batch.count.toLocaleString()}
                </td>
                <td className="px-4 py-4">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {batch.pattern}
                  </span>
                </td>
                <td className="px-4 py-4 text-sm text-gray-700">
                  {batch.country}
                </td>
                <td className="px-4 py-4 text-sm text-gray-600">
                  {formatDate(batch.createdAt)}
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex gap-2 justify-end">
                    {onImport && (
                      <button
                        onClick={() => handleImport(batch)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
                        title="Import these emails"
                      >
                        Import
                      </button>
                    )}
                    {onImportToSend && (
                      <button
                        onClick={() => onImportToSend(batch)}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md transition-colors"
                        title="Import to Send Emails"
                      >
                        📤 Send
                      </button>
                    )}
                    {onImportToVerify && (
                      <button
                        onClick={() => onImportToVerify(batch)}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md transition-colors"
                        title="Import to Verify Emails"
                      >
                        ✓ Verify
                      </button>
                    )}
                    <button
                      onClick={() => downloadBatch(batch)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
                      title="Download as text file"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => handleDelete(batch.id, batch.name)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
                      title="Delete this batch"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
