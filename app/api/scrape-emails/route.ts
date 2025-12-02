import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  scrapeEmailsFromUrl,
  scrapeEmailsFromDomain,
  batchScrapeUrls,
  cleanAndValidateEmails,
} from '@/lib/emailScraper';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(clientId, 20, 60 * 60 * 1000); // 20 requests per hour

    if (!rateLimit.allowed) {
      const resetDate = new Date(rateLimit.resetTime);
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Too many scraping requests. Please try again later.',
          resetTime: resetDate.toISOString(),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '20',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetDate.toISOString(),
            'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    const body = await request.json();
    const { url, domain, urls, maxPages } = body;

    let emails: string[] = [];
    let pagesScraped = 0;
    let errors: string[] = [];

    // Single URL scraping
    if (url) {
      try {
        emails = await scrapeEmailsFromUrl(url);
        pagesScraped = 1;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Unknown error');
      }
    }
    // Domain scraping (multiple pages)
    else if (domain) {
      const result = await scrapeEmailsFromDomain(domain, maxPages || 10);
      emails = result.emails;
      pagesScraped = result.pagesScraped;
      errors = result.errors;
    }
    // Batch URL scraping
    else if (urls && Array.isArray(urls)) {
      const results = await batchScrapeUrls(urls, 3);
      emails = results.flatMap(r => r.emails);
      pagesScraped = results.length;
      errors = results
        .filter(r => r.error)
        .map(r => `${r.url}: ${r.error}`);
    }
    else {
      return NextResponse.json(
        { error: 'Missing required parameter: url, domain, or urls' },
        { status: 400 }
      );
    }

    // Clean and validate emails
    const validEmails = cleanAndValidateEmails(emails);

    return NextResponse.json(
      {
        success: true,
        emails: validEmails,
        count: validEmails.length,
        pagesScraped,
        errors: errors.length > 0 ? errors : undefined,
      },
      {
        headers: {
          'X-RateLimit-Limit': '20',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
        },
      }
    );
  } catch (error) {
    console.error('Email scraping error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to scrape emails',
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
