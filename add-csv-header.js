// Add header to JO.csv file
const fs = require('fs');
const path = require('path');

const inputFile = '/Users/nykb/Desktop/name_dataset/data/JO.csv';
const outputFile = '/Users/nykb/Desktop/name_dataset/data/JO_with_header.csv';

console.log('Adding header to CSV file...');
console.log(`Input: ${inputFile}`);
console.log(`Output: ${outputFile}`);

// Header to add
const header = 'first_name,last_name,gender,country_code\n';

// Create read stream from input
const readStream = fs.createReadStream(inputFile);
const writeStream = fs.createWriteStream(outputFile);

// Write header first
writeStream.write(header);

// Pipe the rest of the file
readStream.pipe(writeStream);

writeStream.on('finish', () => {
  console.log('\n✓ Successfully created CSV with header!');
  console.log(`\nNew file: ${outputFile}`);
  console.log('\nNow you can upload this file in the admin dashboard.');
});

readStream.on('error', (err) => {
  console.error('Error reading file:', err);
});

writeStream.on('error', (err) => {
  console.error('Error writing file:', err);
});
