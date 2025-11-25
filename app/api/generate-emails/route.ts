import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateEmails, validateRequest } from '@/lib/emailGenerator';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';
import type { GenerateEmailsRequest, GenerateEmailsResponse } from '@/types';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(clientId, 100, 60 * 60 * 1000); // 100 requests per hour

    if (!rateLimit.allowed) {
      const resetDate = new Date(rateLimit.resetTime);
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          resetTime: resetDate.toISOString()
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetDate.toISOString(),
            'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString()
          }
        }
      );
    }

    // Parse request body
    const body: GenerateEmailsRequest = await request.json();

    // Validate request
    const validation = validateRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          errors: validation.errors
        },
        { status: 400 }
      );
    }

    // Generate emails
    const emails = generateEmails(
      body.count,
      body.providers,
      body.country,
      body.ageRange,
      body.gender,
      body.interests || [],
      body.pattern,
      body.includeNumbers,
      body.numberRange,
      body.allowedCharacters
    );

    // Count provider usage
    const providerCounts = new Map<string, number>();
    emails.forEach(email => {
      const domain = email.split('@')[1];
      providerCounts.set(domain, (providerCounts.get(domain) || 0) + 1);
    });

    const response: GenerateEmailsResponse = {
      emails,
      meta: {
        count: emails.length,
        providersUsed: Array.from(providerCounts.keys())
      }
    };

    return NextResponse.json(response, {
      headers: {
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString()
      }
    });

  } catch (error) {
    console.error('Error generating emails:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
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
