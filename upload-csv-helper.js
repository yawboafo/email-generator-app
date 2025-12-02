#!/usr/bin/env node

/**
 * CSV Upload Helper Script
 * Parses CSV file and sends data to API as JSON
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const csvFilePath = process.argv[2];
const apiEndpoint = process.argv[3];

if (!csvFilePath || !apiEndpoint) {
  console.error('Usage: node upload-csv-helper.js <csv-file-path> <api-endpoint>');
  process.exit(1);
}

console.error(`Reading CSV file: ${csvFilePath}`);

// Simple CSV parser
function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  const data = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Split by comma (simple parser - doesn't handle quoted commas)
    const parts = line.split(',').map(p => p.trim());
    
    // Check if this looks like a header row
    if (i === 0 && (parts[0].toLowerCase().includes('first') || parts[0].toLowerCase().includes('name'))) {
      continue; // Skip header
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
    
    data.push({
      firstName: firstName || '',
      lastName: lastName || '',
      gender: genderValue,
      countryCode: countryCode || ''
    });
  }
  
  return data;
}

// Send data to API
async function uploadData(data, endpoint) {
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
      }
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
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(payload);
    req.end();
  });
}

// Upload data in chunks
async function uploadInChunks(data, endpoint, chunkSize = 50000) {
  const chunks = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }
  
  console.error(`Splitting into ${chunks.length} chunks of max ${chunkSize} records`);
  
  let totalImported = 0;
  let totalSkipped = 0;
  let lastStatusCode = 200;
  
  for (let i = 0; i < chunks.length; i++) {
    console.error(`Uploading chunk ${i + 1}/${chunks.length} (${chunks[i].length} records)...`);
    
    try {
      const result = await uploadData(chunks[i], endpoint);
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
        throw new Error(`Upload failed with status ${result.statusCode}`);
      }
    } catch (error) {
      console.error(`  ✗ Chunk ${i + 1}: Error - ${error.message}`);
      throw error;
    }
  }
  
  return {
    statusCode: lastStatusCode,
    body: JSON.stringify({
      success: true,
      imported: totalImported,
      skipped: totalSkipped,
      chunks: chunks.length
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
    
    // Read CSV file
    console.error('Reading CSV file...');
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    
    // Parse CSV
    console.error('Parsing CSV data...');
    const data = parseCSV(csvContent);
    
    if (data.length === 0) {
      console.error('HTTP_STATUS:400');
      console.error('No data found in CSV file');
      process.exit(1);
    }
    
    console.error(`Parsed ${data.length} records`);
    console.error('Uploading to API...');
    
    // Upload to API in chunks
    const result = await uploadInChunks(data, apiEndpoint);
    
    // Output final result
    console.log(`HTTP_STATUS:${result.statusCode}`);
    console.log(result.body);
    
    process.exit(0);
  } catch (error) {
    console.error(`HTTP_STATUS:000`);
    console.error(`Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
})();
