// Test CSV parsing logic
const testCSV = `first_name,last_name,gender,country_code
John,Doe,M,US
Jane,Smith,F,GB
Ahmed,,M,JO
,Hassan,M,JO
Sara,Ali,F,JO`;

function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  console.log('Headers:', headers);
  console.log('\nParsing rows:\n');
  
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    console.log(`Row ${i}:`, JSON.stringify(row));
    console.log(`  first_name: "${row.first_name}" (empty: ${!row.first_name})`);
    console.log(`  country_code: "${row.country_code}" (empty: ${!row.country_code})`);
    
    if (!row.first_name || !row.country_code) {
      console.log(`  ❌ SKIP: Missing required fields`);
    } else {
      console.log(`  ✓ Valid`);
    }
    console.log('');
    
    data.push(row);
  }
  
  return data;
}

console.log('Testing CSV parsing:\n');
parseCSV(testCSV);

console.log('\n\n=== Expected Format ===');
console.log('Your CSV should look like this:');
console.log(testCSV);
console.log('\n=== Requirements ===');
console.log('- first_name: Required, cannot be empty');
console.log('- last_name: Optional, can be empty');
console.log('- gender: Optional (M/F), can be empty (defaults to neutral)');
console.log('- country_code: Required, cannot be empty (e.g., US, GB, JO)');
console.log('\n=== Common Issues ===');
console.log('1. Empty first_name values will be skipped');
console.log('2. Empty country_code values will be skipped');
console.log('3. Make sure country codes match those in your database (run: railway run node check-countries.js)');
