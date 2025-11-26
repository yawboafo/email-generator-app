import { 
  Gender, 
  Country, 
  NamePattern, 
  AgeRange, 
  AllowedCharacters
} from '@/types';
import { prisma } from './prisma';

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
 * Generate a random first name from database
 */
export async function generateFirstName(country: Country, gender: Gender): Promise<string> {
  const countryRecord = await prisma.country.findUnique({
    where: { code: country },
  });

  if (!countryRecord) {
    throw new Error(`Country ${country} not found in database`);
  }

  const whereClause: any = { countryId: countryRecord.id };
  
  if (gender !== 'any') {
    whereClause.gender = gender;
  }

  const count = await prisma.firstName.count({ where: whereClause });
  
  if (count === 0) {
    throw new Error(`No first names found for ${country} and gender ${gender}. Please import name data from the admin panel first.`);
  }

  const skip = Math.floor(Math.random() * count);
  const name = await prisma.firstName.findFirst({
    where: whereClause,
    skip,
    take: 1,
  });

  return name?.name || 'John';
}

/**
 * Generate a random last name from database
 */
export async function generateLastName(country: Country): Promise<string> {
  const countryRecord = await prisma.country.findUnique({
    where: { code: country },
  });

  if (!countryRecord) {
    throw new Error(`Country ${country} not found in database`);
  }

  const count = await prisma.lastName.count({ 
    where: { countryId: countryRecord.id } 
  });
  
  if (count === 0) {
    throw new Error(`No last names found for ${country}. Please import name data from the admin panel first.`);
  }

  const skip = Math.floor(Math.random() * count);
  const name = await prisma.lastName.findFirst({
    where: { countryId: countryRecord.id },
    skip,
    take: 1,
  });

  return name?.name || 'Doe';
}

/**
 * Get random city from database
 */
export async function getRandomCity(country: Country): Promise<string> {
  const countryRecord = await prisma.country.findUnique({
    where: { code: country },
  });

  if (!countryRecord) {
    return 'newyork';
  }

  const count = await prisma.city.count({ 
    where: { countryId: countryRecord.id } 
  });
  
  if (count === 0) {
    return 'newyork';
  }

  const skip = Math.floor(Math.random() * count);
  const city = await prisma.city.findFirst({
    where: { countryId: countryRecord.id },
    skip,
    take: 1,
  });

  return city?.name.toLowerCase().replace(/\s+/g, '') || 'newyork';
}

/**
 * Get random pattern element from database
 */
export async function getRandomPatternElement(type: string): Promise<string> {
  const count = await prisma.patternElement.count({ where: { type } });
  
  if (count === 0) {
    return type === 'petNames' ? 'luna' : type === 'hobbies' ? 'gamer' : 'newyork';
  }

  const skip = Math.floor(Math.random() * count);
  const element = await prisma.patternElement.findFirst({
    where: { type },
    skip,
    take: 1,
  });

  return element?.value || 'default';
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
      case 'firstName':
        value = (await generateFirstName(country, gender)).toLowerCase();
        break;
      case 'lastName':
        value = (await generateLastName(country)).toLowerCase();
        break;
      case 'firstInitial':
        value = (await generateFirstName(country, gender))[0].toLowerCase();
        break;
      case 'lastInitial':
        value = (await generateLastName(country))[0].toLowerCase();
        break;
      case 'city':
        value = await getRandomCity(country);
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
        // Try to get from PatternElement table
        value = await getRandomPatternElement(key);
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

  if (!request.country) {
    errors.push('Country is required');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Generate multiple email addresses
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

  for (let i = 0; i < count; i++) {
    const localPart = await generateLocalPart(
      pattern,
      country,
      gender,
      ageRange,
      interests,
      includeNumbers,
      numberRange,
      allowedCharacters
    );

    const domain = selectProvider(providers);
    emails.push(`${localPart}@${domain}`);
  }

  return emails;
}
