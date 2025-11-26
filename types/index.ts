export type Gender = 'male' | 'female' | 'neutral' | 'any';

export type Country = 'US' | 'GH' | 'UK' | 'NG' | 'IN' | 'CA';

export type GenerationMethod = 'pattern' | 'deepseek' | 'openai';

export type NamePattern = 
  | 'firstname.lastname' 
  | 'firstnamelastname' 
  | 'firstinitiallastname'
  | 'firstname_lastname'
  | 'firstnamelastinitial'
  | 'nickname'
  | 'petname'
  | 'city'
  | 'hobby'
  | 'adjective_noun'
  | 'firstname_pet'
  | 'firstname_city'
  | 'firstname_hobby'
  | 'color_thing'
  | 'thing_year'
  | 'random';

export type AgeRange = '18-25' | '26-35' | '36-45' | '46-60' | '60+';

export interface AllowedCharacters {
  letters: boolean;
  numbers: boolean;
  underscore: boolean;
  dot: boolean;
}

export interface GenerateEmailsRequest {
  count: number;
  providers: string[];
  country: Country;
  ageRange: AgeRange;
  gender: Gender;
  interests?: string[];
  pattern: NamePattern;
  includeNumbers: boolean;
  numberRange: [number, number];
  allowedCharacters: AllowedCharacters;
  method?: GenerationMethod;
}

export interface GenerateEmailsResponse {
  emails: string[];
  meta: {
    count: number;
    providersUsed: string[];
  };
}

export interface SavedEmailBatch {
  id: string;
  name: string;
  emails: string[];
  count: number;
  createdAt: string;
  providers: string[];
  country: Country;
  pattern: NamePattern;
}

export interface Provider {
  id: string;
  name: string;
  domain: string;
  popularity: number;
}

export interface NameData {
  [country: string]: {
    firstNames: {
      male: string[];
      female: string[];
      neutral: string[];
    };
    lastNames: string[];
  };
}
