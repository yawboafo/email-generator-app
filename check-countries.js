// Check what countries are in the database
const { Pool } = require('pg');

async function checkCountries() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const result = await pool.query(`
      SELECT code, name FROM "Country" ORDER BY code;
    `);
    
    console.log(`Found ${result.rows.length} countries in database:\n`);
    console.table(result.rows);
    
    console.log('\n✓ Use these country codes in your CSV file');
    console.log('\nCommon codes:');
    const common = result.rows.filter(c => ['US', 'GB', 'JO', 'AE', 'SA', 'EG', 'IN', 'CA'].includes(c.code));
    common.forEach(c => console.log(`  ${c.code} - ${c.name}`));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkCountries();
