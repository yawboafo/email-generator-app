import { prisma } from './prisma';

// Type definitions for verification
export type VerificationStatus = 'valid' | 'risky' | 'invalid' | 'unknown';

export interface VerificationResult {
  email: string;
  status: VerificationStatus;
  reason?: string;
  fromCache: boolean;
  data?: any;
}

export interface BulkVerificationResult {
  results: VerificationResult[];
  stats: {
    total: number;
    valid: number;
    risky: number;
    invalid: number;
    unknown: number;
    fromCache: number;
    newlyVerified: number;
  };
}

/**
 * Get cached verification result for an email
 */
export async function getCachedVerification(email: string): Promise<VerificationResult | null> {
  try {
    const cached = await prisma.verifiedEmail.findUnique({
      where: { emailAddress: email.toLowerCase() }
    });

    if (!cached) return null;

    // Check if cache is still fresh (optional: add expiry logic here)
    // For now, we'll reuse any cached result
    return {
      email: cached.emailAddress,
      status: cached.status as VerificationStatus,
      fromCache: true,
      data: cached.verificationData
    };
  } catch (error) {
    console.error('Error fetching cached verification:', error);
    return null;
  }
}

/**
 * Save verification result to database
 * Only caches 'valid' and 'risky' emails, not 'invalid' or 'unknown'
 */
export async function saveVerificationResult(
  email: string,
  status: VerificationStatus,
  data?: any
): Promise<void> {
  try {
    // Only cache valid and risky emails, skip invalid/unknown
    if (status !== 'valid' && status !== 'risky') {
      return;
    }

    await prisma.verifiedEmail.upsert({
      where: { emailAddress: email.toLowerCase() },
      update: {
        status,
        verificationData: data || null,
        lastVerifiedAt: new Date(),
        verificationCount: { increment: 1 }
      },
      create: {
        id: email.toLowerCase(),
        emailAddress: email.toLowerCase(),
        status,
        verificationData: data || null,
        verificationCount: 1,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error saving verification result:', error);
  }
}

/**
 * Verify a single email with caching
 */
export async function verifyEmailWithCache(
  email: string,
  apiKey?: string
): Promise<VerificationResult> {
  // Check cache first
  const cached = await getCachedVerification(email);
  if (cached) {
    // Only skip verification for invalid emails
    // Valid emails use cache, risky emails get re-verified
    if (cached.status === 'valid' || cached.status === 'invalid') {
      return cached;
    }
    // For risky emails, continue to re-verify
  }

  // If not cached or is risky, verify with API
  const result = await verifyEmailWithAPI(email, apiKey);
  
  // Save to cache
  await saveVerificationResult(result.email, result.status, result.data);
  
  return result;
}

/**
 * Verify email using mails.so API
 */
async function verifyEmailWithAPI(
  email: string,
  apiKey?: string
): Promise<VerificationResult> {
  // Use the provided API key or default mails.so key
  const finalApiKey = apiKey || '85e695d6-41e1-4bad-827c-bf03b11d593b';

  try {
    // Using mails.so API
    const response = await fetch(
      `https://api.mails.so/v1/validate?email=${encodeURIComponent(email)}`,
      { 
        method: 'GET',
        headers: {
          'x-mails-api-key': finalApiKey
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      let errorMsg = `Mails.so API error: ${response.status}`;
      
      if (response.status === 401) {
        errorMsg = 'Mails.so API: Invalid or expired API key';
      } else if (response.status === 429) {
        errorMsg = 'Mails.so API: Rate limit exceeded';
      } else if (errorData?.error) {
        errorMsg = `Mails.so API: ${errorData.error}`;
      }
      
      throw new Error(errorMsg);
    }

    const responseData = await response.json();
    const data = responseData.data;
    
    if (!data) {
      throw new Error('Invalid response from Mails.so API');
    }
    
    // Parse mails.so response
    // mails.so returns: { data: { result, reason, score, etc. }, error }
    let status: VerificationStatus = 'unknown';
    
    if (data.result === 'deliverable') {
      status = 'valid';
    } else if (data.result === 'risky') {
      status = 'risky';
    } else if (data.result === 'undeliverable') {
      status = 'invalid';
    } else {
      status = 'unknown';
    }

    return {
      email,
      status,
      reason: `${data.result} - ${data.reason} (score: ${data.score})`,
      fromCache: false,
      data: { ...data, timestamp: new Date().toISOString() }
    };
  } catch (error) {
    console.error('Error verifying email with mails.so API:', error);
    return {
      email,
      status: 'unknown',
      reason: error instanceof Error ? error.message : 'Verification failed',
      fromCache: false
    };
  }
}

/**
 * Verify multiple emails in bulk with caching
 */
export async function verifyEmailsBulk(
  emails: string[],
  apiKey?: string
): Promise<BulkVerificationResult> {
  const results: VerificationResult[] = [];
  const stats = {
    total: emails.length,
    valid: 0,
    risky: 0,
    invalid: 0,
    unknown: 0,
    fromCache: 0,
    newlyVerified: 0
  };

  // Process emails in batches to avoid overwhelming the API
  const batchSize = 10;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    
    // Verify each email in the batch
    const batchResults = await Promise.all(
      batch.map(email => verifyEmailWithCache(email, apiKey))
    );
    
    results.push(...batchResults);
    
    // Small delay between batches to respect API rate limits
    if (i + batchSize < emails.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Calculate stats
  results.forEach(result => {
    stats[result.status]++;
    if (result.fromCache) {
      stats.fromCache++;
    } else {
      stats.newlyVerified++;
    }
  });

  return { results, stats };
}

/**
 * Get emails by verification status (for reuse)
 */
export async function getVerifiedEmailsByStatus(
  status: VerificationStatus | VerificationStatus[],
  limit: number = 100
): Promise<string[]> {
  try {
    const statuses = Array.isArray(status) ? status : [status];
    
    const verified = await prisma.verifiedEmail.findMany({
      where: {
        status: { in: statuses }
      },
      select: {
        emailAddress: true
      },
      orderBy: {
        lastVerifiedAt: 'desc'
      },
      take: limit
    });

    return verified.map(v => v.emailAddress);
  } catch (error) {
    console.error('Error fetching verified emails:', error);
    return [];
  }
}

/**
 * Get verification statistics
 */
export async function getVerificationStats() {
  try {
    const [total, valid, risky, invalid, unknown] = await Promise.all([
      prisma.verifiedEmail.count(),
      prisma.verifiedEmail.count({ where: { status: 'valid' } }),
      prisma.verifiedEmail.count({ where: { status: 'risky' } }),
      prisma.verifiedEmail.count({ where: { status: 'invalid' } }),
      prisma.verifiedEmail.count({ where: { status: 'unknown' } })
    ]);

    return {
      total,
      valid,
      risky,
      invalid,
      unknown
    };
  } catch (error) {
    console.error('Error fetching verification stats:', error);
    return {
      total: 0,
      valid: 0,
      risky: 0,
      invalid: 0,
      unknown: 0
    };
  }
}

/**
 * Clear old verification cache (optional maintenance function)
 */
export async function clearOldVerifications(daysOld: number = 90): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.verifiedEmail.deleteMany({
      where: {
        lastVerifiedAt: {
          lt: cutoffDate
        }
      }
    });

    return result.count;
  } catch (error) {
    console.error('Error clearing old verifications:', error);
    return 0;
  }
}
