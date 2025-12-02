import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { findEmailsWithHunter, verifyEmailWithHunter, findPersonEmail } from '@/lib/emailFinders/hunter';
import { searchPeopleOnApollo, enrichPersonApollo } from '@/lib/emailFinders/apollo';
import { lookupEmailsRocketReach, lookupPersonRocketReach } from '@/lib/emailFinders/rocketreach';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(clientId, 50, 60 * 60 * 1000); // 50 requests per hour

    if (!rateLimit.allowed) {
      const resetDate = new Date(rateLimit.resetTime);
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Too many email finder requests. Please try again later.',
          resetTime: resetDate.toISOString(),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '50',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetDate.toISOString(),
            'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    const body = await request.json();
    const {
      service, // 'hunter' | 'apollo' | 'rocketreach'
      action, // 'domain-search' | 'people-search' | 'person-lookup' | 'verify'
      apiKey,
      // Common parameters
      domain,
      companyName,
      // Person parameters
      firstName,
      lastName,
      name,
      jobTitles,
      seniority,
      departments,
      location,
      // Hunter specific
      email,
      // Apollo specific
      companyDomain,
      employeeCount,
      revenue,
      industry,
      linkedinUrl,
      // Additional options
      limit,
      offset,
      page,
      perPage,
    } = body;

    if (!service || !apiKey) {
      return NextResponse.json(
        { error: 'Missing required parameters: service and apiKey' },
        { status: 400 }
      );
    }

    let result: any = {};

    // Hunter.io operations
    if (service === 'hunter') {
      if (action === 'domain-search' && domain) {
        const data = await findEmailsWithHunter(domain, apiKey, { limit, offset });
        result = {
          emails: data.emails,
          pattern: data.pattern,
          organization: data.organization,
          count: data.emails.length,
        };
      } else if (action === 'verify' && email) {
        const data = await verifyEmailWithHunter(email, apiKey);
        result = data;
      } else if (action === 'person-lookup' && domain && firstName && lastName) {
        const data = await findPersonEmail(domain, firstName, lastName, apiKey);
        result = {
          email: data.email,
          score: data.score,
        };
      } else {
        return NextResponse.json(
          { error: 'Invalid action or missing parameters for Hunter.io' },
          { status: 400 }
        );
      }
    }
    // Apollo.io operations
    else if (service === 'apollo') {
      if (action === 'people-search') {
        const data = await searchPeopleOnApollo({
          companyName,
          companyDomain: companyDomain ? [companyDomain] : undefined,
          jobTitles: jobTitles ? (Array.isArray(jobTitles) ? jobTitles : [jobTitles]) : undefined,
          seniority: seniority ? (Array.isArray(seniority) ? seniority : [seniority]) : undefined,
          departments: departments ? (Array.isArray(departments) ? departments : [departments]) : undefined,
          location: location ? (Array.isArray(location) ? location : [location]) : undefined,
          employeeCount: employeeCount ? (Array.isArray(employeeCount) ? employeeCount : [employeeCount]) : undefined,
          revenue: revenue ? (Array.isArray(revenue) ? revenue : [revenue]) : undefined,
          industry: industry ? (Array.isArray(industry) ? industry : [industry]) : undefined,
          apiKey,
          page,
          perPage,
        });
        result = {
          emails: data.emails,
          count: data.emails.length,
          totalResults: data.totalResults,
          people: data.people.map(p => ({
            name: p.name,
            email: p.email,
            title: p.title,
            company: p.organization_name,
            linkedin: p.linkedin_url,
          })),
        };
      } else if (action === 'person-lookup' && firstName && lastName) {
        const data = await enrichPersonApollo({
          firstName,
          lastName,
          companyDomain,
          linkedinUrl,
          apiKey,
        });
        result = {
          email: data.email,
          person: {
            name: data.person.name,
            title: data.person.title,
            company: data.person.organization_name,
            linkedin: data.person.linkedin_url,
          },
        };
      } else {
        return NextResponse.json(
          { error: 'Invalid action or missing parameters for Apollo.io' },
          { status: 400 }
        );
      }
    }
    // RocketReach operations
    else if (service === 'rocketreach') {
      if (action === 'people-search') {
        const data = await lookupEmailsRocketReach({
          name,
          company: companyName,
          title: jobTitles ? (Array.isArray(jobTitles) ? jobTitles[0] : jobTitles) : undefined,
          location: location ? (Array.isArray(location) ? location[0] : location) : undefined,
          apiKey,
          pageSize: perPage || limit,
          start: offset,
        });
        result = {
          emails: data.emails,
          count: data.emails.length,
          profiles: data.profiles.map(p => ({
            name: p.name,
            email: p.emails?.[0]?.email,
            title: p.current_title,
            company: p.current_employer,
            linkedin: p.linkedin_url,
          })),
        };
      } else if (action === 'person-lookup' && name) {
        const data = await lookupPersonRocketReach({
          name,
          company: companyName,
          apiKey,
        });
        if (data) {
          result = {
            email: data.email,
            profile: {
              name: data.profile.name,
              title: data.profile.current_title,
              company: data.profile.current_employer,
              linkedin: data.profile.linkedin_url,
            },
          };
        } else {
          result = { email: null, message: 'Person not found' };
        }
      } else {
        return NextResponse.json(
          { error: 'Invalid action or missing parameters for RocketReach' },
          { status: 400 }
        );
      }
    }
    else {
      return NextResponse.json(
        { error: 'Invalid service. Must be hunter, apollo, or rocketreach' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        service,
        action,
        ...result,
      },
      {
        headers: {
          'X-RateLimit-Limit': '50',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
        },
      }
    );
  } catch (error) {
    console.error('Email finder error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to find emails',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
