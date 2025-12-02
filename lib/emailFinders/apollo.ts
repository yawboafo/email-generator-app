import axios from 'axios';

/**
 * Apollo.io API Integration
 * Free tier: 50 credits/month
 * Paid: Starting at $49/month for 1,200 credits
 * Docs: https://apolloio.github.io/apollo-api-docs/
 */

interface ApolloPerson {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  linkedin_url: string;
  title: string;
  email: string;
  email_status: string; // "verified", "guessed", "unavailable"
  photo_url: string;
  twitter_url: string;
  github_url: string;
  facebook_url: string;
  city: string;
  state: string;
  country: string;
  organization_id: string;
  organization_name: string;
  organization: {
    id: string;
    name: string;
    website_url: string;
    blog_url: string;
    linkedin_url: string;
    twitter_url: string;
    facebook_url: string;
    primary_phone: {
      number: string;
    };
    phone: string;
    industry: string;
    keywords: string[];
    estimated_num_employees: number;
    retail_location_count: number;
    publicly_traded_symbol: string;
    publicly_traded_exchange: string;
    total_funding: number;
    latest_funding_round_date: string;
    seo_description: string;
    short_description: string;
    annual_revenue: number;
  };
}

interface ApolloSearchResponse {
  breadcrumbs: any[];
  partial_results_only: boolean;
  disable_eu_prospecting: boolean;
  partial_results_limit: number;
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
  people: ApolloPerson[];
}

/**
 * Search for people and their emails on Apollo
 */
export async function searchPeopleOnApollo(params: {
  companyName?: string;
  companyDomain?: string[];
  jobTitles?: string[];
  seniority?: string[]; // "owner", "founder", "c_suite", "vp", "director", "manager", "senior", "entry", "intern"
  departments?: string[]; // "engineering", "sales", "marketing", "finance", "hr", "operations", "legal", "support", "it"
  location?: string[];
  employeeCount?: string[]; // "1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001-10000", "10001+"
  revenue?: string[]; // "0-1M", "1M-10M", "10M-50M", "50M-100M", "100M-250M", "250M-500M", "500M-1B", "1B-10B", "10B+"
  industry?: string[];
  apiKey: string;
  page?: number;
  perPage?: number;
}): Promise<{ emails: string[]; totalResults: number; people: ApolloPerson[] }> {
  try {
    const requestBody: any = {
      page: params.page || 1,
      per_page: params.perPage || 100,
    };

    if (params.companyName) {
      requestBody.q_organization_name = params.companyName;
    }
    if (params.companyDomain && params.companyDomain.length > 0) {
      requestBody.organization_domains = params.companyDomain;
    }
    if (params.jobTitles && params.jobTitles.length > 0) {
      requestBody.person_titles = params.jobTitles;
    }
    if (params.seniority && params.seniority.length > 0) {
      requestBody.person_seniorities = params.seniority;
    }
    if (params.departments && params.departments.length > 0) {
      requestBody.person_departments = params.departments;
    }
    if (params.location && params.location.length > 0) {
      requestBody.person_locations = params.location;
    }
    if (params.employeeCount && params.employeeCount.length > 0) {
      requestBody.organization_num_employees_ranges = params.employeeCount;
    }
    if (params.revenue && params.revenue.length > 0) {
      requestBody.organization_revenue_ranges = params.revenue;
    }
    if (params.industry && params.industry.length > 0) {
      requestBody.organization_industry_tag_ids = params.industry;
    }

    const response = await axios.post<ApolloSearchResponse>(
      'https://api.apollo.io/v1/mixed_people/search',
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': params.apiKey,
        },
        timeout: 30000,
      }
    );

    const data = response.data;
    const emails = data.people
      .filter(p => p.email && p.email_status === 'verified')
      .map(p => p.email);

    return {
      emails,
      totalResults: data.pagination.total_entries,
      people: data.people,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;

      if (status === 401) throw new Error('Invalid Apollo.io API key');
      if (status === 429) throw new Error('Apollo.io API rate limit exceeded');
      if (status === 402) throw new Error('Apollo.io credits exhausted - please upgrade your plan');

      throw new Error(`Apollo.io API error: ${message}`);
    }
    throw error;
  }
}

/**
 * Enrich a person's information including email
 */
export async function enrichPersonApollo(params: {
  firstName: string;
  lastName: string;
  companyDomain?: string;
  linkedinUrl?: string;
  apiKey: string;
}): Promise<{ email: string; person: ApolloPerson }> {
  try {
    const requestBody: any = {
      first_name: params.firstName,
      last_name: params.lastName,
    };

    if (params.companyDomain) {
      requestBody.organization_domain = params.companyDomain;
    }
    if (params.linkedinUrl) {
      requestBody.linkedin_url = params.linkedinUrl;
    }

    const response = await axios.post(
      'https://api.apollo.io/v1/people/match',
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': params.apiKey,
        },
        timeout: 30000,
      }
    );

    const person: ApolloPerson = response.data.person;

    return {
      email: person.email,
      person,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message;
      throw new Error(`Apollo.io enrichment error: ${message}`);
    }
    throw error;
  }
}

/**
 * Search for organizations (companies) on Apollo
 */
export async function searchOrganizationsApollo(params: {
  name?: string;
  domain?: string;
  industry?: string[];
  location?: string[];
  employeeCount?: string[];
  revenue?: string[];
  apiKey: string;
}): Promise<any[]> {
  try {
    const requestBody: any = {
      page: 1,
      per_page: 100,
    };

    if (params.name) requestBody.q_organization_name = params.name;
    if (params.domain) requestBody.q_organization_domains = [params.domain];
    if (params.industry) requestBody.organization_industry_tag_ids = params.industry;
    if (params.location) requestBody.organization_locations = params.location;
    if (params.employeeCount) requestBody.organization_num_employees_ranges = params.employeeCount;
    if (params.revenue) requestBody.organization_revenue_ranges = params.revenue;

    const response = await axios.post(
      'https://api.apollo.io/v1/organizations/search',
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': params.apiKey,
        },
        timeout: 30000,
      }
    );

    return response.data.organizations || [];
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Apollo.io organization search error: ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }
}
