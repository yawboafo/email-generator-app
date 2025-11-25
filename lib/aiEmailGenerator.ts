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
 * Name components for realistic generation
 */
const NAME_COMPONENTS = {
  firstNames: ['alex', 'sam', 'jordan', 'taylor', 'morgan', 'casey', 'riley', 'quinn', 'avery', 'blake', 
               'chris', 'drew', 'jamie', 'kai', 'logan', 'parker', 'rowan', 'sage', 'skylar', 'phoenix',
               'john', 'jane', 'mike', 'emily', 'david', 'sarah', 'james', 'lisa', 'robert', 'maria'],
  lastNames: ['smith', 'johnson', 'brown', 'davis', 'wilson', 'moore', 'taylor', 'anderson', 'thomas', 'jackson',
              'white', 'harris', 'martin', 'garcia', 'martinez', 'robinson', 'clark', 'lewis', 'lee', 'walker'],
  nicknames: ['ace', 'chief', 'boss', 'king', 'queen', 'hero', 'ninja', 'master', 'guru', 'wizard', 'legend'],
};

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
  themes: string[];
  style: 'professional' | 'casual' | 'creative' | 'random';
  includeNumbers: boolean;
  includeSeparators: boolean;
  ageHint: 'young' | 'middle' | 'mature' | 'any';
  complexity: 'simple' | 'medium' | 'complex';
} {
  const lowerPrompt = prompt.toLowerCase();
  
  // Detect themes
  const themes: string[] = [];
  if (lowerPrompt.match(/tech|developer|programmer|coder|engineer|software/)) themes.push('tech');
  if (lowerPrompt.match(/business|professional|corporate|executive|manager/)) themes.push('business');
  if (lowerPrompt.match(/creative|artist|designer|writer/)) themes.push('creative');
  if (lowerPrompt.match(/casual|fun|cool|young/)) themes.push('casual');
  if (lowerPrompt.match(/nature|outdoor|environment/)) themes.push('nature');
  if (lowerPrompt.match(/modern|trendy|new|contemporary/)) themes.push('modern');
  
  if (themes.length === 0) themes.push('casual'); // Default
  
  // Detect style
  let style: 'professional' | 'casual' | 'creative' | 'random' = 'casual';
  if (lowerPrompt.match(/professional|formal|business/)) style = 'professional';
  if (lowerPrompt.match(/creative|unique|artistic/)) style = 'creative';
  if (lowerPrompt.match(/random|mixed|varied|diverse/)) style = 'random';
  
  // Detect age hints
  let ageHint: 'young' | 'middle' | 'mature' | 'any' = 'any';
  if (lowerPrompt.match(/young|teen|student|gen\s*z/)) ageHint = 'young';
  if (lowerPrompt.match(/middle|adult|working/)) ageHint = 'middle';
  if (lowerPrompt.match(/mature|senior|older/)) ageHint = 'mature';
  
  // Detect preferences
  const includeNumbers = !lowerPrompt.match(/no\s+numbers|without\s+numbers/);
  const includeSeparators = !lowerPrompt.match(/no\s+dots|no\s+underscores|simple/);
  
  // Detect complexity
  let complexity: 'simple' | 'medium' | 'complex' = 'medium';
  if (lowerPrompt.match(/simple|basic|easy/)) complexity = 'simple';
  if (lowerPrompt.match(/complex|advanced|sophisticated|elaborate/)) complexity = 'complex';
  
  return { themes, style, includeNumbers, includeSeparators, ageHint, complexity };
}

/**
 * Generate a single email based on parsed context
 */
function generateContextualEmail(
  context: ReturnType<typeof parsePrompt>,
  provider: string
): AIGeneratedEmail {
  const { themes, style, includeNumbers, includeSeparators, ageHint, complexity } = context;
  
  let localPart = '';
  let persona = '';
  let reasoning = '';
  
  const theme = getRandom(themes);
  const themeWords = WORD_THEMES[theme as keyof typeof WORD_THEMES] || WORD_THEMES.casual;
  
  // Generate based on style and complexity
  if (style === 'professional') {
    const firstName = getRandom(NAME_COMPONENTS.firstNames);
    const lastName = getRandom(NAME_COMPONENTS.lastNames);
    
    if (complexity === 'simple') {
      localPart = `${firstName}.${lastName}`;
      persona = 'Professional user with standard naming';
    } else if (complexity === 'medium') {
      const initial = firstName.charAt(0);
      localPart = Math.random() > 0.5 
        ? `${firstName}.${lastName}` 
        : `${initial}.${lastName}`;
      if (includeNumbers) localPart += randomNum(1, 99);
      persona = 'Professional with possible numeric suffix';
    } else {
      localPart = `${firstName}.${lastName[0]}.${getRandom(themeWords)}`;
      if (includeNumbers) localPart += randomNum(100, 999);
      persona = 'Professional with role indicator';
    }
    reasoning = 'Generated professional-style email for business context';
    
  } else if (style === 'creative') {
    const base = getRandom(themeWords);
    const adjective = getRandom(WORD_THEMES.adjectives);
    
    if (complexity === 'simple') {
      localPart = `${base}${adjective}`;
      persona = 'Creative user with descriptive name';
    } else if (complexity === 'medium') {
      const separator = includeSeparators ? getRandom(CHAR_SETS.specialChars) : '';
      localPart = `${adjective}${separator}${base}`;
      if (includeNumbers) localPart += randomNum(1, 999);
      persona = 'Creative user with thematic elements';
    } else {
      const word1 = getRandom(themeWords);
      const word2 = getRandom(WORD_THEMES.action);
      const separator = includeSeparators ? getRandom(CHAR_SETS.specialChars) : '';
      localPart = leetSpeak(`${word1}${separator}${word2}`, 0.2);
      if (includeNumbers) localPart += randomNum(1000, 9999);
      persona = 'Highly creative user with leet speak elements';
    }
    reasoning = 'Generated creative email with thematic words';
    
  } else if (style === 'random') {
    const patternChoice = randomNum(1, 6);
    
    switch (patternChoice) {
      case 1: // Name-based
        localPart = `${getRandom(NAME_COMPONENTS.firstNames)}${getRandom(NAME_COMPONENTS.lastNames)}`;
        persona = 'Random user with name-based pattern';
        break;
      case 2: // Nickname-based
        localPart = `${getRandom(NAME_COMPONENTS.nicknames)}${getRandom(themeWords)}`;
        persona = 'Random user with nickname pattern';
        break;
      case 3: // Theme combo
        localPart = `${getRandom(themeWords)}${getRandom(WORD_THEMES.modern)}`;
        persona = 'Random user with theme combination';
        break;
      case 4: // Pronounceable
        localPart = generatePronounceable(randomNum(6, 10));
        persona = 'Random user with pronounceable pattern';
        break;
      case 5: // Hybrid
        const name = getRandom(NAME_COMPONENTS.firstNames);
        const word = getRandom(themeWords);
        localPart = `${name}${word}`;
        persona = 'Random user with hybrid pattern';
        break;
      default: // Numbers heavy
        localPart = `${getRandom(themeWords)}${randomNum(100, 9999)}`;
        persona = 'Random user with number-heavy pattern';
    }
    
    if (includeNumbers && Math.random() > 0.5) {
      localPart += randomNum(1, 999);
    }
    if (includeSeparators && Math.random() > 0.7) {
      const parts = localPart.split('');
      const pos = randomNum(3, parts.length - 2);
      parts.splice(pos, 0, getRandom(CHAR_SETS.specialChars));
      localPart = parts.join('');
    }
    reasoning = 'Generated random-style email with mixed patterns';
    
  } else { // casual
    const firstName = getRandom(NAME_COMPONENTS.firstNames);
    const word = getRandom(themeWords);
    
    if (ageHint === 'young') {
      localPart = leetSpeak(`${word}${firstName}`, 0.4);
      if (includeNumbers) localPart += randomNum(1, 99);
      persona = 'Young user with leet speak and casual elements';
    } else if (ageHint === 'mature') {
      localPart = `${firstName}${getRandom(NAME_COMPONENTS.lastNames)}`;
      if (includeNumbers) localPart += randomNum(1, 9);
      persona = 'Mature user with traditional naming';
    } else {
      const separator = includeSeparators && Math.random() > 0.5 ? getRandom(CHAR_SETS.specialChars) : '';
      localPart = `${firstName}${separator}${word}`;
      if (includeNumbers && Math.random() > 0.6) localPart += randomNum(1, 999);
      persona = 'Casual user with mixed elements';
    }
    reasoning = 'Generated casual email for everyday user';
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
  "Generate professional emails for business executives",
  "Create casual emails for young tech enthusiasts",
  "Make creative emails for designers and artists",
  "Generate random diverse emails for testing",
  "Create professional developer emails with tech terms",
  "Make casual gaming-related emails for young users",
  "Generate mature professional emails without special characters",
  "Create modern trendy emails for social media users",
  "Generate complex creative emails with numbers and separators",
  "Make simple clean emails for formal business use"
];
