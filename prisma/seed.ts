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
  
  // Dynamically get all pattern types from the JSON file
  const patternTypes = Object.keys(patternsData) as Array<keyof typeof patternsData>;
  
  for (const type of patternTypes) {
    const elements = patternsData[type];
    if (Array.isArray(elements) && elements.length > 0) {
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

  // 4. Seed Pattern Definitions
  console.log('\n📋 Seeding pattern definitions...');
  
  const patternDefinitions = [
    // Name-based patterns
    { name: 'firstname.lastname', template: '{firstName}.{lastName}', description: 'First name dot last name', category: 'name-based' },
    { name: 'firstnamelastname', template: '{firstName}{lastName}', description: 'First name and last name combined', category: 'name-based' },
    { name: 'firstinitiallastname', template: '{firstInitial}{lastName}', description: 'First initial and last name', category: 'name-based' },
    { name: 'firstname_lastname', template: '{firstName}_{lastName}', description: 'First name underscore last name', category: 'name-based' },
    { name: 'firstnamelastinitial', template: '{firstName}{lastInitial}', description: 'First name and last initial', category: 'name-based' },
    
    // Creative patterns
    { name: 'nickname', template: '{nickname}', description: 'Nickname based on interests', category: 'creative' },
    { name: 'petname', template: '{petNames}', description: 'Random pet name (buddy, max, luna)', category: 'creative' },
    { name: 'hobby', template: '{hobbies}', description: 'Hobby-based (gamer, artist, coder)', category: 'creative' },
    { name: 'city', template: '{city}', description: 'City name (newyork, london, tokyo)', category: 'creative' },
    
    // Combination patterns
    { name: 'firstname_pet', template: '{firstName}{petNames}', description: 'First name + pet name', category: 'combination' },
    { name: 'firstname_city', template: '{firstName}{city}', description: 'First name + city', category: 'combination' },
    { name: 'firstname_hobby', template: '{firstName}{hobbies}', description: 'First name + hobby', category: 'combination' },
    { name: 'adjective_noun', template: '{adjectives}{things}', description: 'Adjective + noun (coolstar)', category: 'combination' },
    { name: 'color_thing', template: '{colors}{things}', description: 'Color + thing (bluemoon)', category: 'combination' },
    { name: 'thing_year', template: '{things}{years}', description: 'Thing + year (dragon2000)', category: 'combination' },
    
    // Random pattern
    { name: 'random', template: '{random}', description: 'Random pattern selection', category: 'random' },
  ];

  for (const pattern of patternDefinitions) {
    await prisma.pattern.upsert({
      where: { name: pattern.name },
      update: {
        template: pattern.template,
        description: pattern.description,
        category: pattern.category,
      },
      create: {
        name: pattern.name,
        template: pattern.template,
        description: pattern.description,
        category: pattern.category,
        active: true,
      },
    });
    console.log(`  ✓ ${pattern.name}`);
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
    prisma.pattern.count(),
  ]);

  console.log('📊 Summary:');
  console.log(`  Countries: ${counts[0]}`);
  console.log(`  First Names: ${counts[1]}`);
  console.log(`  Last Names: ${counts[2]}`);
  console.log(`  Cities: ${counts[3]}`);
  console.log(`  Email Providers: ${counts[4]}`);
  console.log(`  Pattern Elements: ${counts[5]}`);
  console.log(`  Patterns: ${counts[6]}`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
