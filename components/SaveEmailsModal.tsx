'use client';

import { useState } from 'react';

interface SaveEmailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  emailCount: number;
}

export default function SaveEmailsModal({ isOpen, onClose, onSave, emailCount }: SaveEmailsModalProps) {
  const [batchName, setBatchName] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    if (!batchName.trim()) {
      setError('Please enter a name for this batch');
      return;
    }
    
    onSave(batchName.trim());
    setBatchName('');
    setError('');
    onClose();
  };

  const handleClose = () => {
    setBatchName('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-900">Save Email Batch</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-4">
            Save {emailCount.toLocaleString()} email addresses for later use
          </p>
          
          <label htmlFor="batchName" className="block text-sm font-medium text-gray-900 mb-2">
            Batch Name
          </label>
          <input
            type="text"
            id="batchName"
            value={batchName}
            onChange={(e) => {
              setBatchName(e.target.value);
              setError('');
            }}
            placeholder="e.g., Test Users March 2025"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white placeholder-gray-400"
            autoFocus
          />
          
          {error && (
            <p className="text-red-600 text-sm mt-2">{error}</p>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium transition-colors"
          >
            Save Batch
          </button>
        </div>
      </div>
    </div>
  );
}
