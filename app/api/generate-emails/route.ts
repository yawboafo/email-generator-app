import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateEmails, validateRequest } from '@/lib/emailGeneratorDb';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';
import type { GenerateEmailsRequest, GenerateEmailsResponse } from '@/types';

// Remove edge runtime since Prisma requires Node.js runtime
// export const runtime = 'edge';

/**
 * Generate emails using DeepSeek AI
 */
async function generateWithDeepSeek(params: GenerateEmailsRequest): Promise<string[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  
  if (!apiKey) {
    throw new Error('DeepSeek API key not configured');
  }

  const prompt = buildAIPrompt(params);
  
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'You are an expert email address generator. Generate realistic, creative email addresses based on user requirements. Return ONLY a JSON array of email addresses, nothing else. No explanations, no markdown, just the array.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('No content from DeepSeek');
  }

  return parseAIResponse(content, params.count, params.providers);
}

/**
 * Generate emails using OpenAI
 */
async function generateWithOpenAI(params: GenerateEmailsRequest): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const prompt = buildAIPrompt(params);
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert email address generator. Generate realistic, creative email addresses based on user requirements. Return ONLY a JSON array of email addresses, nothing else. No explanations, no markdown, just the array.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('No content from OpenAI');
  }

  return parseAIResponse(content, params.count, params.providers);
}

/**
 * Build prompt for AI
 */
function buildAIPrompt(params: GenerateEmailsRequest): string {
  let prompt = `Generate ${params.count} unique email addresses.\n\n`;
  prompt += `Demographics: Country=${params.country}, Age=${params.ageRange}, Gender=${params.gender}\n`;
  prompt += `Domains: ${params.providers.join(', ')}\n`;
  prompt += `Pattern: ${params.pattern}\n`;
  if (params.interests && params.interests.length > 0) {
    prompt += `Interests: ${params.interests.join(', ')}\n`;
  }
  prompt += `\nReturn ONLY a JSON array: ["email1@domain.com", "email2@domain.com", ...]`;
  return prompt;
}

/**
 * Parse AI response
 */
function parseAIResponse(content: string, count: number, providers: string[]): string[] {
  try {
    // Remove markdown code blocks if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    if (!Array.isArray(parsed)) {
      throw new Error('Response not an array');
    }
    
    const emails = parsed
      .filter((e: any) => typeof e === 'string')
      .map((e: string) => e.trim().toLowerCase())
      .filter((e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      .filter((e: string) => providers.includes(e.split('@')[1]));
    
    const unique = [...new Set(emails)];
    
    if (unique.length < Math.min(count * 0.5, 5)) {
      throw new Error(`Insufficient valid emails: ${unique.length}/${count}`);
    }
    
    return unique.slice(0, count);
  } catch (error) {
    console.error('Parse error:', error, 'Content:', content);
    throw new Error('Failed to parse AI response');
  }
}

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

    // Generate emails based on selected method
    let emails: string[];
    
    if (body.method === 'deepseek') {
      // Use DeepSeek AI
      emails = await generateWithDeepSeek(body);
    } else if (body.method === 'openai') {
      // Use OpenAI
      emails = await generateWithOpenAI(body);
    } else {
      // Use pattern-based generation (default)
      emails = await generateEmails(
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
    }

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
