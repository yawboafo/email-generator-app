#!/usr/bin/env node

/**
 * Direct CSV File Upload to bulk-names-stream endpoint
 * Uploads CSV file as multipart/form-data
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const http = require('http');
const https = require('https');

const csvFilePath = process.argv[2];
const apiEndpoint = process.argv[3] || 'http://localhost:3000/api/admin/import/bulk-names-stream';
const mode = process.argv[4] || 'add'; // 'add' or 'replace'

// Configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const TIMEOUT_MS = 300000; // 5 minutes timeout

if (!csvFilePath) {
  console.error('Usage: node upload-csv-direct.js <csv-file-path> [api-endpoint] [mode]');
  console.error('Example: node upload-csv-direct.js /path/to/file.csv http://localhost:3000/api/admin/import/bulk-names-stream add');
  process.exit(1);
}

console.error(`Upload Configuration:`);
console.error(`  File: ${csvFilePath}`);
console.error(`  Endpoint: ${apiEndpoint}`);
console.error(`  Mode: ${mode}`);
console.error('');

// Helper to sleep for retry delays
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Upload file with multipart/form-data
async function uploadFile(filePath, endpoint, mode, retryCount = 0) {
  return new Promise((resolve, reject) => {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      reject(new Error(`File not found: ${filePath}`));
      return;
    }

    // Get file stats
    const stats = fs.statSync(filePath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.error(`File size: ${fileSizeInMB} MB`);
    if (retryCount === 0) {
      console.error(`Starting upload...`);
    }

    // Create form data
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('mode', mode);

    // Parse endpoint URL
    const url = new URL(endpoint);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    // Prepare request options
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 3000),
      path: url.pathname + url.search,
      method: 'POST',
      headers: form.getHeaders(),
      timeout: TIMEOUT_MS,
    };

    const req = httpModule.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ statusCode: res.statusCode, body });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.on('error', (error) => {
      reject(error);
    });

    // Pipe form data to request
    form.pipe(req);
  });
}

// Upload with retry logic
async function uploadWithRetry(filePath, endpoint, mode) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff
        console.error(`Retry attempt ${attempt}/${MAX_RETRIES} after ${delay}ms...`);
        await sleep(delay);
      }

      const result = await uploadFile(filePath, endpoint, mode, attempt);
      return result; // Success

    } catch (error) {
      lastError = error;
      
      console.error(`Upload failed: ${error.message}`);

      // Check if error is retryable
      const isRetryable = 
        error.message.includes('ECONNRESET') ||
        error.message.includes('EPIPE') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('timeout') ||
        error.message.includes('HTTP 500') ||
        error.message.includes('HTTP 503');

      if (!isRetryable || attempt === MAX_RETRIES) {
        throw error;
      }
    }
  }

  throw lastError;
}

// Main execution
(async () => {
  const startTime = Date.now();
  
  try {
    const result = await uploadWithRetry(csvFilePath, apiEndpoint, mode);
    
    // Parse and display results
    try {
      const json = JSON.parse(result.body);
      const duration = Date.now() - startTime;
      
      console.log('');
      console.log('='.repeat(60));
      console.log('UPLOAD COMPLETE');
      console.log('='.repeat(60));
      console.log(`Status: ${json.success ? '✓ SUCCESS' : '✗ PARTIAL'}`);
      console.log(`Imported: ${json.imported || 0} records`);
      console.log(`Skipped: ${json.skipped || 0} records`);
      console.log(`Processed: ${json.processed || 0} total records`);
      console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
      if (json.recordsPerSecond) {
        console.log(`Speed: ${json.recordsPerSecond} records/second`);
      }
      if (json.errors && json.errors.length > 0) {
        console.log(`Errors: ${json.errors.length}`);
        console.log('First few errors:');
        json.errors.slice(0, 5).forEach((err, i) => {
          console.log(`  ${i + 1}. ${err}`);
        });
      }
      console.log('='.repeat(60));
      
      process.exit(json.success ? 0 : 1);
    } catch (e) {
      console.log('');
      console.log('Upload completed successfully');
      console.log(result.body);
      process.exit(0);
    }
  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('UPLOAD FAILED');
    console.error('='.repeat(60));
    console.error(`Error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    console.error('='.repeat(60));
    process.exit(1);
  }
})();
