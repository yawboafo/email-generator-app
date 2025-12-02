import { prisma } from './lib/prisma.js';

async function checkCountryIdType() {
  try {
    // Check what type countryId actually is
    const result = await prisma.$queryRaw`
      SELECT 
        column_name, 
        data_type, 
        character_maximum_length,
        is_nullable
      FROM information_schema.columns
      WHERE table_name IN ('Country', 'FirstName', 'LastName')
      ORDER BY table_name, ordinal_position;
    `;
    
    console.log('Database schema:');
    console.log(JSON.stringify(result, null, 2));
    
    // Check a sample country
    const country = await prisma.country.findFirst();
    console.log('\nSample Country:', country);
    console.log('Country ID type:', typeof country?.id);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCountryIdType();
