import { 
  Gender, 
  Country, 
  NamePattern, 
  AgeRange, 
  AllowedCharacters,
  NameData
} from '@/types';
import namesData from '@/data/names.json';
import patternsData from '@/data/patterns.json';

const names = namesData as NameData;
const patterns = patternsData as {
  petNames: string[];
  cities: string[];
  hobbies: string[];
  adjectives: string[];
  things: string[];
  colors: string[];
  years: string[];
};

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
 * Generate a random first name based on country and gender
 */
export function generateFirstName(country: Country, gender: Gender): string {
  const countryData = names[country];
  if (!countryData) {
    throw new Error(`Country ${country} not found in name data`);
  }

  let namePool: string[] = [];
  
  if (gender === 'any') {
    namePool = [
      ...countryData.firstNames.male,
      ...countryData.firstNames.female,
      ...countryData.firstNames.neutral
    ];
  } else {
    namePool = countryData.firstNames[gender] || countryData.firstNames.neutral;
  }

  return getRandomItem(namePool);
}

/**
 * Generate a random last name based on country
 */
export function generateLastName(country: Country): string {
  const countryData = names[country];
  if (!countryData) {
    throw new Error(`Country ${country} not found in name data`);
  }

  return getRandomItem(countryData.lastNames);
}

/**
 * Generate a nickname based on interests and age range
 */
function generateNickname(
  interests: string[], 
  ageRange: AgeRange,
  country: Country,
  gender: Gender
): string {
  const nicknamePrefixes = ['cool', 'real', 'the', 'just', 'mr', 'ms', 'x', 'super', 'pro'];
  const nicknameSuffixes = ['kid', 'dude', 'gal', 'guy', 'star', 'master', 'ninja', 'king', 'queen'];
  
  // Younger users tend to have more creative nicknames
  if (ageRange === '18-25' || ageRange === '26-35') {
    if (interests.length > 0 && Math.random() > 0.4) {
      const interest = getRandomItem(interests).toLowerCase().replace(/\s+/g, '');
      const num = Math.random() > 0.5 ? getRandomNumber(1, 999) : '';
      return `${interest}${num}`;
    }
    
    const firstName = generateFirstName(country, gender).toLowerCase();
    if (Math.random() > 0.5) {
      return `${getRandomItem(nicknamePrefixes)}${firstName}`;
    } else {
      return `${firstName}${getRandomItem(nicknameSuffixes)}`;
    }
  }
  
  // Older users tend to use simpler names
  const firstName = generateFirstName(country, gender).toLowerCase();
  return firstName;
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
function generateLocalPart(
  pattern: NamePattern,
  country: Country,
  gender: Gender,
  ageRange: AgeRange,
  interests: string[],
  includeNumbers: boolean,
  numberRange: [number, number],
  allowedCharacters: AllowedCharacters
): string {
  const firstName = generateFirstName(country, gender).toLowerCase();
  const lastName = generateLastName(country).toLowerCase();
  
  let localPart = '';

  switch (pattern) {
    case 'firstname.lastname':
      localPart = `${firstName}.${lastName}`;
      break;
    case 'firstnamelastname':
      localPart = `${firstName}${lastName}`;
      break;
    case 'firstinitiallastname':
      localPart = `${firstName[0]}${lastName}`;
      break;
    case 'firstname_lastname':
      localPart = `${firstName}_${lastName}`;
      break;
    case 'firstnamelastinitial':
      localPart = `${firstName}${lastName[0]}`;
      break;
    case 'nickname':
      localPart = generateNickname(interests, ageRange, country, gender);
      break;
    case 'petname':
      localPart = getRandomItem(patterns.petNames);
      break;
    case 'city':
      localPart = getRandomItem(patterns.cities);
      break;
    case 'hobby':
      localPart = getRandomItem(patterns.hobbies);
      break;
    case 'adjective_noun':
      localPart = `${getRandomItem(patterns.adjectives)}${getRandomItem(patterns.things)}`;
      break;
    case 'firstname_pet':
      localPart = `${firstName}${getRandomItem(patterns.petNames)}`;
      break;
    case 'firstname_city':
      localPart = `${firstName}${getRandomItem(patterns.cities)}`;
      break;
    case 'firstname_hobby':
      localPart = `${firstName}${getRandomItem(patterns.hobbies)}`;
      break;
    case 'color_thing':
      localPart = `${getRandomItem(patterns.colors)}${getRandomItem(patterns.things)}`;
      break;
    case 'thing_year':
      localPart = `${getRandomItem(patterns.things)}${getRandomItem(patterns.years)}`;
      break;
    default:
      localPart = `${firstName}.${lastName}`;
  }

  // Apply character restrictions
  localPart = applyCharacterRestrictions(localPart, allowedCharacters);

  // Add random numbers if enabled
  localPart = addRandomNumbers(localPart, includeNumbers, numberRange, ageRange, allowedCharacters);

  // Clean up any double dots or underscores
  localPart = localPart.replace(/\.{2,}/g, '.').replace(/_{2,}/g, '_');
  
  // Remove leading/trailing dots and underscores
  localPart = localPart.replace(/^[._]+|[._]+$/g, '');

  return localPart;
}

/**
 * Generate a single email address
 */
export function generateEmail(
  country: Country,
  gender: Gender,
  ageRange: AgeRange,
  interests: string[],
  pattern: NamePattern,
  includeNumbers: boolean,
  numberRange: [number, number],
  allowedCharacters: AllowedCharacters,
  domain: string
): string {
  const localPart = generateLocalPart(
    pattern,
    country,
    gender,
    ageRange,
    interests,
    includeNumbers,
    numberRange,
    allowedCharacters
  );

  return `${localPart}@${domain}`;
}

/**
 * Generate multiple email addresses
 */
export function generateEmails(
  count: number,
  providers: string[],
  country: Country,
  ageRange: AgeRange,
  gender: Gender,
  interests: string[],
  pattern: NamePattern,
  includeNumbers: boolean,
  numberRange: [number, number],
  allowedCharacters: AllowedCharacters
): string[] {
  const emails: string[] = [];
  const emailSet = new Set<string>();

  let attempts = 0;
  const maxAttempts = count * 10; // Prevent infinite loops

  while (emails.length < count && attempts < maxAttempts) {
    attempts++;
    
    // Randomly select a provider
    const domain = getRandomItem(providers);
    
    const email = generateEmail(
      country,
      gender,
      ageRange,
      interests,
      pattern,
      includeNumbers,
      numberRange,
      allowedCharacters,
      domain
    );

    // Ensure uniqueness
    if (!emailSet.has(email)) {
      emailSet.add(email);
      emails.push(email);
    }
  }

  return emails;
}

/**
 * Validate generation request
 */
export function validateRequest(data: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate count
  if (!data.count || typeof data.count !== 'number') {
    errors.push('count must be a number');
  } else if (data.count < 1) {
    errors.push('count must be at least 1');
  } else if (data.count > 500000) {
    errors.push('count cannot exceed 500,000');
  }

  // Validate providers
  if (!Array.isArray(data.providers) || data.providers.length === 0) {
    errors.push('providers must be a non-empty array');
  }

  // Validate country
  const validCountries = ['US', 'GH', 'UK', 'NG', 'IN', 'CA'];
  if (!data.country || !validCountries.includes(data.country)) {
    errors.push(`country must be one of: ${validCountries.join(', ')}`);
  }

  // Validate ageRange
  const validAgeRanges = ['18-25', '26-35', '36-45', '46-60', '60+'];
  if (!data.ageRange || !validAgeRanges.includes(data.ageRange)) {
    errors.push(`ageRange must be one of: ${validAgeRanges.join(', ')}`);
  }

  // Validate gender
  const validGenders = ['male', 'female', 'neutral', 'any'];
  if (!data.gender || !validGenders.includes(data.gender)) {
    errors.push(`gender must be one of: ${validGenders.join(', ')}`);
  }

  // Validate pattern
  const validPatterns = [
    'firstname.lastname',
    'firstnamelastname',
    'firstinitiallastname',
    'firstname_lastname',
    'firstnamelastinitial',
    'nickname',
    'petname',
    'city',
    'hobby',
    'adjective_noun',
    'firstname_pet',
    'firstname_city',
    'firstname_hobby',
    'color_thing',
    'thing_year'
  ];
  if (!data.pattern || !validPatterns.includes(data.pattern)) {
    errors.push(`pattern must be one of: ${validPatterns.join(', ')}`);
  }

  // Validate includeNumbers
  if (typeof data.includeNumbers !== 'boolean') {
    errors.push('includeNumbers must be a boolean');
  }

  // Validate numberRange
  if (!Array.isArray(data.numberRange) || data.numberRange.length !== 2) {
    errors.push('numberRange must be an array of two numbers');
  } else if (data.numberRange[0] > data.numberRange[1]) {
    errors.push('numberRange: first value must be less than or equal to second value');
  }

  // Validate allowedCharacters
  if (!data.allowedCharacters || typeof data.allowedCharacters !== 'object') {
    errors.push('allowedCharacters must be an object');
  } else {
    const requiredKeys = ['letters', 'numbers', 'underscore', 'dot'];
    for (const key of requiredKeys) {
      if (typeof data.allowedCharacters[key] !== 'boolean') {
        errors.push(`allowedCharacters.${key} must be a boolean`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
