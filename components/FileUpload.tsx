'use client';

import { useState } from 'react';
import Papa from 'papaparse';

interface FileUploadProps {
  onDataParsed: (data: any[]) => void;
  onFileSelected?: (file: File | null) => void;
  acceptedFormats?: string[];
  label: string;
}

export default function FileUpload({ onDataParsed, onFileSelected, acceptedFormats = ['.json', '.csv'], label }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [error, setError] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError('');
    setPreview([]);
    
    // Notify parent of file selection
    if (onFileSelected) {
      onFileSelected(selectedFile);
    }
    
    parseFile(selectedFile);
  };

  const parseFile = async (file: File) => {
    setParsing(true);
    setError('');

    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase();

      if (fileExt === 'json') {
        const text = await file.text();
        const data = JSON.parse(text);
        const dataArray = Array.isArray(data) ? data : [data];
        setPreview(dataArray.slice(0, 5));
        onDataParsed(dataArray);
      } else if (fileExt === 'csv') {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setPreview(results.data.slice(0, 5));
            onDataParsed(results.data);
            setParsing(false);
          },
          error: (error) => {
            setError(`CSV parsing error: ${error.message}`);
            setParsing(false);
          },
        });
        return; // Return early since Papa.parse is async
      } else {
        throw new Error(`Unsupported file format: ${fileExt}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
        <div className="flex items-center space-x-4">
          <label className="flex-1 flex items-center justify-center px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-500 transition-colors">
            <div className="space-y-1 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="text-sm text-gray-600">
                <span className="font-medium text-indigo-600 hover:text-indigo-500">Upload a file</span>
                {' '}or drag and drop
              </div>
              <p className="text-xs text-gray-500">
                {acceptedFormats.join(', ')} files
              </p>
            </div>
            <input
              type="file"
              className="sr-only"
              accept={acceptedFormats.join(',')}
              onChange={handleFileChange}
            />
          </label>
        </div>

        {file && (
          <div className="mt-2 text-sm text-gray-600">
            <span className="font-medium">Selected:</span> {file.name} ({(file.size / 1024).toFixed(2)} KB)
          </div>
        )}

        {parsing && (
          <div className="mt-2 text-sm text-indigo-600">
            Parsing file...
          </div>
        )}

        {error && (
          <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}
      </div>

      {preview.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Preview (first 5 rows)</h4>
          <div className="overflow-x-auto">
            <pre className="text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto">
              {JSON.stringify(preview, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
