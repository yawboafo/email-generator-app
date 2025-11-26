import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import namesData from '../data/names.json';
import providersData from '../data/providers.json';
import patternsData from '../data/patterns.json';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seed...\n');

  // 1. Seed Countries and Names
  console.log('📍 Seeding countries and names...');
  
  const countryMap: Record<string, string> = {
    'US': 'United States',
    'GH': 'Ghana',
    'UK': 'United Kingdom',
    'NG': 'Nigeria',
    'IN': 'India',
    'CA': 'Canada'
  };

  for (const [code, data] of Object.entries(namesData)) {
    console.log(`  → Processing ${code}...`);
    
    // Create country
    const country = await prisma.country.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name: countryMap[code] || code,
      },
    });

    const countryData = data as any;

    // Seed first names (male)
    if (countryData.firstNames?.male) {
      for (const name of countryData.firstNames.male) {
        await prisma.firstName.upsert({
          where: {
            name_countryId_gender: {
              name,
              countryId: country.id,
              gender: 'male',
            },
          },
          update: {},
          create: {
            name,
            gender: 'male',
            countryId: country.id,
            frequency: 1,
          },
        });
      }
    }

    // Seed first names (female)
    if (countryData.firstNames?.female) {
      for (const name of countryData.firstNames.female) {
        await prisma.firstName.upsert({
          where: {
            name_countryId_gender: {
              name,
              countryId: country.id,
              gender: 'female',
            },
          },
          update: {},
          create: {
            name,
            gender: 'female',
            countryId: country.id,
            frequency: 1,
          },
        });
      }
    }

    // Seed first names (neutral)
    if (countryData.firstNames?.neutral) {
      for (const name of countryData.firstNames.neutral) {
        await prisma.firstName.upsert({
          where: {
            name_countryId_gender: {
              name,
              countryId: country.id,
              gender: 'neutral',
            },
          },
          update: {},
          create: {
            name,
            gender: 'neutral',
            countryId: country.id,
            frequency: 1,
          },
        });
      }
    }

    // Seed last names
    if (countryData.lastNames) {
      for (const name of countryData.lastNames) {
        await prisma.lastName.upsert({
          where: {
            name_countryId: {
              name,
              countryId: country.id,
            },
          },
          update: {},
          create: {
            name,
            countryId: country.id,
            frequency: 1,
          },
        });
      }
    }

    // Seed cities
    if (countryData.cities) {
      for (const name of countryData.cities) {
        await prisma.city.upsert({
          where: {
            name_countryId: {
              name,
              countryId: country.id,
            },
          },
          update: {},
          create: {
            name,
            countryId: country.id,
          },
        });
      }
    }

    console.log(`  ✓ ${code} completed`);
  }

  // 2. Seed Email Providers
  console.log('\n📧 Seeding email providers...');
  
  for (const provider of providersData) {
    await prisma.emailProvider.upsert({
      where: { providerId: provider.id },
      update: {
        name: provider.name,
        domain: provider.domain,
        popularity: provider.popularity,
      },
      create: {
        providerId: provider.id,
        name: provider.name,
        domain: provider.domain,
        popularity: provider.popularity,
        active: true,
      },
    });
    console.log(`  ✓ ${provider.name}`);
  }

  // 3. Seed Pattern Elements
  console.log('\n🎨 Seeding pattern elements...');
  
  const patternTypes: Array<keyof typeof patternsData> = ['petNames', 'cities', 'hobbies'];
  
  for (const type of patternTypes) {
    const elements = patternsData[type];
    if (elements) {
      for (const value of elements) {
        await prisma.patternElement.upsert({
          where: {
            type_value: {
              type,
              value,
            },
          },
          update: {},
          create: {
            type,
            value,
          },
        });
      }
      console.log(`  ✓ ${type}: ${elements.length} elements`);
    }
  }

  console.log('\n✨ Database seeding completed successfully!\n');
  
  // Print summary
  const counts = await Promise.all([
    prisma.country.count(),
    prisma.firstName.count(),
    prisma.lastName.count(),
    prisma.city.count(),
    prisma.emailProvider.count(),
    prisma.patternElement.count(),
  ]);

  console.log('📊 Summary:');
  console.log(`  Countries: ${counts[0]}`);
  console.log(`  First Names: ${counts[1]}`);
  console.log(`  Last Names: ${counts[2]}`);
  console.log(`  Cities: ${counts[3]}`);
  console.log(`  Email Providers: ${counts[4]}`);
  console.log(`  Pattern Elements: ${counts[5]}`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
