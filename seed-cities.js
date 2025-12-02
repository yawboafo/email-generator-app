const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:jJwYfEvKUqaDBTipqeXXuKJGQVREtEfx@ballast.proxy.rlwy.net:12936/railway';

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seedCities() {
  try {
    console.log('🌍 Starting city import...\n');

    const citiesData = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data/cities.json'), 'utf8')
    );

    let totalImported = 0;
    let totalSkipped = 0;

    for (const [countryCode, cities] of Object.entries(citiesData)) {
      console.log(`\n📍 Processing ${countryCode}...`);

      // Get country record
      const country = await prisma.country.findUnique({
        where: { code: countryCode }
      });

      if (!country) {
        console.log(`  ⚠️  Country ${countryCode} not found in database, skipping`);
        totalSkipped += cities.length;
        continue;
      }

      let countryImported = 0;
      let countrySkipped = 0;

      // Import cities for this country
      for (const cityName of cities) {
        try {
          await prisma.city.create({
            data: {
              name: cityName,
              countryId: country.id
            }
          });
          countryImported++;
        } catch (err) {
          // Skip if already exists
          countrySkipped++;
        }
      }

      console.log(`  ✓ Imported ${countryImported} cities`);
      if (countrySkipped > 0) {
        console.log(`  ⚠️  Skipped ${countrySkipped} duplicate cities`);
      }

      totalImported += countryImported;
      totalSkipped += countrySkipped;
    }

    console.log(`\n✅ City import complete!`);
    console.log(`   Total imported: ${totalImported}`);
    console.log(`   Total skipped: ${totalSkipped}`);

  } catch (error) {
    console.error('❌ Error seeding cities:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

seedCities();
