/**
 * AI Email Generator - Advanced email generation using AI-like patterns
 * Generates ultra-realistic emails based on natural language prompts
 */

interface AIEmailPrompt {
  prompt: string;
  count: number;
  providers?: string[];
}

interface AIGeneratedEmail {
  email: string;
  context: {
    persona: string;
    reasoning: string;
  };
}

interface AIEmailResponse {
  emails: string[];
  metadata: {
    count: number;
    prompt: string;
    patterns: string[];
    contexts: Array<{ email: string; persona: string; reasoning: string }>;
  };
}

/**
 * Advanced character sets for ultra-realistic email generation
 */
const CHAR_SETS = {
  vowels: ['a', 'e', 'i', 'o', 'u'],
  consonants: ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'y', 'z'],
  numbers: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
  specialChars: ['.', '_'],
  leetSpeak: { 'a': '4', 'e': '3', 'i': '1', 'o': '0', 's': '5', 't': '7' },
};

/**
 * Common word patterns and themes
 */
const WORD_THEMES = {
  tech: ['cyber', 'digital', 'tech', 'code', 'dev', 'sys', 'data', 'cloud', 'net', 'web', 'app', 'ai', 'bot'],
  business: ['pro', 'biz', 'corp', 'exec', 'admin', 'mgr', 'chief', 'lead', 'work', 'office', 'team'],
  creative: ['art', 'design', 'create', 'make', 'build', 'craft', 'pixel', 'studio', 'media', 'vision'],
  casual: ['cool', 'super', 'mega', 'ultra', 'real', 'true', 'best', 'top', 'star', 'ace'],
  nature: ['sun', 'moon', 'star', 'ocean', 'sky', 'fire', 'earth', 'wind', 'rain', 'storm'],
  modern: ['neo', 'next', 'new', 'fresh', 'edge', 'prime', 'core', 'max', 'plus', 'pro'],
  action: ['run', 'jump', 'fly', 'dash', 'swift', 'fast', 'quick', 'rush', 'zoom', 'blaze'],
  adjectives: ['smart', 'bright', 'bold', 'wild', 'free', 'pure', 'true', 'rare', 'fine', 'epic'],
};

/**
 * Profession-specific patterns and indicators
 */
const PROFESSION_PATTERNS = {
  banker: {
    keywords: ['bank', 'banker', 'banking', 'finance', 'financial'],
    patterns: ['firstname.lastname', 'firstinitiallastname', 'firstname_lastname'],
    style: 'professional',
    separators: ['.', '_'],
    numberStyle: 'minimal', // rarely use numbers
    domains: ['gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com']
  },
  doctor: {
    keywords: ['doctor', 'physician', 'surgeon', 'medical', 'dr', 'md'],
    patterns: ['dr.lastname', 'firstname.lastname', 'firstinitiallastname'],
    style: 'professional',
    separators: ['.'],
    numberStyle: 'minimal',
    domains: ['gmail.com', 'outlook.com', 'icloud.com']
  },
  lawyer: {
    keywords: ['lawyer', 'attorney', 'legal', 'law', 'advocate', 'counsel'],
    patterns: ['firstname.lastname', 'firstinitiallastname', 'firstname_lastname'],
    style: 'professional',
    separators: ['.', '_'],
    numberStyle: 'minimal',
    domains: ['gmail.com', 'outlook.com', 'protonmail.com']
  },
  engineer: {
    keywords: ['engineer', 'engineering', 'mechanical', 'civil', 'electrical'],
    patterns: ['firstname.lastname', 'firstnamelastname', 'firstname_lastname'],
    style: 'professional',
    separators: ['.', '_'],
    numberStyle: 'moderate',
    domains: ['gmail.com', 'yahoo.com', 'outlook.com']
  },
  teacher: {
    keywords: ['teacher', 'educator', 'professor', 'instructor', 'lecturer'],
    patterns: ['firstname.lastname', 'firstinitiallastname'],
    style: 'professional',
    separators: ['.'],
    numberStyle: 'minimal',
    domains: ['gmail.com', 'yahoo.com', 'outlook.com']
  },
  developer: {
    keywords: ['developer', 'programmer', 'coder', 'software', 'dev', 'coding'],
    patterns: ['firstname.lastname', 'firstnamelastname', 'firstname_lastname', 'nickname'],
    style: 'tech',
    separators: ['.', '_'],
    numberStyle: 'moderate',
    domains: ['gmail.com', 'outlook.com', 'protonmail.com']
  },
  entrepreneur: {
    keywords: ['entrepreneur', 'founder', 'ceo', 'startup', 'business owner'],
    patterns: ['firstname.lastname', 'firstnamelastname', 'firstname_lastname'],
    style: 'business',
    separators: ['.', '_'],
    numberStyle: 'light',
    domains: ['gmail.com', 'outlook.com', 'icloud.com', 'protonmail.com']
  },
  student: {
    keywords: ['student', 'undergraduate', 'graduate', 'pupil', 'learner'],
    patterns: ['firstnamelastname', 'nickname', 'firstname_lastname'],
    style: 'casual',
    separators: ['.', '_'],
    numberStyle: 'heavy',
    domains: ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com']
  },
  artist: {
    keywords: ['artist', 'designer', 'creative', 'painter', 'illustrator'],
    patterns: ['nickname', 'firstname.lastname', 'firstname_word'],
    style: 'creative',
    separators: ['.', '_'],
    numberStyle: 'light',
    domains: ['gmail.com', 'icloud.com', 'protonmail.com']
  },
  accountant: {
    keywords: ['accountant', 'accounting', 'cpa', 'bookkeeper', 'auditor'],
    patterns: ['firstname.lastname', 'firstinitiallastname'],
    style: 'professional',
    separators: ['.'],
    numberStyle: 'minimal',
    domains: ['gmail.com', 'outlook.com', 'yahoo.com']
  },
};

/**
 * Country/nationality detection and name data mapping
 * Supports 50+ countries globally
 */
const NATIONALITY_MAP: Record<string, string> = {
  // Africa
  'ghanaian': 'GH', 'ghana': 'GH', 'ghanaians': 'GH',
  'nigerian': 'NG', 'nigeria': 'NG', 'nigerians': 'NG',
  'south african': 'ZA', 'south africa': 'ZA', 'south africans': 'ZA',
  'kenyan': 'KE', 'kenya': 'KE', 'kenyans': 'KE',
  'egyptian': 'EG', 'egypt': 'EG', 'egyptians': 'EG',
  'moroccan': 'MA', 'morocco': 'MA', 'moroccans': 'MA',
  
  // Americas
  'american': 'US', 'usa': 'US', 'americans': 'US', 'united states': 'US',
  'canadian': 'CA', 'canada': 'CA', 'canadians': 'CA',
  'mexican': 'MX', 'mexico': 'MX', 'mexicans': 'MX',
  'brazilian': 'BR', 'brazil': 'BR', 'brazilians': 'BR',
  'argentinian': 'AR', 'argentina': 'AR', 'argentinians': 'AR', 'argentine': 'AR',
  'chilean': 'CL', 'chile': 'CL', 'chileans': 'CL',
  'colombian': 'CO', 'colombia': 'CO', 'colombians': 'CO',
  'peruvian': 'PE', 'peru': 'PE', 'peruvians': 'PE',
  'venezuelan': 'VE', 'venezuela': 'VE', 'venezuelans': 'VE',
  
  // Europe - Western
  'british': 'UK', 'uk': 'UK', 'england': 'UK', 'english': 'UK',
  'french': 'FR', 'france': 'FR',
  'german': 'DE', 'germany': 'DE', 'germans': 'DE',
  'italian': 'IT', 'italy': 'IT', 'italians': 'IT',
  'spanish': 'ES', 'spain': 'ES', 'spaniards': 'ES',
  'dutch': 'NL', 'netherlands': 'NL', 'holland': 'NL',
  'belgian': 'BE', 'belgium': 'BE', 'belgians': 'BE',
  'swiss': 'CH', 'switzerland': 'CH',
  'austrian': 'AT', 'austria': 'AT', 'austrians': 'AT',
  'portuguese': 'PT', 'portugal': 'PT',
  'irish': 'IE', 'ireland': 'IE',
  
  // Europe - Northern
  'swedish': 'SE', 'sweden': 'SE', 'swedes': 'SE',
  'norwegian': 'NO', 'norway': 'NO', 'norwegians': 'NO',
  'danish': 'DK', 'denmark': 'DK', 'danes': 'DK',
  'finnish': 'FI', 'finland': 'FI', 'finns': 'FI',
  
  // Europe - Eastern
  'polish': 'PL', 'poland': 'PL', 'poles': 'PL',
  'czech': 'CZ', 'czechia': 'CZ', 'czech republic': 'CZ',
  'russian': 'RU', 'russia': 'RU', 'russians': 'RU',
  'ukrainian': 'UA', 'ukraine': 'UA', 'ukrainians': 'UA',
  'greek': 'GR', 'greece': 'GR', 'greeks': 'GR',
  'turkish': 'TR', 'turkey': 'TR', 'turks': 'TR',
  
  // Asia - East
  'japanese': 'JP', 'japan': 'JP',
  'korean': 'KR', 'south korea': 'KR', 'south korean': 'KR',
  'chinese': 'CN', 'china': 'CN',
  
  // Asia - Southeast
  'thai': 'TH', 'thailand': 'TH',
  'vietnamese': 'VN', 'vietnam': 'VN',
  'filipino': 'PH', 'philippines': 'PH', 'filipinos': 'PH',
  'indonesian': 'ID', 'indonesia': 'ID', 'indonesians': 'ID',
  'malaysian': 'MY', 'malaysia': 'MY', 'malaysians': 'MY',
  'singaporean': 'SG', 'singapore': 'SG', 'singaporeans': 'SG',
  
  // Asia - South
  'indian': 'IN', 'india': 'IN', 'indians': 'IN',
  
  // Middle East
  'israeli': 'IL', 'israel': 'IL', 'israelis': 'IL',
  'emirati': 'AE', 'uae': 'AE', 'dubai': 'AE', 'emiratis': 'AE',
  'saudi': 'SA', 'saudi arabia': 'SA', 'saudi arabian': 'SA', 'saudis': 'SA',
  
  // Oceania
  'australian': 'AU', 'australia': 'AU', 'australians': 'AU', 'aussie': 'AU', 'aussies': 'AU',
  'new zealand': 'NZ', 'new zealander': 'NZ', 'kiwi': 'NZ', 'kiwis': 'NZ',
};

// Lazy load name data to reduce initial bundle size
let nameDataCache: any = null;

async function loadNameData() {
  if (nameDataCache) return nameDataCache;
  
  // Load all name datasets dynamically
  const [base, additional, world] = await Promise.all([
    import('@/data/names.json'),
    import('@/data/additional-names.json'),
    import('@/data/world-names.json')
  ]);
  
  nameDataCache = {
    ...base.default,
    ...additional.default,
    ...world.default
  };
  
  return nameDataCache;
}

// For SSR compatibility, try to load synchronously first
let allNamesData: any = {};
try {
  const namesData = require('@/data/names.json');
  const additionalNamesData = require('@/data/additional-names.json');
  const worldNamesData = require('@/data/world-names.json');
  allNamesData = { ...namesData, ...additionalNamesData, ...worldNamesData };
} catch (e) {
  // Will be loaded dynamically in client
}

/**
 * Get names from specific country
 */
function getNamesForCountry(countryCode: string): { firstNames: string[]; lastNames: string[] } {
  const countryData = (allNamesData as any)[countryCode];
  if (!countryData) {
    // Fallback to US names
    const usData = (allNamesData as any)['US'];
    return {
      firstNames: [...usData.firstNames.male, ...usData.firstNames.female, ...usData.firstNames.neutral],
      lastNames: usData.lastNames
    };
  }
  
  return {
    firstNames: [...countryData.firstNames.male, ...countryData.firstNames.female, ...countryData.firstNames.neutral],
    lastNames: countryData.lastNames
  };
}

/**
 * Default providers if none specified
 */
const DEFAULT_PROVIDERS = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
  'protonmail.com', 'aol.com', 'mail.com', 'zoho.com', 'gmx.com'
];

/**
 * Get random item from array
 */
function getRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate random number in range
 */
function randomNum(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Apply leet speak transformation
 */
function leetSpeak(text: string, intensity: number = 0.3): string {
  return text.split('').map(char => {
    if (Math.random() < intensity && CHAR_SETS.leetSpeak[char.toLowerCase() as keyof typeof CHAR_SETS.leetSpeak]) {
      return CHAR_SETS.leetSpeak[char.toLowerCase() as keyof typeof CHAR_SETS.leetSpeak];
    }
    return char;
  }).join('');
}

/**
 * Generate a pronounceable random string
 */
function generatePronounceable(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    if (i % 2 === 0) {
      result += getRandom(CHAR_SETS.consonants);
    } else {
      result += getRandom(CHAR_SETS.vowels);
    }
  }
  return result;
}

/**
 * Parse AI prompt to extract context and generate appropriate emails
 */
function parsePrompt(prompt: string): {
  profession: string | null;
  professionData: typeof PROFESSION_PATTERNS[keyof typeof PROFESSION_PATTERNS] | null;
  nationality: string | null;
  countryCode: string;
  themes: string[];
  style: 'professional' | 'casual' | 'creative' | 'random' | 'tech' | 'business';
  includeNumbers: boolean;
  includeSeparators: boolean;
  ageHint: 'young' | 'middle' | 'mature' | 'any';
  complexity: 'simple' | 'medium' | 'complex';
  numberStyle: 'minimal' | 'light' | 'moderate' | 'heavy';
} {
  const lowerPrompt = prompt.toLowerCase();
  
  // Detect profession
  let profession: string | null = null;
  let professionData: typeof PROFESSION_PATTERNS[keyof typeof PROFESSION_PATTERNS] | null = null;
  
  for (const [profName, profData] of Object.entries(PROFESSION_PATTERNS)) {
    if (profData.keywords.some(keyword => lowerPrompt.includes(keyword))) {
      profession = profName;
      professionData = profData;
      break;
    }
  }
  
  // Detect nationality
  let nationality: string | null = null;
  let countryCode = 'US'; // Default
  
  for (const [natName, natCode] of Object.entries(NATIONALITY_MAP)) {
    if (lowerPrompt.includes(natName)) {
      nationality = natName;
      countryCode = natCode;
      break;
    }
  }
  
  // Use profession data if available
  if (professionData) {
    return {
      profession,
      professionData,
      nationality,
      countryCode,
      themes: professionData.style === 'professional' ? ['business'] : 
              professionData.style === 'tech' ? ['tech'] :
              professionData.style === 'creative' ? ['creative'] : ['casual'],
      style: professionData.style as any,
      includeNumbers: professionData.numberStyle !== 'minimal',
      includeSeparators: professionData.separators.length > 0,
      ageHint: profession === 'student' ? 'young' : 'middle',
      complexity: 'medium',
      numberStyle: professionData.numberStyle as any
    };
  }
  
  // Fallback to theme-based detection
  const themes: string[] = [];
  if (lowerPrompt.match(/tech|developer|programmer|coder|engineer|software/)) themes.push('tech');
  if (lowerPrompt.match(/business|professional|corporate|executive|manager/)) themes.push('business');
  if (lowerPrompt.match(/creative|artist|designer|writer/)) themes.push('creative');
  if (lowerPrompt.match(/casual|fun|cool|young/)) themes.push('casual');
  if (lowerPrompt.match(/nature|outdoor|environment/)) themes.push('nature');
  if (lowerPrompt.match(/modern|trendy|new|contemporary/)) themes.push('modern');
  
  if (themes.length === 0) themes.push('casual');
  
  let style: 'professional' | 'casual' | 'creative' | 'random' | 'tech' | 'business' = 'casual';
  if (lowerPrompt.match(/professional|formal|business/)) style = 'professional';
  if (lowerPrompt.match(/creative|unique|artistic/)) style = 'creative';
  if (lowerPrompt.match(/random|mixed|varied|diverse/)) style = 'random';
  
  let ageHint: 'young' | 'middle' | 'mature' | 'any' = 'any';
  if (lowerPrompt.match(/young|teen|student|gen\s*z/)) ageHint = 'young';
  if (lowerPrompt.match(/middle|adult|working/)) ageHint = 'middle';
  if (lowerPrompt.match(/mature|senior|older/)) ageHint = 'mature';
  
  const includeNumbers = !lowerPrompt.match(/no\s+numbers|without\s+numbers/);
  const includeSeparators = !lowerPrompt.match(/no\s+dots|no\s+underscores|simple/);
  
  let complexity: 'simple' | 'medium' | 'complex' = 'medium';
  if (lowerPrompt.match(/simple|basic|easy/)) complexity = 'simple';
  if (lowerPrompt.match(/complex|advanced|sophisticated|elaborate/)) complexity = 'complex';
  
  return { 
    profession, 
    professionData, 
    nationality, 
    countryCode, 
    themes, 
    style, 
    includeNumbers, 
    includeSeparators, 
    ageHint, 
    complexity,
    numberStyle: includeNumbers ? 'moderate' : 'minimal'
  };
}

/**
 * Generate a single email based on parsed context
 */
function generateContextualEmail(
  context: ReturnType<typeof parsePrompt>,
  provider: string
): AIGeneratedEmail {
  const { 
    profession, 
    professionData, 
    nationality, 
    countryCode, 
    themes, 
    style, 
    includeNumbers, 
    includeSeparators, 
    ageHint, 
    complexity,
    numberStyle 
  } = context;
  
  // Get names from the appropriate country
  const { firstNames, lastNames } = getNamesForCountry(countryCode);
  
  let localPart = '';
  let persona = '';
  let reasoning = '';
  
  const firstName = getRandom(firstNames).toLowerCase();
  const lastName = getRandom(lastNames).toLowerCase();
  const firstInitial = firstName.charAt(0);
  
  // If profession is detected, use profession-specific patterns
  if (profession && professionData) {
    const pattern = getRandom(professionData.patterns);
    const separator = professionData.separators.length > 0 ? getRandom(professionData.separators) : '';
    
    switch (pattern) {
      case 'firstname.lastname':
        localPart = `${firstName}.${lastName}`;
        break;
      case 'firstnamelastname':
        localPart = `${firstName}${lastName}`;
        break;
      case 'firstinitiallastname':
        localPart = `${firstInitial}${lastName}`;
        break;
      case 'firstname_lastname':
        localPart = `${firstName}_${lastName}`;
        break;
      case 'firstnamelastinitial':
        localPart = `${firstName}${lastName.charAt(0)}`;
        break;
      case 'dr.lastname':
        localPart = `dr.${lastName}`;
        break;
      default:
        localPart = `${firstName}.${lastName}`;
    }
    
    // Add numbers based on profession number style
    if (numberStyle === 'heavy') {
      localPart += randomNum(1, 999);
    } else if (numberStyle === 'moderate' && Math.random() > 0.5) {
      localPart += randomNum(1, 99);
    } else if (numberStyle === 'light' && Math.random() > 0.7) {
      localPart += randomNum(1, 9);
    } else if (numberStyle === 'minimal' && Math.random() > 0.9) {
      localPart += randomNum(1, 9);
    }
    
    persona = `${nationality || countryCode} ${profession} - ${pattern} pattern`;
    reasoning = `Generated professional ${profession} email for ${nationality || countryCode} using realistic naming conventions`;
    
  } else {
    // Fallback to style-based generation with real names
    const theme = getRandom(themes);
    const themeWords = WORD_THEMES[theme as keyof typeof WORD_THEMES] || WORD_THEMES.casual;
    
    if (style === 'professional' || style === 'business') {
      if (complexity === 'simple') {
        localPart = `${firstName}.${lastName}`;
        persona = `Professional ${nationality || countryCode} user`;
      } else {
        const useInitial = Math.random() > 0.5;
        localPart = useInitial ? `${firstInitial}.${lastName}` : `${firstName}.${lastName}`;
        if (includeNumbers && Math.random() > 0.7) localPart += randomNum(1, 99);
        persona = `Professional ${nationality || countryCode} user with possible numbers`;
      }
      reasoning = `Generated professional email using ${nationality || countryCode} names`;
      
    } else if (style === 'tech') {
      localPart = `${firstName}.${lastName}`;
      if (includeNumbers) localPart += randomNum(1, 99);
      persona = `Tech professional from ${nationality || countryCode}`;
      reasoning = `Generated tech-style email using ${nationality || countryCode} names`;
      
    } else if (style === 'creative') {
      const base = getRandom(themeWords);
      localPart = `${firstName}${base}`;
      if (includeNumbers && Math.random() > 0.6) localPart += randomNum(1, 999);
      persona = `Creative ${nationality || countryCode} user`;
      reasoning = `Generated creative email with ${nationality || countryCode} names`;
      
    } else if (style === 'random') {
      const patternChoice = randomNum(1, 4);
      switch (patternChoice) {
        case 1:
          localPart = `${firstName}${lastName}`;
          break;
        case 2:
          localPart = `${firstName}.${lastName}`;
          break;
        case 3:
          localPart = `${firstName}_${lastName}`;
          break;
        default:
          localPart = `${firstInitial}${lastName}`;
      }
      if (includeNumbers && Math.random() > 0.5) localPart += randomNum(1, 999);
      persona = `Random ${nationality || countryCode} user`;
      reasoning = `Generated random-style email using ${nationality || countryCode} names`;
      
    } else { // casual
      if (ageHint === 'young') {
        localPart = `${firstName}${lastName}${randomNum(1, 99)}`;
        persona = `Young ${nationality || countryCode} user`;
      } else {
        localPart = `${firstName}.${lastName}`;
        if (includeNumbers && Math.random() > 0.6) localPart += randomNum(1, 9);
        persona = `Casual ${nationality || countryCode} user`;
      }
      reasoning = `Generated casual email using ${nationality || countryCode} names`;
    }
  }
  
  // Ensure valid email format (no consecutive dots, no starting/ending with dot or underscore)
  localPart = localPart
    .replace(/\.{2,}/g, '.')
    .replace(/^[._]|[._]$/g, '')
    .toLowerCase();
  
  const email = `${localPart}@${provider}`;
  
  return {
    email,
    context: { persona, reasoning }
  };
}

/**
 * Main AI Email Generator Function
 * Generates ultra-realistic emails based on natural language prompts
 */
export async function aiEmailGenerator({
  prompt,
  count,
  providers = DEFAULT_PROVIDERS
}: AIEmailPrompt): Promise<AIEmailResponse> {
  
  if (count < 1 || count > 500000) {
    throw new Error('Count must be between 1 and 500,000');
  }
  
  if (providers.length === 0) {
    providers = DEFAULT_PROVIDERS;
  }
  
  // Load name data if not already loaded (for client-side)
  if (Object.keys(allNamesData).length === 0) {
    allNamesData = await loadNameData();
  }
  
  // Parse the prompt to understand context
  const context = parsePrompt(prompt);
  
  // Generate emails
  const generatedEmails: AIGeneratedEmail[] = [];
  const usedEmails = new Set<string>();
  
  let attempts = 0;
  const maxAttempts = count * 3; // Prevent infinite loops
  
  while (generatedEmails.length < count && attempts < maxAttempts) {
    attempts++;
    
    const provider = getRandom(providers);
    const generated = generateContextualEmail(context, provider);
    
    // Ensure uniqueness
    if (!usedEmails.has(generated.email)) {
      usedEmails.add(generated.email);
      generatedEmails.push(generated);
    }
  }
  
  if (generatedEmails.length < count) {
    console.warn(`Only generated ${generatedEmails.length} unique emails out of ${count} requested`);
  }
  
  return {
    emails: generatedEmails.map(e => e.email),
    metadata: {
      count: generatedEmails.length,
      prompt,
      patterns: context.themes,
      contexts: generatedEmails.map(e => ({
        email: e.email,
        persona: e.context.persona,
        reasoning: e.context.reasoning
      }))
    }
  };
}

/**
 * Example usage and preset prompts
 */
export const EXAMPLE_PROMPTS = [
  "Give me emails of bankers who are Ghanaians",
  "Generate emails for Nigerian doctors",
  "Create emails for Indian software developers",
  "Make emails for British lawyers",
  "Generate emails for American teachers",
  "Create emails for Canadian entrepreneurs",
  "Make emails for French engineers",
  "Generate emails for Japanese developers",
  "Create emails for Australian bankers",
  "Make emails for Brazilian artists",
  "Generate emails for German accountants",
  "Create emails for Mexican students",
  "Make emails for South African lawyers",
  "Generate emails for Italian designers",
  "Create emails for Spanish entrepreneurs",
  "Make emails for Dutch developers",
  "Generate emails for Swedish doctors",
  "Create emails for Russian engineers",
  "Create emails for Korean students",
  "Generate emails for Thai lawyers"
];

/**
 * Get list of all supported countries
 */
export function getSupportedCountries(): Array<{ code: string; name: string }> {
  const countries = new Map<string, string>();
  
  // Extract unique countries from NATIONALITY_MAP
  Object.values(NATIONALITY_MAP).forEach(code => {
    if (!countries.has(code)) {
      // Get country name from first matching key
      const name = Object.entries(NATIONALITY_MAP)
        .find(([_, c]) => c === code)?.[0] || code;
      countries.set(code, name.charAt(0).toUpperCase() + name.slice(1));
    }
  });
  
  return Array.from(countries.entries())
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get total count of supported countries
 */
export function getSupportedCountriesCount(): number {
  return new Set(Object.values(NATIONALITY_MAP)).size;
}
