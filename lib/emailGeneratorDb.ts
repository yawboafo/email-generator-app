import { 
  Gender, 
  Country, 
  NamePattern, 
  AgeRange, 
  AllowedCharacters
} from '@/types';
import { prisma } from './prisma';
import { Prisma } from '@prisma/client';

/**
 * Get a random item from an array
 */
function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Get a random number within a range
 */
function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Cache for country IDs to avoid repeated lookups
 */
const countryIdCache = new Map<string, string>();

/**
 * Get country ID with caching
 */
async function getCountryId(country: Country): Promise<string> {
  if (countryIdCache.has(country)) {
    return countryIdCache.get(country)!;
  }

  const countryRecord = await prisma.country.findUnique({
    where: { code: country },
  });

  if (!countryRecord) {
    throw new Error(`Country ${country} not found in database`);
  }

  countryIdCache.set(country, countryRecord.id);
  return countryRecord.id;
}

/**
 * Fetch a batch of random first names at once
 */
export async function fetchFirstNameBatch(country: Country, gender: Gender, batchSize: number): Promise<string[]> {
  const countryId = await getCountryId(country);

  const whereClause: any = { countryId };
  
  if (gender !== 'any') {
    whereClause.gender = gender;
  }

  // Use raw SQL for better performance with large datasets
  const names = gender !== 'any'
    ? await prisma.$queryRaw<Array<{ name: string }>>(
        Prisma.sql`SELECT name FROM "FirstName" 
         WHERE "countryId" = ${countryId} AND gender = ${gender}
         ORDER BY RANDOM() 
         LIMIT ${batchSize}`
      )
    : await prisma.$queryRaw<Array<{ name: string }>>(
        Prisma.sql`SELECT name FROM "FirstName" 
         WHERE "countryId" = ${countryId}
         ORDER BY RANDOM() 
         LIMIT ${batchSize}`
      );

  if (names.length === 0) {
    throw new Error(`No first names found for ${country} and gender ${gender}. Please import name data from the admin panel first.`);
  }

  return names.map(n => n.name);
}

/**
 * Generate a random first name from database
 */
export async function generateFirstName(country: Country, gender: Gender): Promise<string> {
  const batch = await fetchFirstNameBatch(country, gender, 1);
  return batch[0] || 'John';
}

/**
 * Fetch a batch of random last names at once
 */
export async function fetchLastNameBatch(country: Country, batchSize: number): Promise<string[]> {
  const countryId = await getCountryId(country);

  // Use raw SQL for better performance with large datasets
  const names = await prisma.$queryRaw<Array<{ name: string }>>(
    Prisma.sql`SELECT name FROM "LastName" 
     WHERE "countryId" = ${countryId}
     ORDER BY RANDOM() 
     LIMIT ${batchSize}`
  );
  
  if (names.length === 0) {
    throw new Error(`No last names found for ${country}. Please import name data from the admin panel first.`);
  }

  return names.map(n => n.name);
}

/**
 * Generate a random last name from database
 */
export async function generateLastName(country: Country): Promise<string> {
  const batch = await fetchLastNameBatch(country, 1);
  return batch[0] || 'Doe';
}

/**
 * Fetch a batch of random cities at once
 */
export async function fetchCityBatch(country: Country, batchSize: number): Promise<string[]> {
  const countryId = await getCountryId(country);

  // Use raw SQL for better performance
  const cities = await prisma.$queryRaw<Array<{ name: string }>>(
    Prisma.sql`SELECT name FROM "City" 
     WHERE "countryId" = ${countryId}
     ORDER BY RANDOM() 
     LIMIT ${batchSize}`
  );
  
  if (cities.length === 0) {
    return ['newyork']; // Fallback
  }

  return cities.map(c => c.name.toLowerCase().replace(/\s+/g, ''));
}

/**
 * Get random city from database
 */
export async function getRandomCity(country: Country): Promise<string> {
  try {
    const batch = await fetchCityBatch(country, 1);
    return batch[0] || 'newyork';
  } catch (error) {
    return 'newyork';
  }
}

/**
 * Get random pattern element from database
 */
export async function getRandomPatternElement(type: string): Promise<string> {
  const count = await prisma.patternElement.count({ where: { type } });
  
  if (count === 0) {
    // Fallback values for each type
    const fallbacks: { [key: string]: string } = {
      'petNames': 'luna',
      'hobbies': 'gamer',
      'adjectives': 'cool',
      'things': 'star',
      'colors': 'blue',
      'years': '2000'
    };
    return fallbacks[type] || 'value';
  }

  const skip = Math.floor(Math.random() * count);
  const element = await prisma.patternElement.findFirst({
    where: { type },
    skip,
    take: 1,
  });

  return element?.value || 'value';
}

/**
 * Parse and resolve a pattern template
 * Replaces placeholders like {firstName}, {colors}, {things} with actual values
 */
async function parsePatternTemplate(
  template: string,
  country: Country,
  gender: Gender,
  ageRange: AgeRange,
  interests: string[]
): Promise<string> {
  let result = template;
  
  // Extract all placeholders from template
  const placeholders = template.match(/\{([^}]+)\}/g) || [];
  
  for (const placeholder of placeholders) {
    const key = placeholder.slice(1, -1); // Remove { and }
    let value = '';
    
    switch (key) {
      case 'firstname':
      case 'firstName':
        value = (await generateFirstName(country, gender)).toLowerCase();
        break;
      case 'lastname':
      case 'lastName':
        value = (await generateLastName(country)).toLowerCase();
        break;
      case 'firstinitial':
      case 'firstInitial':
        value = (await generateFirstName(country, gender))[0].toLowerCase();
        break;
      case 'lastinitial':
      case 'lastInitial':
        value = (await generateLastName(country))[0].toLowerCase();
        break;
      case 'city':
        value = await getRandomCity(country);
        break;
      case 'number':
        value = getRandomNumber(1, 999).toString();
        break;
      case 'year':
        value = getRandomNumber(1990, 2009).toString();
        break;
      case 'petname':
      case 'petName':
        value = await getRandomPatternElement('petNames');
        break;
      case 'hobby':
        value = await getRandomPatternElement('hobbies');
        break;
      case 'adjective':
        value = await getRandomPatternElement('adjectives');
        break;
      case 'thing':
        value = await getRandomPatternElement('things');
        break;
      case 'color':
        value = await getRandomPatternElement('colors');
        break;
      case 'nickname':
        value = await generateNickname(interests, ageRange, country, gender);
        break;
      case 'random':
        // For random, pick a random simple pattern
        const randomPatterns = [
          '{firstName}.{lastName}',
          '{firstName}{lastName}',
          '{firstName}_{lastName}',
          '{firstName}{lastInitial}',
        ];
        const randomTemplate = getRandomItem(randomPatterns);
        value = await parsePatternTemplate(randomTemplate, country, gender, ageRange, interests);
        break;
      default:
        // Unknown placeholder - use empty string
        value = '';
        console.warn(`Unknown placeholder: ${key}`);
    }
    
    result = result.replace(placeholder, value);
  }
  
  return result;
}

/**
 * Generate a nickname based on interests and age range
 */
async function generateNickname(
  interests: string[], 
  ageRange: AgeRange,
  country: Country,
  gender: Gender
): Promise<string> {
  const nicknamePrefixes = ['cool', 'real', 'the', 'just', 'mr', 'ms', 'x', 'super', 'pro'];
  const nicknameSuffixes = ['kid', 'dude', 'gal', 'guy', 'star', 'master', 'ninja', 'king', 'queen'];
  
  // Younger users tend to have more creative nicknames
  if (ageRange === '18-25' || ageRange === '26-35') {
    if (interests.length > 0 && Math.random() > 0.4) {
      const interest = getRandomItem(interests).toLowerCase().replace(/\s+/g, '');
      const num = Math.random() > 0.5 ? getRandomNumber(1, 999) : '';
      return `${interest}${num}`;
    }
    
    const firstName = await generateFirstName(country, gender);
    if (Math.random() > 0.5) {
      return `${getRandomItem(nicknamePrefixes)}${firstName.toLowerCase()}`;
    } else {
      return `${firstName.toLowerCase()}${getRandomItem(nicknameSuffixes)}`;
    }
  }
  
  // Older users tend to use simpler names
  const firstName = await generateFirstName(country, gender);
  return firstName.toLowerCase();
}

/**
 * Apply character restrictions to a string
 */
function applyCharacterRestrictions(
  str: string, 
  allowedCharacters: AllowedCharacters
): string {
  let result = str;

  if (!allowedCharacters.underscore) {
    result = result.replace(/_/g, '');
  }
  if (!allowedCharacters.dot) {
    result = result.replace(/\./g, '');
  }
  if (!allowedCharacters.numbers) {
    result = result.replace(/\d/g, '');
  }

  // Remove any non-allowed characters
  if (!allowedCharacters.letters) {
    result = result.replace(/[a-zA-Z]/g, '');
  }

  return result;
}

/**
 * Add random numbers based on age range and settings
 */
function addRandomNumbers(
  base: string,
  includeNumbers: boolean,
  numberRange: [number, number],
  ageRange: AgeRange,
  allowedCharacters: AllowedCharacters
): string {
  if (!includeNumbers || !allowedCharacters.numbers) {
    return base;
  }

  // Younger users are more likely to have numbers
  const probability = ageRange === '18-25' ? 0.8 : 
                      ageRange === '26-35' ? 0.6 :
                      ageRange === '36-45' ? 0.4 : 0.2;

  if (Math.random() < probability) {
    const num = getRandomNumber(numberRange[0], numberRange[1]);
    return `${base}${num}`;
  }

  return base;
}

/**
 * Generate email local part (before @) based on pattern
 */
async function generateLocalPart(
  pattern: NamePattern,
  country: Country,
  gender: Gender,
  ageRange: AgeRange,
  interests: string[],
  includeNumbers: boolean,
  numberRange: [number, number],
  allowedCharacters: AllowedCharacters
): Promise<string> {
  const firstName = (await generateFirstName(country, gender)).toLowerCase();
  const lastName = (await generateLastName(country)).toLowerCase();
  
  // Look up pattern template from database
  const patternRecord = await prisma.pattern.findUnique({
    where: { name: pattern, active: true },
  });

  let localPart = '';
  
  if (patternRecord) {
    // Use dynamic template parsing
    localPart = await parsePatternTemplate(
      patternRecord.template,
      country,
      gender,
      ageRange,
      interests
    );
  } else {
    // Fallback to default pattern if not found
    console.warn(`Pattern "${pattern}" not found in database, using default`);
    localPart = `${firstName}.${lastName}`;
  }

  // Apply character restrictions
  localPart = applyCharacterRestrictions(localPart, allowedCharacters);

  // Add numbers if applicable
  localPart = addRandomNumbers(localPart, includeNumbers, numberRange, ageRange, allowedCharacters);

  // Ensure valid email format
  localPart = localPart.replace(/[^a-z0-9._-]/g, '').replace(/^[._-]+|[._-]+$/g, '');

  return localPart || 'user';
}

/**
 * Get active email providers from database
 * @param providerDomainsOrIds - Can be domains (gmail.com) or provider IDs (gmail)
 */
export async function getActiveProviders(providerDomainsOrIds?: string[]): Promise<Array<{ domain: string, popularity: number }>> {
  const where: any = { active: true };
  
  if (providerDomainsOrIds && providerDomainsOrIds.length > 0) {
    // Support both domains (gmail.com) and provider IDs (gmail)
    where.OR = [
      { domain: { in: providerDomainsOrIds } },
      { providerId: { in: providerDomainsOrIds } }
    ];
  }

  const providers = await prisma.emailProvider.findMany({
    where,
    select: {
      domain: true,
      popularity: true,
    },
  });

  return providers;
}

/**
 * Select a provider based on popularity weights
 */
function selectProvider(providers: Array<{ domain: string, popularity: number }>): string {
  const totalWeight = providers.reduce((sum, p) => sum + p.popularity, 0);
  let random = Math.random() * totalWeight;

  for (const provider of providers) {
    random -= provider.popularity;
    if (random <= 0) {
      return provider.domain;
    }
  }

  return providers[0].domain;
}

/**
 * Get a random country from the database that has both first names and last names
 */
export async function getRandomCountry(): Promise<Country> {
  // Get all countries that have both first names and last names
  const countries = await prisma.country.findMany({
    where: {
      FirstName: {
        some: {}
      },
      LastName: {
        some: {}
      }
    },
    select: {
      code: true,
      _count: {
        select: {
          FirstName: true,
          LastName: true
        }
      }
    }
  });
  
  if (countries.length === 0) {
    throw new Error('No countries with name data found in database. Please import name data from the admin panel first.');
  }

  // Pick a random country from those that have data
  const randomCountry = countries[Math.floor(Math.random() * countries.length)];
  return randomCountry.code as Country;
}

/**
 * Validate generation request
 */
export function validateRequest(request: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (!request.count || request.count < 1 || request.count > 10000) {
    errors.push('Count must be between 1 and 10000');
  }

  if (!request.providers || !Array.isArray(request.providers) || request.providers.length === 0) {
    errors.push('At least one provider must be selected');
  }

  // Country is no longer required - will default to random if not provided

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Generate multiple email addresses with batched database queries for performance
 */
export async function generateEmails(
  count: number,
  providerIds: string[],
  country: Country = 'US',
  ageRange: AgeRange = '18-25',
  gender: Gender = 'any',
  interests: string[] = [],
  pattern: NamePattern = 'random',
  includeNumbers: boolean = true,
  numberRange: [number, number] = [1, 999],
  allowedCharacters: AllowedCharacters = {
    letters: true,
    numbers: true,
    dot: true,
    underscore: true
  }
): Promise<string[]> {
  const emails: string[] = [];
  const providers = await getActiveProviders(providerIds);

  if (providers.length === 0) {
    throw new Error('No active providers found');
  }

  // Batch size for database queries - fetch names in chunks
  const batchSize = Math.min(count * 2, 1000); // Fetch extra in case of duplicates
  
  // Pre-fetch batches of names to avoid repeated DB queries
  const firstNameBatch = await fetchFirstNameBatch(country, gender, batchSize);
  const lastNameBatch = await fetchLastNameBatch(country, batchSize);
  
  let firstNameIndex = 0;
  let lastNameIndex = 0;

  for (let i = 0; i < count; i++) {
    // Refetch if we run out of names
    if (firstNameIndex >= firstNameBatch.length) {
      const newBatch = await fetchFirstNameBatch(country, gender, batchSize);
      firstNameBatch.push(...newBatch);
    }
    if (lastNameIndex >= lastNameBatch.length) {
      const newBatch = await fetchLastNameBatch(country, batchSize);
      lastNameBatch.push(...newBatch);
    }

    const localPart = await generateLocalPartWithBatch(
      pattern,
      country,
      gender,
      ageRange,
      interests,
      includeNumbers,
      numberRange,
      allowedCharacters,
      firstNameBatch[firstNameIndex],
      lastNameBatch[lastNameIndex]
    );

    firstNameIndex++;
    lastNameIndex++;

    const domain = selectProvider(providers);
    emails.push(`${localPart}@${domain}`);
  }

  return emails;
}

/**
 * Generate email local part using pre-fetched names for better performance
 */
async function generateLocalPartWithBatch(
  pattern: NamePattern,
  country: Country,
  gender: Gender,
  ageRange: AgeRange,
  interests: string[],
  includeNumbers: boolean,
  numberRange: [number, number],
  allowedCharacters: AllowedCharacters,
  firstName: string,
  lastName: string
): Promise<string> {
  const firstNameLower = firstName.toLowerCase();
  const lastNameLower = lastName.toLowerCase();
  
  // Look up pattern template from database
  const patternRecord = await prisma.pattern.findUnique({
    where: { name: pattern, active: true },
  });

  let localPart = '';
  
  if (patternRecord) {
    // Use dynamic template parsing with pre-fetched names
    localPart = await parsePatternTemplateWithBatch(
      patternRecord.template,
      country,
      gender,
      ageRange,
      interests,
      firstNameLower,
      lastNameLower
    );
  } else {
    // Fallback to default pattern if not found
    console.warn(`Pattern "${pattern}" not found in database, using default`);
    localPart = `${firstNameLower}.${lastNameLower}`;
  }

  // Apply character restrictions
  localPart = applyCharacterRestrictions(localPart, allowedCharacters);

  // Add numbers if applicable
  localPart = addRandomNumbers(localPart, includeNumbers, numberRange, ageRange, allowedCharacters);

  // Ensure valid email format
  localPart = localPart.replace(/[^a-z0-9._-]/g, '').replace(/^[._-]+|[._-]+$/g, '');

  return localPart || 'user';
}

/**
 * Parse pattern template with pre-fetched names
 */
async function parsePatternTemplateWithBatch(
  template: string,
  country: Country,
  gender: Gender,
  ageRange: AgeRange,
  interests: string[],
  firstName: string,
  lastName: string
): Promise<string> {
  let result = template;
  
  // Extract all placeholders from template
  const placeholders = template.match(/\{([^}]+)\}/g) || [];
  
  for (const placeholder of placeholders) {
    const key = placeholder.slice(1, -1); // Remove { and }
    let value = '';
    
    switch (key) {
      case 'firstname':
      case 'firstName':
        value = firstName;
        break;
      case 'lastname':
      case 'lastName':
        value = lastName;
        break;
      case 'firstinitial':
      case 'firstInitial':
        value = firstName[0];
        break;
      case 'lastinitial':
      case 'lastInitial':
        value = lastName[0];
        break;
      case 'city':
        value = await getRandomCity(country);
        break;
      case 'number':
        value = getRandomNumber(1, 999).toString();
        break;
      case 'year':
        value = getRandomNumber(1990, 2009).toString();
        break;
      case 'petname':
      case 'petName':
        value = await getRandomPatternElement('petNames');
        break;
      case 'hobby':
        value = await getRandomPatternElement('hobbies');
        break;
      case 'adjective':
        value = await getRandomPatternElement('adjectives');
        break;
      case 'thing':
        value = await getRandomPatternElement('things');
        break;
      case 'color':
        value = await getRandomPatternElement('colors');
        break;
      case 'nickname':
        value = await generateNicknameWithBatch(interests, ageRange, country, gender, firstName);
        break;
      case 'random':
        // For random, pick a random simple pattern
        const randomPatterns = [
          '{firstName}.{lastName}',
          '{firstName}{lastName}',
          '{firstName}_{lastName}',
          '{firstName}{lastInitial}',
        ];
        const randomTemplate = getRandomItem(randomPatterns);
        value = await parsePatternTemplateWithBatch(randomTemplate, country, gender, ageRange, interests, firstName, lastName);
        break;
      default:
        // Unknown placeholder - use empty string
        value = '';
        console.warn(`Unknown placeholder: ${key}`);
    }
    
    result = result.replace(placeholder, value);
  }
  
  return result;
}

/**
 * Generate a nickname with pre-fetched first name
 */
async function generateNicknameWithBatch(
  interests: string[], 
  ageRange: AgeRange,
  country: Country,
  gender: Gender,
  firstName: string
): Promise<string> {
  const nicknamePrefixes = ['cool', 'real', 'the', 'just', 'mr', 'ms', 'x', 'super', 'pro'];
  const nicknameSuffixes = ['kid', 'dude', 'gal', 'guy', 'star', 'master', 'ninja', 'king', 'queen'];
  
  // Younger users tend to have more creative nicknames
  if (ageRange === '18-25' || ageRange === '26-35') {
    if (interests.length > 0 && Math.random() > 0.4) {
      const interest = getRandomItem(interests).toLowerCase().replace(/\s+/g, '');
      const num = Math.random() > 0.5 ? getRandomNumber(1, 999) : '';
      return `${interest}${num}`;
    }
    
    if (Math.random() > 0.5) {
      return `${getRandomItem(nicknamePrefixes)}${firstName.toLowerCase()}`;
    } else {
      return `${firstName.toLowerCase()}${getRandomItem(nicknameSuffixes)}`;
    }
  }
  
  // Older users tend to use simpler names
  return firstName.toLowerCase();
}
