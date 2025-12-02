const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const fs = require('fs');
const path = require('path');

// Read cities data
const citiesData = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'cities-comprehensive.json'), 'utf8')
);

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('🌍 Starting comprehensive city import...\n');

  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  try {
    // Get all countries from database
    const countries = await prisma.country.findMany({
      select: { code: true, id: true, name: true }
    });

    const countryMap = new Map(countries.map(c => [c.code, c]));

    console.log(`Found ${countries.length} countries in database`);
    console.log(`Processing ${Object.keys(citiesData).length} countries from JSON\n`);

    for (const [countryCode, cities] of Object.entries(citiesData)) {
      const country = countryMap.get(countryCode);
      
      if (!country) {
        console.log(`⚠️  ${countryCode}: Country not in database, skipping ${cities.length} cities`);
        totalSkipped += cities.length;
        continue;
      }

      let countryImported = 0;
      let countrySkipped = 0;
      let countryErrors = 0;

      for (const cityName of cities) {
        try {
          // Check if city already exists
          const existing = await prisma.city.findFirst({
            where: {
              name: cityName,
              countryId: country.id
            }
          });

          if (existing) {
            countrySkipped++;
            continue;
          }

          // Create city
          await prisma.city.create({
            data: {
              name: cityName,
              countryId: country.id
            }
          });

          countryImported++;
        } catch (error) {
          countryErrors++;
          console.error(`   Error adding ${cityName}:`, error.message);
        }
      }

      totalImported += countryImported;
      totalSkipped += countrySkipped;
      totalErrors += countryErrors;

      if (countryImported > 0 || countryErrors > 0) {
        console.log(`✅ ${countryCode} (${country.name}): ${countryImported} imported, ${countrySkipped} skipped, ${countryErrors} errors`);
      } else {
        console.log(`   ${countryCode}: All ${countrySkipped} cities already exist`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ City import complete!\n');
    console.log(`📊 Summary:`);
    console.log(`   Total imported: ${totalImported}`);
    console.log(`   Total skipped (duplicates): ${totalSkipped}`);
    console.log(`   Total errors: ${totalErrors}`);
    console.log(`   Total processed: ${totalImported + totalSkipped + totalErrors}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error during import:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
