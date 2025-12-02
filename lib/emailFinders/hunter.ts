import axios from 'axios';

/**
 * Hunter.io API Integration
 * Free tier: 25 searches/month
 * Paid: Starting at $49/month for 500 searches
 * Docs: https://hunter.io/api-documentation
 */

interface HunterEmail {
  value: string;
  type: string;
  confidence: number;
  first_name?: string;
  last_name?: string;
  position?: string;
  seniority?: string;
  department?: string;
  linkedin?: string;
  twitter?: string;
  phone_number?: string;
}

interface HunterDomainSearchResponse {
  data: {
    domain: string;
    disposable: boolean;
    webmail: boolean;
    accept_all: boolean;
    pattern: string;
    organization: string;
    emails: HunterEmail[];
  };
  meta: {
    results: number;
    limit: number;
    offset: number;
    params: any;
  };
}

interface HunterEmailVerifierResponse {
  data: {
    status: string; // "valid", "invalid", "accept_all", "webmail", "disposable", "unknown"
    result: string; // "deliverable", "undeliverable", "risky", "unknown"
    score: number; // 0-100
    email: string;
    regexp: boolean;
    gibberish: boolean;
    disposable: boolean;
    webmail: boolean;
    mx_records: boolean;
    smtp_server: boolean;
    smtp_check: boolean;
    accept_all: boolean;
    block: boolean;
  };
}

/**
 * Find all emails associated with a domain
 */
export async function findEmailsWithHunter(
  domain: string,
  apiKey: string,
  options: {
    limit?: number;
    offset?: number;
    type?: 'personal' | 'generic';
    seniority?: 'junior' | 'senior' | 'executive';
    department?: string;
  } = {}
): Promise<{ emails: string[]; pattern: string; organization: string }> {
  try {
    const params = new URLSearchParams({
      domain,
      api_key: apiKey,
      limit: String(options.limit || 100),
      offset: String(options.offset || 0),
    });

    if (options.type) params.append('type', options.type);
    if (options.seniority) params.append('seniority', options.seniority);
    if (options.department) params.append('department', options.department);

    const response = await axios.get<HunterDomainSearchResponse>(
      `https://api.hunter.io/v2/domain-search?${params.toString()}`,
      { timeout: 30000 }
    );

    const data = response.data.data;
    const emails = data.emails
      .filter(e => e.confidence >= 50) // Filter low confidence emails
      .map(e => e.value);

    return {
      emails,
      pattern: data.pattern,
      organization: data.organization,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.errors?.[0]?.details || error.message;
      
      if (status === 401) throw new Error('Invalid Hunter.io API key');
      if (status === 429) throw new Error('Hunter.io API rate limit exceeded');
      if (status === 422) throw new Error(`Invalid request: ${message}`);
      
      throw new Error(`Hunter.io API error: ${message}`);
    }
    throw error;
  }
}

/**
 * Verify if a single email address is valid and deliverable
 */
export async function verifyEmailWithHunter(
  email: string,
  apiKey: string
): Promise<{
  email: string;
  status: string;
  result: string;
  score: number;
  deliverable: boolean;
}> {
  try {
    const response = await axios.get<HunterEmailVerifierResponse>(
      `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${apiKey}`,
      { timeout: 30000 }
    );

    const data = response.data.data;

    return {
      email: data.email,
      status: data.status,
      result: data.result,
      score: data.score,
      deliverable: data.result === 'deliverable' && data.score >= 70,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.errors?.[0]?.details || error.message;
      
      if (status === 401) throw new Error('Invalid Hunter.io API key');
      if (status === 429) throw new Error('Hunter.io API rate limit exceeded');
      
      throw new Error(`Hunter.io verification error: ${message}`);
    }
    throw error;
  }
}

/**
 * Find email pattern for a domain (cheaper than full search)
 */
export async function findEmailPattern(
  domain: string,
  apiKey: string
): Promise<{ pattern: string; organization: string }> {
  try {
    const response = await axios.get(
      `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${apiKey}&limit=1`,
      { timeout: 30000 }
    );

    const data = response.data.data;

    return {
      pattern: data.pattern,
      organization: data.organization,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Hunter.io API error: ${error.response?.data?.errors?.[0]?.details || error.message}`);
    }
    throw error;
  }
}

/**
 * Find email for a specific person at a company
 */
export async function findPersonEmail(
  domain: string,
  firstName: string,
  lastName: string,
  apiKey: string
): Promise<{ email: string; score: number }> {
  try {
    const response = await axios.get(
      `https://api.hunter.io/v2/email-finder?domain=${domain}&first_name=${firstName}&last_name=${lastName}&api_key=${apiKey}`,
      { timeout: 30000 }
    );

    const data = response.data.data;

    return {
      email: data.email,
      score: data.score,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Hunter.io email finder error: ${error.response?.data?.errors?.[0]?.details || error.message}`);
    }
    throw error;
  }
}
