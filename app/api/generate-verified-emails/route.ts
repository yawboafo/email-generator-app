import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateEmails, validateRequest } from '@/lib/emailGeneratorDb';
import { verifyEmailWithCache, type VerificationService } from '@/lib/emailVerification';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';
import type { GenerateEmailsRequest } from '@/types';

interface VerifiedEmailGenerationRequest extends GenerateEmailsRequest {
  targetCount: number; // Number of valid emails required
  batchSize?: number; // Number of emails to generate per batch
  maxAttempts?: number; // Maximum total emails to generate before giving up
  verificationService?: VerificationService; // Email verification service to use
}

interface VerifiedEmailGenerationResponse {
  success: boolean;
  emails: string[];
  progress: {
    totalGenerated: number;
    totalVerified: number;
    validCount: number;
    invalidCount: number;
    riskyCount: number;
    unknownCount: number;
  };
  meta: {
    targetCount: number;
    actualCount: number;
    batchesProcessed: number;
    timeElapsed: number;
  };
  error?: string;
}

/**
 * Generate and verify emails until we have the target number of valid emails
 */
async function generateVerifiedEmails(
  params: VerifiedEmailGenerationRequest,
  onProgress?: (progress: any) => void
): Promise<VerifiedEmailGenerationResponse> {
  const startTime = Date.now();
  const targetCount = params.targetCount;
  const batchSize = params.batchSize || 50; // Default batch size
  const maxAttempts = params.maxAttempts || targetCount * 10; // Safety limit

  const validEmails: string[] = [];
  const emailSet = new Set<string>(); // Track uniqueness
  
  let totalGenerated = 0;
  let totalVerified = 0;
  let validCount = 0;
  let invalidCount = 0;
  let riskyCount = 0;
  let unknownCount = 0;
  let batchesProcessed = 0;

  // Continue generating until we have enough valid emails or hit max attempts
  while (validEmails.length < targetCount && totalGenerated < maxAttempts) {
    batchesProcessed++;
    
    // Calculate how many more emails we need
    const remaining = targetCount - validEmails.length;
    
    // Generate more than we need to account for invalid emails
    // Assume ~30% valid rate, so generate 3x what we need (with minimum batch size)
    const generateCount = Math.max(batchSize, Math.ceil(remaining * 3));
    
    // Generate a batch of emails
    const batch = await generateEmails(
      generateCount,
      params.providers,
      params.country,
      params.ageRange,
      params.gender,
      params.interests || [],
      params.pattern,
      params.includeNumbers,
      params.numberRange,
      params.allowedCharacters
    );

    totalGenerated += batch.length;

    // Remove duplicates from batch
    const uniqueBatch = batch.filter(email => {
      if (emailSet.has(email)) return false;
      emailSet.add(email);
      return true;
    });

    // Verify emails in bulk (up to 50 at a time for mails.so)
    const { verifyEmailsBulk } = await import('@/lib/emailVerification');
    const verificationService = params.verificationService || 'mailsso';
    const bulkResult = await verifyEmailsBulk(uniqueBatch, verificationService);
    
    totalVerified += bulkResult.results.length;

    // Process results
    for (const verificationResult of bulkResult.results) {
      // Count by status
      if (verificationResult.status === 'valid') {
        validCount++;
        validEmails.push(verificationResult.email);
        
        // Stop if we've reached our target
        if (validEmails.length >= targetCount) {
          break;
        }
      } else if (verificationResult.status === 'invalid') {
        invalidCount++;
      } else if (verificationResult.status === 'risky') {
        riskyCount++;
      } else {
        unknownCount++;
      }
    }

    // Report progress after each batch
    if (onProgress) {
      onProgress({
        totalGenerated,
        totalVerified,
        validCount,
        invalidCount,
        riskyCount,
        unknownCount,
        progress: Math.round((validEmails.length / targetCount) * 100)
      });
    }

    // Small delay between batches to avoid overwhelming the API
    if (validEmails.length < targetCount && totalGenerated < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  const timeElapsed = Date.now() - startTime;

  return {
    success: validEmails.length >= targetCount,
    emails: validEmails.slice(0, targetCount),
    progress: {
      totalGenerated,
      totalVerified,
      validCount,
      invalidCount,
      riskyCount,
      unknownCount
    },
    meta: {
      targetCount,
      actualCount: validEmails.length,
      batchesProcessed,
      timeElapsed
    },
    error: validEmails.length < targetCount 
      ? `Only found ${validEmails.length} valid emails out of ${targetCount} requested after ${totalGenerated} attempts`
      : undefined
  };
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (stricter for this intensive operation)
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(clientId, 20, 60 * 60 * 1000); // 20 requests per hour

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
            'X-RateLimit-Limit': '20',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetDate.toISOString(),
            'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString()
          }
        }
      );
    }

    // Parse request body
    const body: VerifiedEmailGenerationRequest = await request.json();

    // Validate target count
    if (!body.targetCount || body.targetCount < 1) {
      return NextResponse.json(
        { error: 'targetCount must be at least 1' },
        { status: 400 }
      );
    }

    if (body.targetCount > 1000) {
      return NextResponse.json(
        { error: 'targetCount cannot exceed 1000 for verified generation' },
        { status: 400 }
      );
    }

    // Set count to be used for generation (we'll generate more than needed)
    body.count = body.batchSize || 50;

    // Validate other request parameters
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

    // If no country selected, pick a random one from the database
    if (!body.country) {
      const { getRandomCountry } = await import('@/lib/emailGeneratorDb');
      body.country = await getRandomCountry();
    }

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Generate and verify emails with progress callback
          const result = await generateVerifiedEmails(body, (progress) => {
            // Send progress update to client
            const data = JSON.stringify({ type: 'progress', data: progress });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          });

          // Send final result
          const data = JSON.stringify({ type: 'complete', data: result });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          controller.close();
        } catch (error) {
          const errorData = JSON.stringify({ 
            type: 'error', 
            data: { 
              message: error instanceof Error ? error.message : 'Unknown error' 
            } 
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-RateLimit-Limit': '20',
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString()
      }
    });

  } catch (error) {
    console.error('Error generating verified emails:', error);
    
    let errorMessage = 'An unexpected error occurred';
    let errorDetails = '';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      if (errorMessage.includes('No first names found') || errorMessage.includes('No last names found')) {
        errorDetails = 'The selected country does not have name data in the database. Please select a different country.';
      } else if (errorMessage.includes('Country') && errorMessage.includes('not found')) {
        errorDetails = 'The specified country does not exist in the database. Please select a valid country.';
      } else if (errorMessage.includes('No active providers found')) {
        errorDetails = 'No email providers are available. Please ensure at least one provider is active.';
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to generate verified emails',
        message: errorMessage,
        details: errorDetails || undefined,
        timestamp: new Date().toISOString()
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
