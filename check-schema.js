const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  log: ['error'],
});

async function checkSchema() {
  try {
    // Check a sample FirstName record
    const firstName = await prisma.firstName.findFirst();
    console.log('Sample FirstName record:', JSON.stringify(firstName, null, 2));

    // Check Country
    const country = await prisma.country.findFirst();
    console.log('\nSample Country record:', JSON.stringify(country, null, 2));

    // Get column info from raw query
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'FirstName'
      ORDER BY ordinal_position;
    `;
    console.log('\nFirstName table structure:', result);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSchema();
