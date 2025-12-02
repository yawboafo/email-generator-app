import axios from 'axios';

/**
 * RocketReach API Integration
 * Free tier: 10 lookups/month
 * Paid: Starting at $39/month for 170 lookups
 * Docs: https://rocketreach.co/api
 */

interface RocketReachProfile {
  id: number;
  name: string;
  current_employer: string;
  current_title: string;
  linkedin_url: string;
  location: string;
  city: string;
  region: string;
  country: string;
  phones: Array<{
    number: string;
    type: string;
  }>;
  emails: Array<{
    email: string;
    type: string;
    status: string; // "current", "historic"
  }>;
  links: {
    linkedin: string;
    twitter: string;
    facebook: string;
  };
}

interface RocketReachSearchResponse {
  profiles: RocketReachProfile[];
  pagination: {
    total: number;
    start: number;
    page_size: number;
  };
}

/**
 * Search for people and emails on RocketReach
 */
export async function lookupEmailsRocketReach(params: {
  name?: string;
  company?: string;
  title?: string;
  location?: string;
  school?: string;
  apiKey: string;
  pageSize?: number;
  start?: number;
}): Promise<{ emails: string[]; profiles: RocketReachProfile[] }> {
  try {
    const query: any = {};
    
    if (params.name) query.name = params.name;
    if (params.company) query.current_employer = params.company;
    if (params.title) query.current_title = params.title;
    if (params.location) query.location = params.location;
    if (params.school) query.school = params.school;

    const requestBody = {
      query,
      start: params.start || 0,
      page_size: params.pageSize || 100,
    };

    const response = await axios.post<RocketReachSearchResponse>(
      'https://api.rocketreach.co/v2/api/search',
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': params.apiKey,
        },
        timeout: 30000,
      }
    );

    const profiles = response.data.profiles;
    const emails = profiles
      .filter(p => p.emails && p.emails.length > 0)
      .flatMap(p => 
        p.emails
          .filter(e => e.status === 'current')
          .map(e => e.email)
      );

    return {
      emails,
      profiles,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;

      if (status === 401) throw new Error('Invalid RocketReach API key');
      if (status === 429) throw new Error('RocketReach API rate limit exceeded');
      if (status === 402) throw new Error('RocketReach credits exhausted');

      throw new Error(`RocketReach API error: ${message}`);
    }
    throw error;
  }
}

/**
 * Lookup a single person by name and company
 */
export async function lookupPersonRocketReach(params: {
  name: string;
  company?: string;
  apiKey: string;
}): Promise<{ email: string; profile: RocketReachProfile } | null> {
  try {
    const response = await axios.post(
      'https://api.rocketreach.co/v2/api/lookupProfile',
      {
        name: params.name,
        current_employer: params.company,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': params.apiKey,
        },
        timeout: 30000,
      }
    );

    const profile: RocketReachProfile = response.data;
    
    if (!profile.emails || profile.emails.length === 0) {
      return null;
    }

    const currentEmail = profile.emails.find(e => e.status === 'current');
    
    return {
      email: currentEmail?.email || profile.emails[0].email,
      profile,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      
      if (status === 404) return null;
      
      throw new Error(`RocketReach lookup error: ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }
}

/**
 * Bulk email lookup
 */
export async function bulkLookupRocketReach(params: {
  profiles: Array<{
    name?: string;
    first_name?: string;
    last_name?: string;
    linkedin_url?: string;
    current_employer?: string;
  }>;
  apiKey: string;
}): Promise<RocketReachProfile[]> {
  try {
    const response = await axios.post(
      'https://api.rocketreach.co/v2/api/lookupProfile',
      {
        profile_ids: params.profiles,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': params.apiKey,
        },
        timeout: 30000,
      }
    );

    return response.data.profiles || [];
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`RocketReach bulk lookup error: ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }
}
