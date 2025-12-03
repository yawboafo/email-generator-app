#!/usr/bin/env node

/**
 * Direct PostgreSQL Upload Script
 * Uploads CSV data directly to Railway PostgreSQL database
 */

const fs = require('fs');
const { Pool } = require('pg');
const readline = require('readline');
const cuid = require('cuid');

const csvFilePath = process.argv[2];
const BATCH_SIZE = 10000;

if (!csvFilePath) {
  console.error('Usage: node upload-to-railway-db.js <csv-file-path>');
  console.error('Requires DATABASE_URL environment variable');
  process.exit(1);
}

// Get database URL from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  console.error('Get it from Railway: railway variables | grep DATABASE_URL');
  process.exit(1);
}

console.error(`\n=== PostgreSQL Direct Upload ===`);
console.error(`File: ${csvFilePath}`);
console.error(`Database: ${DATABASE_URL.split('@')[1]?.split('/')[0] || 'Railway DB'}`);
console.error(`Batch Size: ${BATCH_SIZE}`);
console.error('');

// Create connection pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  ssl: { rejectUnauthorized: false }
});

// Parse CSV line
function parseCSVLine(line, isFirstLine = false) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  
  const parts = trimmed.split(',').map(p => p.trim());
  
  // Skip header
  if (isFirstLine && (parts[0].toLowerCase().includes('first') || parts[0].toLowerCase().includes('name'))) {
    return null;
  }
  
  const [firstName, lastName, gender, countryCode] = parts;
  
  // Map gender
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
    countryCode: (countryCode || '').toUpperCase()
  };
}

// Load country cache
async function loadCountries() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT code, id FROM "Country"');
    const map = new Map();
    result.rows.forEach(row => map.set(row.code, row.id));
    console.error(`Loaded ${map.size} countries from database`);
    return map;
  } finally {
    client.release();
  }
}

// Insert batch using COPY
async function insertBatch(records, countryMap) {
  if (records.length === 0) return { imported: 0, skipped: 0 };
  
  const client = await pool.connect();
  let imported = 0;
  let skipped = 0;
  
  try {
    await client.query('BEGIN');
    
    // Process first names
    const firstNames = [];
    const lastNames = [];
    const seenFirst = new Set();
    const seenLast = new Set();
    
    for (const record of records) {
      const countryId = countryMap.get(record.countryCode);
      if (!countryId) {
        skipped++;
        continue;
      }
      
      const firstKey = `${record.firstName}:${countryId}:${record.gender}`;
      if (record.firstName && !seenFirst.has(firstKey)) {
        firstNames.push({
          name: record.firstName,
          gender: record.gender,
          countryId: countryId
        });
        seenFirst.add(firstKey);
      }
      
      const lastKey = `${record.lastName}:${countryId}`;
      if (record.lastName && !seenLast.has(lastKey)) {
        lastNames.push({
          name: record.lastName,
          countryId: countryId
        });
        seenLast.add(lastKey);
      }
    }
    
    const now = new Date();
    
    // Insert first names
    if (firstNames.length > 0) {
      const values = firstNames.map((fn, i) => 
        `($${i*6+1}, $${i*6+2}, $${i*6+3}, $${i*6+4}, $${i*6+5}, $${i*6+6})`
      ).join(',');
      
      const params = firstNames.flatMap(fn => [cuid(), fn.name, fn.gender, fn.countryId, now, now]);
      
      const query = `
        INSERT INTO "FirstName" (id, name, gender, "countryId", "createdAt", "updatedAt")
        VALUES ${values}
        ON CONFLICT (name, "countryId", gender) DO NOTHING
      `;
      
      const result = await client.query(query, params);
      imported += result.rowCount || 0;
    }
    
    // Insert last names
    if (lastNames.length > 0) {
      const values = lastNames.map((ln, i) => 
        `($${i*5+1}, $${i*5+2}, $${i*5+3}, $${i*5+4}, $${i*5+5})`
      ).join(',');
      
      const params = lastNames.flatMap(ln => [cuid(), ln.name, ln.countryId, now, now]);
      
      const query = `
        INSERT INTO "LastName" (id, name, "countryId", "createdAt", "updatedAt")
        VALUES ${values}
        ON CONFLICT (name, "countryId") DO NOTHING
      `;
      
      const result = await client.query(query, params);
      imported += result.rowCount || 0;
    }
    
    await client.query('COMMIT');
    skipped = records.length - firstNames.length - lastNames.length + skipped;
    
    return { imported, skipped };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Main function
async function main() {
  const startTime = Date.now();
  
  try {
    // Check file exists
    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`File not found: ${csvFilePath}`);
    }
    
    const stats = fs.statSync(csvFilePath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.error(`File size: ${fileSizeInMB} MB\n`);
    
    // Load countries
    console.error('Loading countries...');
    const countryMap = await loadCountries();
    console.error('');
    
    // Stream and process file
    let batch = [];
    let lineNumber = 0;
    let totalImported = 0;
    let totalSkipped = 0;
    let batchNumber = 0;
    
    const fileStream = fs.createReadStream(csvFilePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    console.error('Processing file...\n');
    
    for await (const line of rl) {
      const parsed = parseCSVLine(line, lineNumber === 0);
      if (parsed) {
        batch.push(parsed);
      }
      lineNumber++;
      
      if (batch.length >= BATCH_SIZE) {
        batchNumber++;
        process.stderr.write(`\rBatch ${batchNumber}: Processing ${batch.length} records...`);
        
        const result = await insertBatch(batch, countryMap);
        totalImported += result.imported;
        totalSkipped += result.skipped;
        
        process.stderr.write(` ✓ ${result.imported} imported, ${result.skipped} skipped\n`);
        batch = [];
      }
    }
    
    // Process remaining
    if (batch.length > 0) {
      batchNumber++;
      process.stderr.write(`\rBatch ${batchNumber}: Processing ${batch.length} records...`);
      
      const result = await insertBatch(batch, countryMap);
      totalImported += result.imported;
      totalSkipped += result.skipped;
      
      process.stderr.write(` ✓ ${result.imported} imported, ${result.skipped} skipped\n`);
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const recordsPerSec = Math.round(lineNumber / (duration));
    
    console.error('\n' + '='.repeat(60));
    console.error('UPLOAD COMPLETE');
    console.error('='.repeat(60));
    console.error(`Total Imported: ${totalImported}`);
    console.error(`Total Skipped: ${totalSkipped}`);
    console.error(`Total Processed: ${lineNumber}`);
    console.error(`Duration: ${duration}s`);
    console.error(`Speed: ${recordsPerSec} records/sec`);
    console.error('='.repeat(60));
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('UPLOAD FAILED');
    console.error('='.repeat(60));
    console.error(`Error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    console.error('='.repeat(60));
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
