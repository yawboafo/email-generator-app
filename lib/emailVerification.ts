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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
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
 * Verify email using specified service
 */
async function verifyEmailWithAPIService(
  email: string,
  service: VerificationService = 'mailsso',
  apiKey?: string
): Promise<VerificationResult> {
  const finalApiKey = apiKey || '85e695d6-41e1-4bad-827c-bf03b11d593b';

  try {
    let response: Response;
    let responseData: any;

    switch (service) {
      case 'mailsso':
        response = await fetch(
          `https://api.mails.so/v1/validate?email=${encodeURIComponent(email)}`,
          { 
            method: 'GET',
            headers: { 'x-mails-api-key': finalApiKey }
          }
        );
        break;

      case 'emaillistverify':
        response = await fetch(
          `https://api.emaillistverify.com/api/verifyEmail?email=${encodeURIComponent(email)}`,
          {
            method: 'GET',
            headers: { 'x-api-key': apiKey || 'KgKElgkVf8JMq3SYERbhD5VK6sEzjzP8' },
            signal: AbortSignal.timeout(15000)
          }
        );
        break;

      case 'mailboxlayer':
        const mailboxlayerKey = apiKey || '332b9a272886bb84dfa9b3aeaba576dc';
        response = await fetch(
          `https://apilayer.net/api/check?access_key=${mailboxlayerKey}&email=${encodeURIComponent(email)}&smtp=1&format=1`,
          {
            method: 'GET',
            signal: AbortSignal.timeout(15000)
          }
        );
        break;

      case 'reacher':
        const reacherUrl = apiKey || 'http://localhost:8080';
        response = await fetch(reacherUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to_emails: [email],
            from_email: 'user@example.com',
            hello_name: 'example.com'
          }),
          signal: AbortSignal.timeout(10000)
        });
        break;

      default:
        throw new Error(`Unsupported verification service: ${service}`);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      let errorMsg = `${service} API error: ${response.status}`;
      
      if (response.status === 401) {
        errorMsg = `${service} API: Invalid or expired API key`;
      } else if (response.status === 429) {
        errorMsg = `${service} API: Rate limit exceeded`;
      } else if (errorData?.error) {
        errorMsg = `${service} API: ${errorData.error}`;
      }
      
      throw new Error(errorMsg);
    }

    responseData = await response.json();
    
    // Parse response based on service
    return parseVerificationResponse(email, service, responseData);
  } catch (error: unknown) {
    console.error(`Error verifying email with ${service}:`, error);
    return {
      email,
      status: 'unknown',
      reason: error instanceof Error ? error.message : 'Verification failed',
      fromCache: false
    };
  }
}

/**
 * Parse verification response from different services
 */
function parseVerificationResponse(
  email: string,
  service: VerificationService,
  data: any
): VerificationResult {
  let status: VerificationStatus = 'unknown';
  let reason = '';

  switch (service) {
    case 'mailsso':
      const mailssoData = data.data;
      if (mailssoData.result === 'deliverable') {
        status = 'valid';
      } else if (mailssoData.result === 'risky') {
        status = 'risky';
      } else if (mailssoData.result === 'undeliverable') {
        status = 'invalid';
      }
      reason = `${mailssoData.result} - ${mailssoData.reason} (score: ${mailssoData.score})`;
      break;

    case 'emaillistverify':
      const elvStatus = (data.status || 'unknown').toLowerCase();
      if (elvStatus === 'ok') {
        status = 'valid';
      } else if (elvStatus === 'ok_for_all') {
        status = 'risky';
      } else if (['smtp_protocol', 'antispam_system', 'unknown'].includes(elvStatus)) {
        status = 'risky';
      } else {
        status = 'invalid';
      }
      reason = data.reason || elvStatus;
      break;

    case 'mailboxlayer':
      if (data.format_valid === false) {
        status = 'invalid';
        reason = 'Invalid email format';
      } else if (data.mx_found === false) {
        status = 'invalid';
        reason = 'No MX records found';
      } else if (data.disposable === true) {
        status = 'invalid';
        reason = 'Disposable email';
      } else if (data.smtp_check === false) {
        status = 'invalid';
        reason = 'SMTP check failed';
      } else if (data.catch_all === true) {
        status = 'risky';
        reason = 'Catch-all domain';
      } else if (data.smtp_check === true && data.mx_found === true) {
        status = 'valid';
        reason = 'Email is valid and deliverable';
      }
      break;

    case 'reacher':
      const result = Array.isArray(data) ? data[0] : data;
      if (result.is_reachable === 'safe') {
        status = 'valid';
        reason = 'Email exists and is deliverable';
      } else if (result.is_reachable === 'risky') {
        status = 'risky';
        reason = 'Email may exist but has delivery issues';
      } else if (result.is_reachable === 'invalid') {
        status = 'invalid';
        reason = 'Email address is invalid';
      } else {
        status = 'unknown';
        reason = 'Email verification failed';
      }
      break;
  }

  return {
    email,
    status,
    reason,
    fromCache: false,
    data: { ...data, timestamp: new Date().toISOString(), service }
  };
}

/**
 * Verify email using mails.so API (kept for backward compatibility)
 */
async function verifyEmailWithAPI(
  email: string,
  apiKey?: string
): Promise<VerificationResult> {
  return verifyEmailWithAPIService(email, 'mailsso', apiKey);
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
  } catch (err) {
    console.error('Error verifying email with mails.so API:', err);
    return {
      email,
      status: 'unknown',
      reason: (err as Error)?.message || 'Verification failed',
      fromCache: false
    };
  }
}

export type VerificationService = 'mailsso' | 'emaillistverify' | 'mailboxlayer' | 'reacher';

/**
 * Verify multiple emails using mails.so bulk API (up to 50 at once)
 */
async function verifyEmailsBulkAPI(
  emails: string[],
  service: VerificationService = 'mailsso',
  apiKey?: string
): Promise<VerificationResult[]> {
  // Only mails.so supports bulk API currently
  if (service !== 'mailsso') {
    // Fall back to individual verification for other services
    return Promise.all(emails.map(email => verifyEmailWithAPIService(email, service, apiKey)));
  }

  const finalApiKey = apiKey || '85e695d6-41e1-4bad-827c-bf03b11d593b';
  
  try {
    const response = await fetch('https://api.mails.so/v1/bulk', {
      method: 'POST',
      headers: {
        'x-mails-api-key': finalApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ emails })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      let errorMsg = `Mails.so bulk API error: ${response.status}`;
      
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
    
    if (!responseData.data || !Array.isArray(responseData.data)) {
      throw new Error('Invalid response from Mails.so bulk API');
    }
    
    // Map bulk results to our format
    return responseData.data.map((item: any) => {
      let status: VerificationStatus = 'unknown';
      
      if (item.result === 'deliverable') {
        status = 'valid';
      } else if (item.result === 'risky') {
        status = 'risky';
      } else if (item.result === 'undeliverable') {
        status = 'invalid';
      }

      return {
        email: item.email,
        status,
        reason: `${item.result} - ${item.reason} (score: ${item.score})`,
        fromCache: false,
        data: { ...item, timestamp: new Date().toISOString() }
      };
    });
  } catch (error: unknown) {
    console.error('Error with mails.so bulk verification:', error);
    // Return all as unknown on error
    return emails.map(email => ({
      email,
      status: 'unknown' as VerificationStatus,
      reason: error instanceof Error ? error.message : 'Verification failed',
      fromCache: false
    }));
  }
}

/**
 * Verify multiple emails in bulk with caching
 */
export async function verifyEmailsBulk(
  emails: string[],
  service: VerificationService = 'mailsso',
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

  // First, check which emails are already cached
  const uncachedEmails: string[] = [];
  const emailToCachedResult = new Map<string, VerificationResult>();

  for (const email of emails) {
    const cached = await getCachedVerification(email);
    if (cached && (cached.status === 'valid' || cached.status === 'invalid')) {
      emailToCachedResult.set(email, cached);
    } else {
      uncachedEmails.push(email);
    }
  }

  // Use bulk API for uncached emails (max 50 per request for mails.so)
  const bulkBatchSize = service === 'mailsso' ? 50 : 10; // Smaller batches for non-bulk services
  for (let i = 0; i < uncachedEmails.length; i += bulkBatchSize) {
    const batch = uncachedEmails.slice(i, i + bulkBatchSize);
    
    // Verify batch with bulk API
    const batchResults = await verifyEmailsBulkAPI(batch, service, apiKey);
    
    // Save to cache
    for (const result of batchResults) {
      await saveVerificationResult(result.email, result.status, result.data);
    }
    
    results.push(...batchResults);
    
    // Small delay between bulk batches
    if (i + bulkBatchSize < uncachedEmails.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Add cached results
  for (const email of emails) {
    const cached = emailToCachedResult.get(email);
    if (cached) {
      results.push(cached);
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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
    console.error('Error clearing old verifications:', error);
    return 0;
  }
}
