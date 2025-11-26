'use client';

import { useState } from 'react';

export interface ImportProgress {
  stage: 'idle' | 'uploading' | 'parsing' | 'validating' | 'importing' | 'complete' | 'error';
  progress: number;
  total: number;
  currentBatch: number;
  totalBatches: number;
  imported: number;
  skipped: number;
  errors: string[];
  message: string;
}

interface BulkImportProgressProps {
  progress: ImportProgress;
}

export default function BulkImportProgress({ progress }: BulkImportProgressProps) {
  const getStageColor = () => {
    switch (progress.stage) {
      case 'complete':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'idle':
        return 'bg-gray-300';
      default:
        return 'bg-blue-500';
    }
  };

  const getStageIcon = () => {
    switch (progress.stage) {
      case 'complete':
        return '✓';
      case 'error':
        return '✗';
      case 'idle':
        return '○';
      default:
        return '⟳';
    }
  };

  const percentage = progress.total > 0 ? Math.round((progress.progress / progress.total) * 100) : 0;

  if (progress.stage === 'idle') return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${getStageColor()} flex items-center justify-center text-white text-xl`}>
            {getStageIcon()}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 capitalize">{progress.stage}</h3>
            <p className="text-sm text-gray-600">{progress.message}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">{percentage}%</div>
          <div className="text-xs text-gray-500">
            {progress.progress.toLocaleString()} / {progress.total.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full ${getStageColor()} transition-all duration-300 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Batch Progress */}
      {progress.totalBatches > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            Batch {progress.currentBatch} of {progress.totalBatches}
          </span>
          <span className="text-gray-600">
            ~{Math.round((progress.totalBatches - progress.currentBatch) * 2)}s remaining
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{progress.imported.toLocaleString()}</div>
          <div className="text-xs text-gray-600">Imported</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-600">{progress.skipped.toLocaleString()}</div>
          <div className="text-xs text-gray-600">Skipped</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{progress.errors.length}</div>
          <div className="text-xs text-gray-600">Errors</div>
        </div>
      </div>

      {/* Errors */}
      {progress.errors.length > 0 && (
        <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
          <h4 className="text-sm font-semibold text-red-900 mb-2">
            Errors ({progress.errors.length})
          </h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {progress.errors.slice(0, 10).map((error, i) => (
              <p key={i} className="text-xs text-red-700 font-mono">{error}</p>
            ))}
            {progress.errors.length > 10 && (
              <p className="text-xs text-red-600 italic">
                ... and {progress.errors.length - 10} more errors
              </p>
            )}
          </div>
        </div>
      )}

      {/* Success Message */}
      {progress.stage === 'complete' && (
        <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
          <p className="text-sm text-green-900">
            ✓ Import completed successfully! {progress.imported.toLocaleString()} records imported,{' '}
            {progress.skipped.toLocaleString()} skipped.
          </p>
        </div>
      )}

      {/* Error Message */}
      {progress.stage === 'error' && (
        <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm text-red-900">✗ Import failed. Please check the errors above.</p>
        </div>
      )}
    </div>
  );
}
