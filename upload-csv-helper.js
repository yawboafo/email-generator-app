#!/usr/bin/env node

/**
 * CSV Upload Helper Script
 * Parses CSV file and sends data to API as JSON
 * Supports: Retry logic, streaming for large files, better error handling
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const readline = require('readline');

const csvFilePath = process.argv[2];
const apiEndpoint = process.argv[3];

// Configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const LARGE_FILE_THRESHOLD = 500 * 1024 * 1024; // 500MB
const CHUNK_SIZE = 10000; // Reduced to 10k for lower memory usage

if (!csvFilePath || !apiEndpoint) {
  console.error('Usage: node upload-csv-helper.js <csv-file-path> <api-endpoint>');
  process.exit(1);
}

console.error(`Reading CSV file: ${csvFilePath}`);

// Helper to sleep for retry delays
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Parse a single CSV line
function parseCSVLine(line, isFirstLine = false) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  
  // Split by comma (simple parser - doesn't handle quoted commas)
  const parts = trimmed.split(',').map(p => p.trim());
  
  // Check if this looks like a header row
  if (isFirstLine && (parts[0].toLowerCase().includes('first') || parts[0].toLowerCase().includes('name'))) {
    return null; // Skip header
  }
  
  // Parse as: firstName, lastName, gender, countryCode
  const [firstName, lastName, gender, countryCode] = parts;
  
  // Map gender to the format expected by API
  let genderValue = 'neutral';
  if (gender && gender.trim()) {
    const g = gender.trim().toUpperCase();
    if (g === 'M' || g === 'MALE') genderValue = 'male';
    else if (g === 'F' || g === 'FEMALE') genderValue = 'female';
  }
  
  return {
    firstName: firstName || '',
    lastName: lastName || '',
    gender: genderValue,
    countryCode: countryCode || ''
  };
}

// Simple CSV parser (for small files)
function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  const data = [];
  
  for (let i = 0; i < lines.length; i++) {
    const parsed = parseCSVLine(lines[i], i === 0);
    if (parsed) data.push(parsed);
  }
  
  return data;
}

// Streaming CSV parser with batch processing (for large files)
async function parseCSVStreamWithBatchUpload(filePath, endpoint, batchSize = CHUNK_SIZE) {
  return new Promise((resolve, reject) => {
    let batch = [];
    let lineNumber = 0;
    let totalImported = 0;
    let totalSkipped = 0;
    let totalProcessed = 0;
    let failedChunks = [];
    let isPaused = false;
    
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    const uploadBatch = async (batchNumber) => {
      if (batch.length === 0) return;
      
      const currentBatch = [...batch];
      batch = [];
      
      console.error(`Uploading batch ${batchNumber} (${currentBatch.length} records)...`);
      
      try {
        const result = await uploadDataWithRetry(currentBatch, endpoint, batchNumber);
        
        if (result.statusCode === 200) {
          try {
            const json = JSON.parse(result.body);
            totalImported += json.imported || 0;
            totalSkipped += json.skipped || 0;
            console.error(`  ✓ Batch ${batchNumber}: ${json.imported || 0} imported, ${json.skipped || 0} skipped`);
          } catch (e) {
            console.error(`  ✓ Batch ${batchNumber}: Success`);
            totalImported += currentBatch.length;
          }
        } else {
          console.error(`  ✗ Batch ${batchNumber}: HTTP ${result.statusCode}`);
          failedChunks.push({ batch: batchNumber, reason: `HTTP ${result.statusCode}` });
        }
      } catch (error) {
        console.error(`  ✗ Batch ${batchNumber}: ${error.message}`);
        failedChunks.push({ batch: batchNumber, reason: error.message });
      }
    };
    
    let batchNumber = 0;
    
    rl.on('line', async (line) => {
      const parsed = parseCSVLine(line, lineNumber === 0);
      if (parsed) {
        batch.push(parsed);
        totalProcessed++;
      }
      lineNumber++;
      
      // When batch is full, pause reading and upload
      if (batch.length >= batchSize) {
        rl.pause();
        isPaused = true;
        batchNumber++;
        await uploadBatch(batchNumber);
        isPaused = false;
        rl.resume();
      }
    });
    
    rl.on('close', async () => {
      // Upload remaining batch
      if (batch.length > 0) {
        batchNumber++;
        await uploadBatch(batchNumber);
      }
      
      const success = failedChunks.length === 0;
      resolve({
        statusCode: success ? 200 : 206,
        body: JSON.stringify({
          success: success,
          imported: totalImported,
          skipped: totalSkipped,
          processed: totalProcessed,
          batches: batchNumber,
          failedChunks: failedChunks.length > 0 ? failedChunks : undefined
        })
      });
    });
    
    rl.on('error', (error) => {
      reject(error);
    });
  });
}

// Send data to API with retry logic
async function uploadData(data, endpoint, retryCount = 0) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const payload = JSON.stringify({ data: data, mode: 'add' });
    
    // Use https for https URLs, http for http URLs
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 3000),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      // Add timeout to detect hanging connections
      timeout: 60000 // 60 seconds
    };
    
    const req = httpModule.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body });
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(payload);
    req.end();
  });
}

// Upload with retry logic
async function uploadDataWithRetry(data, endpoint, chunkNumber) {
  let lastError;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff
        console.error(`    Retry attempt ${attempt}/${MAX_RETRIES} after ${delay}ms...`);
        await sleep(delay);
      }
      
      const result = await uploadData(data, endpoint);
      return result; // Success
      
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      const isRetryable = 
        error.message.includes('ECONNRESET') ||
        error.message.includes('EPIPE') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('timeout');
      
      if (!isRetryable || attempt === MAX_RETRIES) {
        throw error;
      }
    }
  }
  
  throw lastError;
}

// Upload data in chunks with retry logic
async function uploadInChunks(data, endpoint, chunkSize = CHUNK_SIZE) {
  const chunks = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }
  
  console.error(`Splitting into ${chunks.length} chunks of max ${chunkSize} records`);
  
  let totalImported = 0;
  let totalSkipped = 0;
  let lastStatusCode = 200;
  let failedChunks = [];
  
  for (let i = 0; i < chunks.length; i++) {
    console.error(`Uploading chunk ${i + 1}/${chunks.length} (${chunks[i].length} records)...`);
    
    try {
      const result = await uploadDataWithRetry(chunks[i], endpoint, i + 1);
      lastStatusCode = result.statusCode;
      
      if (result.statusCode === 200) {
        try {
          const json = JSON.parse(result.body);
          totalImported += json.imported || 0;
          totalSkipped += json.skipped || 0;
          console.error(`  ✓ Chunk ${i + 1}: ${json.imported || 0} imported, ${json.skipped || 0} skipped`);
        } catch (e) {
          console.error(`  ✓ Chunk ${i + 1}: Success`);
        }
      } else {
        console.error(`  ✗ Chunk ${i + 1}: HTTP ${result.statusCode}`);
        console.error(result.body);
        failedChunks.push({ chunk: i + 1, reason: `HTTP ${result.statusCode}` });
        // Continue with next chunk instead of throwing
      }
    } catch (error) {
      console.error(`  ✗ Chunk ${i + 1}: Error - ${error.message}`);
      failedChunks.push({ chunk: i + 1, reason: error.message });
      // Continue with next chunk instead of throwing
    }
  }
  
  const success = failedChunks.length === 0;
  
  return {
    statusCode: success ? lastStatusCode : 206, // 206 = Partial Content
    body: JSON.stringify({
      success: success,
      imported: totalImported,
      skipped: totalSkipped,
      chunks: chunks.length,
      failedChunks: failedChunks.length > 0 ? failedChunks : undefined
    })
  };
}

// Main execution
(async () => {
  try {
    // Check if file exists
    if (!fs.existsSync(csvFilePath)) {
      console.error(`HTTP_STATUS:404`);
      console.error(`File not found: ${csvFilePath}`);
      process.exit(1);
    }
    
    // Get file size
    const stats = fs.statSync(csvFilePath);
    const fileSizeInBytes = stats.size;
    const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);
    
    console.error(`File size: ${fileSizeInMB} MB`);
    
    let result;
    
    // Use streaming with batch upload for large files
    if (fileSizeInBytes > LARGE_FILE_THRESHOLD) {
      console.error('Large file detected - using streaming batch upload...');
      console.error(`Will process and upload in batches of ${CHUNK_SIZE} records`);
      result = await parseCSVStreamWithBatchUpload(csvFilePath, apiEndpoint, CHUNK_SIZE);
    } else {
      // Read CSV file for small files
      console.error('Reading CSV file...');
      let data;
      
      try {
        const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
        
        // Parse CSV
        console.error('Parsing CSV data...');
        data = parseCSV(csvContent);
      } catch (readError) {
        // If readFileSync fails (file too large), fall back to streaming
        if (readError.message.includes('string longer than') || 
            readError.message.includes('Invalid string length')) {
          console.error('File too large for memory - switching to streaming batch upload...');
          result = await parseCSVStreamWithBatchUpload(csvFilePath, apiEndpoint, CHUNK_SIZE);
        } else {
          throw readError;
        }
      }
      
      if (data) {
        if (data.length === 0) {
          console.error('HTTP_STATUS:400');
          console.error('No data found in CSV file');
          process.exit(1);
        }
        
        console.error(`Parsed ${data.length} records`);
        console.error('Uploading to API...');
        
        // Upload to API in chunks
        result = await uploadInChunks(data, apiEndpoint);
      }
    }
    
    // Output final result
    console.log(`HTTP_STATUS:${result.statusCode}`);
    console.log(result.body);
    
    // Exit with appropriate code
    const resultData = JSON.parse(result.body);
    if (resultData.success) {
      process.exit(0);
    } else {
      console.error('Warning: Some chunks failed to upload');
      process.exit(1);
    }
  } catch (error) {
    console.error(`HTTP_STATUS:000`);
    console.error(`Error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
})();
