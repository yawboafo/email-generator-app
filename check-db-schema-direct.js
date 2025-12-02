// Direct check using pg
const { Pool } = require('pg');

async function checkSchema() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Checking database schema...\n');
    
    // Check Country table
    const countrySchema = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'Country'
      ORDER BY ordinal_position;
    `);
    
    console.log('Country table schema:');
    console.table(countrySchema.rows);
    
    // Check FirstName table
    const firstNameSchema = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'FirstName'
      ORDER BY ordinal_position;
    `);
    
    console.log('\nFirstName table schema:');
    console.table(firstNameSchema.rows);
    
    // Get sample country
    const sampleCountry = await pool.query(`
      SELECT id, code, name FROM "Country" LIMIT 1;
    `);
    
    console.log('\nSample Country record:');
    console.log(sampleCountry.rows[0]);
    console.log('ID type:', typeof sampleCountry.rows[0]?.id);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();
