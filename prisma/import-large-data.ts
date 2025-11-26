import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import readline from 'readline';
import path from 'path';

const prisma = new PrismaClient();

/**
 * Import large datasets into the database
 * 
 * USAGE:
 * 1. Download your data sources (US Census, name-dataset, etc.)
 * 2. Place files in /data-sources directory
 * 3. Update the file paths below
 * 4. Run: tsx prisma/import-large-data.ts
 */

interface ImportStats {
  firstNames: number;
  lastNames: number;
  cities: number;
}

/**
 * Batch insert helper for performance
 */
async function batchInsert<T>(
  model: any,
  data: T[],
  chunkSize: number = 1000,
  label: string
): Promise<number> {
  let totalInserted = 0;

  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    
    try {
      await model.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      totalInserted += chunk.length;
      
      const progress = Math.min(i + chunkSize, data.length);
      console.log(`  ${label}: ${progress}/${data.length} (${Math.round(progress / data.length * 100)}%)`);
    } catch (error) {
      console.error(`  Error inserting ${label} chunk:`, error);
    }
  }

  return totalInserted;
}

/**
 * Import US Census first names
 * Download from: https://www.ssa.gov/oact/babynames/limits.html
 */
async function importUSCensusFirstNames(): Promise<number> {
  console.log('\n📊 Importing US Census first names...');
  
  const country = await prisma.country.findUnique({ where: { code: 'US' } });
  if (!country) {
    console.log('  ⚠️  US country not found, skipping');
    return 0;
  }

  // Example: yob2023.txt format: Name,Gender,Count
  // Emma,F,12345
  // Liam,M,54321
  
  const filePath = path.join(process.cwd(), 'data-sources', 'yob2023.txt');
  
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  File not found: ${filePath}`);
    console.log('  💡 Download from: https://www.ssa.gov/oact/babynames/limits.html');
    return 0;
  }

  const firstNames: any[] = [];
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream });

  for await (const line of rl) {
    const [name, gender, count] = line.split(',');
    if (name && gender) {
      firstNames.push({
        name: name.trim(),
        gender: gender === 'M' ? 'male' : 'female',
        countryId: country.id,
        frequency: parseInt(count) || 1,
      });
    }
  }

  return await batchInsert(prisma.firstName, firstNames, 1000, 'First Names');
}

/**
 * Import US Census surnames
 * Download from: https://www.census.gov/topics/population/genealogy/data/2010_surnames.html
 */
async function importUSCensusSurnames(): Promise<number> {
  console.log('\n📊 Importing US Census surnames...');
  
  const country = await prisma.country.findUnique({ where: { code: 'US' } });
  if (!country) {
    console.log('  ⚠️  US country not found, skipping');
    return 0;
  }

  // Example CSV format: name,count,prop100k,cum_prop100k,rank
  // SMITH,2442977,828.19,828.19,1
  
  const filePath = path.join(process.cwd(), 'data-sources', 'Names_2010Census.csv');
  
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  File not found: ${filePath}`);
    console.log('  💡 Download from: https://www.census.gov/topics/population/genealogy/data/2010_surnames.html');
    return 0;
  }

  const lastNames: any[] = [];
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream });

  let isFirstLine = true;
  for await (const line of rl) {
    if (isFirstLine) {
      isFirstLine = false;
      continue; // Skip header
    }

    const [name, count] = line.split(',');
    if (name) {
      // Capitalize properly: SMITH -> Smith
      const formatted = name.charAt(0) + name.slice(1).toLowerCase();
      lastNames.push({
        name: formatted,
        countryId: country.id,
        frequency: parseInt(count) || 1,
      });
    }
  }

  return await batchInsert(prisma.lastName, lastNames, 1000, 'Last Names');
}

/**
 * Import GeoNames cities
 * Download from: https://download.geonames.org/export/dump/
 * Use cities15000.zip (cities with population > 15000)
 */
async function importGeoNamesCities(): Promise<number> {
  console.log('\n🌍 Importing GeoNames cities...');
  
  // Tab-separated format:
  // geonameid, name, asciiname, alternatenames, latitude, longitude, feature_class, 
  // feature_code, country_code, cc2, admin1_code, admin2_code, admin3_code, admin4_code,
  // population, elevation, dem, timezone, modification_date
  
  const filePath = path.join(process.cwd(), 'data-sources', 'cities15000.txt');
  
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  File not found: ${filePath}`);
    console.log('  💡 Download from: https://download.geonames.org/export/dump/cities15000.zip');
    return 0;
  }

  const cityMap = new Map<string, any[]>();
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream });

  for await (const line of rl) {
    const fields = line.split('\t');
    const countryCode = fields[8]; // country_code
    const cityName = fields[1]; // name
    const population = parseInt(fields[14]) || 0; // population

    if (!cityMap.has(countryCode)) {
      cityMap.set(countryCode, []);
    }

    cityMap.get(countryCode)?.push({
      name: cityName,
      population,
    });
  }

  let totalInserted = 0;

  // Import cities for each country
  const countries = await prisma.country.findMany();
  
  for (const country of countries) {
    const citiesData = cityMap.get(country.code) || [];
    if (citiesData.length === 0) continue;

    const cities = citiesData.map(c => ({
      name: c.name,
      countryId: country.id,
      population: c.population,
    }));

    const inserted = await batchInsert(
      prisma.city,
      cities,
      1000,
      `Cities (${country.code})`
    );

    totalInserted += inserted;
  }

  return totalInserted;
}

/**
 * Main import function
 */
async function main() {
  console.log('🚀 Starting large dataset import...\n');
  console.log('📂 Make sure your data files are in: ./data-sources/\n');

  const stats: ImportStats = {
    firstNames: 0,
    lastNames: 0,
    cities: 0,
  };

  try {
    // Import US Census data
    stats.firstNames = await importUSCensusFirstNames();
    stats.lastNames = await importUSCensusSurnames();

    // Import GeoNames cities
    stats.cities = await importGeoNamesCities();

    // Print summary
    console.log('\n✨ Import Complete!\n');
    console.log('📊 Summary:');
    console.log(`  First Names: ${stats.firstNames.toLocaleString()}`);
    console.log(`  Last Names: ${stats.lastNames.toLocaleString()}`);
    console.log(`  Cities: ${stats.cities.toLocaleString()}`);
    console.log(`  Total Records: ${(stats.firstNames + stats.lastNames + stats.cities).toLocaleString()}`);

    // Show current database counts
    console.log('\n📈 Total Database Counts:');
    const counts = await Promise.all([
      prisma.country.count(),
      prisma.firstName.count(),
      prisma.lastName.count(),
      prisma.city.count(),
      prisma.emailProvider.count(),
      prisma.patternElement.count(),
    ]);

    console.log(`  Countries: ${counts[0].toLocaleString()}`);
    console.log(`  First Names: ${counts[1].toLocaleString()}`);
    console.log(`  Last Names: ${counts[2].toLocaleString()}`);
    console.log(`  Cities: ${counts[3].toLocaleString()}`);
    console.log(`  Email Providers: ${counts[4].toLocaleString()}`);
    console.log(`  Pattern Elements: ${counts[5].toLocaleString()}`);

  } catch (error) {
    console.error('❌ Error during import:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('❌ Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
