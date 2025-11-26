import { NextRequest, NextResponse } from 'next/server';
import { aiEmailGenerator } from '@/lib/aiEmailGenerator';
import { checkRateLimit } from '@/lib/rateLimit';
import type { GenerationMethod } from '@/types';

/**
 * Generate emails using DeepSeek AI
 */
async function generateWithDeepSeek(prompt: string, count: number, providers: string[]): Promise<string[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  
  if (!apiKey) {
    throw new Error('DeepSeek API key not configured');
  }

  const aiPrompt = buildAIPrompt(prompt, count, providers);
  
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
          content: aiPrompt
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

  return parseAIResponse(content, count, providers);
}

/**
 * Generate emails using OpenAI
 */
async function generateWithOpenAI(prompt: string, count: number, providers: string[]): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const aiPrompt = buildAIPrompt(prompt, count, providers);
  
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
          content: aiPrompt
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

  return parseAIResponse(content, count, providers);
}

/**
 * Build prompt for AI
 */
function buildAIPrompt(userPrompt: string, count: number, providers: string[]): string {
  let prompt = `User Request: ${userPrompt}\n\n`;
  prompt += `Generate ${count} unique, realistic email addresses.\n`;
  prompt += `Domains: ${providers.join(', ')}\n`;
  prompt += `\nRequirements:\n`;
  prompt += `1. All email addresses must be unique\n`;
  prompt += `2. Match the user's description (demographics, profession, country, etc.)\n`;
  prompt += `3. Use realistic and commonly used username patterns\n`;
  prompt += `4. Distribute evenly across all provided domains\n`;
  prompt += `5. Return ONLY a JSON array: ["email1@domain.com", "email2@domain.com", ...]`;
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
    const { prompt, count, providers, method = 'deepseek' } = body;

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

    // Generate emails using selected AI method
    let emails: string[];
    
    if (method === 'openai') {
      emails = await generateWithOpenAI(prompt, count, providers);
    } else if (method === 'deepseek') {
      emails = await generateWithDeepSeek(prompt, count, providers);
    } else {
      // Fallback to pattern-based AI (existing behavior)
      const result = await aiEmailGenerator({
        prompt,
        count,
        providers
      });
      emails = result.emails;
    }

    return NextResponse.json({
      emails,
      meta: {
        count: emails.length,
        prompt,
        patterns: providers,
        remaining,
        method
      }
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
