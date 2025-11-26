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
        emailAddress: email.toLowerCase(),
        status,
        verificationData: data || null,
        verificationCount: 1
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
 * Verify email using external API (EmailListVerify or similar)
 */
async function verifyEmailWithAPI(
  email: string,
  apiKey?: string
): Promise<VerificationResult> {
  // If no API key, return unknown status
  if (!apiKey) {
    return {
      email,
      status: 'unknown',
      reason: 'No API key provided',
      fromCache: false
    };
  }

  try {
    // Example using EmailListVerify API
    const response = await fetch(
      `https://apps.emaillistverify.com/api/verifyEmail?secret=${apiKey}&email=${encodeURIComponent(email)}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.text();
    
    // Parse the response (EmailListVerify returns plain text)
    let status: VerificationStatus = 'unknown';
    
    if (data.includes('valid')) {
      status = 'valid';
    } else if (data.includes('risky') || data.includes('unknown') || data.includes('accept_all')) {
      status = 'risky';
    } else if (data.includes('invalid') || data.includes('bad') || data.includes('disposable')) {
      status = 'invalid';
    }

    return {
      email,
      status,
      reason: data,
      fromCache: false,
      data: { response: data, timestamp: new Date().toISOString() }
    };
  } catch (error) {
    console.error('Error verifying email with API:', error);
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
