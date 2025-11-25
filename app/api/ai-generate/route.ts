import { NextRequest, NextResponse } from 'next/server';
import { aiEmailGenerator } from '@/lib/aiEmailGenerator';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const { allowed, remaining } = checkRateLimit(ip);
    
    if (!allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. Please try again later.',
          remaining: 0
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { prompt, count, providers } = body;

    // Validation
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required and must be a string' },
        { status: 400 }
      );
    }

    if (!count || typeof count !== 'number' || count < 1 || count > 500000) {
      return NextResponse.json(
        { error: 'Count must be a number between 1 and 500,000' },
        { status: 400 }
      );
    }

    if (providers && (!Array.isArray(providers) || providers.length === 0)) {
      return NextResponse.json(
        { error: 'Providers must be a non-empty array if provided' },
        { status: 400 }
      );
    }

    // Generate emails using AI
    const result = await aiEmailGenerator({
      prompt,
      count,
      providers
    });

    return NextResponse.json({
      emails: result.emails,
      meta: {
        count: result.metadata.count,
        prompt: result.metadata.prompt,
        patterns: result.metadata.patterns,
        remaining
      },
      contexts: result.metadata.contexts.slice(0, 10) // Return first 10 contexts as examples
    });

  } catch (error) {
    console.error('Error generating AI emails:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to generate emails',
        message: 'An error occurred while generating emails'
      },
      { status: 500 }
    );
  }
}
