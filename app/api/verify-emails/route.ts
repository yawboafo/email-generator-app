import { NextRequest, NextResponse } from 'next/server';
import { 
  getCachedVerification, 
  saveVerificationResult,
  type VerificationStatus 
} from '@/lib/emailVerification';

// Your EmailListVerify API key
const ELV_API_KEY = 'KgKElgkVf8JMq3SYERbhD5VK6sEzjzP8';

// Mailboxlayer API key (get your own at mailboxlayer.com)
const MAILBOXLAYER_API_KEY = '332b9a272886bb84dfa9b3aeaba576dc';

// Mails.so API key
const MAILSSO_API_KEY = '85e695d6-41e1-4bad-827c-bf03b11d593b';

// Check email using EmailListVerify API (simple verification)
async function checkEmailListVerify(email: string): Promise<{
  exists: boolean;
  reason: string;
  status: 'ok' | 'email_disabled' | 'dead_server' | 'invalid_mx' | 'disposable' | 'spamtrap' | 'ok_for_all' | 'smtp_protocol' | 'antispam_system' | 'unknown' | 'invalid_syntax';
  details?: any;
}> {
  try {
    const response = await fetch(
      `https://api.emaillistverify.com/api/verifyEmail?email=${encodeURIComponent(email)}`,
      {
        method: 'GET',
        headers: {
          'x-api-key': ELV_API_KEY,
        },
        signal: AbortSignal.timeout(15000), // 15 second timeout
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded (15 requests/second)');
      }
      throw new Error(`EmailListVerify API error: ${response.status}`);
    }

    const data = await response.text();
    const status = data.trim().toLowerCase();
    
    let exists = false;
    let reason = '';
    
    // Handle all status codes per API documentation
    switch (status) {
      case 'ok':
        exists = true;
        reason = 'Email is valid and deliverable';
        break;
      case 'email_disabled':
        exists = false;
        reason = 'Email address is disabled or non-existent';
        break;
      case 'dead_server':
        exists = false;
        reason = 'Email domain does not exist or lacks MX server';
        break;
      case 'invalid_mx':
        exists = false;
        reason = 'Email domain has misconfigured MX servers';
        break;
      case 'disposable':
        exists = false;
        reason = 'Disposable/temporary email address';
        break;
      case 'spamtrap':
        exists = false;
        reason = 'Spam trap email address detected';
        break;
      case 'ok_for_all':
        exists = true;
        reason = 'Domain accepts all emails (catch-all) - may bounce';
        break;
      case 'smtp_protocol':
        exists = false;
        reason = 'SMTP communication terminated unexpectedly';
        break;
      case 'antispam_system':
        exists = false;
        reason = 'Anti-spam measures blocked verification';
        break;
      case 'unknown':
        exists = false;
        reason = 'Verification inconclusive';
        break;
      case 'invalid_syntax':
        exists = false;
        reason = 'Invalid email syntax';
        break;
      default:
        exists = false;
        reason = `Verification result: ${status}`;
    }

    return {
      exists,
      reason,
      status: status as any,
      details: { raw: data },
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('EmailListVerify API timeout');
    }
    throw error;
  }
}

// Check email using EmailListVerify Detailed API (more info)
async function checkEmailListVerifyDetailed(email: string): Promise<{
  exists: boolean;
  reason: string;
  status: string;
  details: any;
}> {
  try {
    const response = await fetch(
      `https://api.emaillistverify.com/api/verifyEmailDetailed?email=${encodeURIComponent(email)}`,
      {
        method: 'GET',
        headers: {
          'x-api-key': ELV_API_KEY,
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded (15 requests/second)');
      }
      throw new Error(`EmailListVerify API error: ${response.status}`);
    }

    const data = await response.json();
    
    const status = (data.status || 'unknown').toLowerCase();
    let exists = status === 'ok' || status === 'ok_for_all';
    
    return {
      exists,
      reason: data.reason || getReasonFromStatus(status),
      status,
      details: data,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('EmailListVerify API timeout');
    }
    throw error;
  }
}

function getReasonFromStatus(status: string): string {
  const reasons: Record<string, string> = {
    'ok': 'Email is valid and deliverable',
    'email_disabled': 'Email address is disabled or non-existent',
    'dead_server': 'Email domain does not exist',
    'invalid_mx': 'Domain has misconfigured MX servers',
    'disposable': 'Disposable/temporary email',
    'spamtrap': 'Spam trap detected',
    'ok_for_all': 'Catch-all domain (may bounce)',
    'smtp_protocol': 'SMTP error',
    'antispam_system': 'Anti-spam blocked',
    'unknown': 'Verification inconclusive',
    'invalid_syntax': 'Invalid email syntax',
  };
  return reasons[status] || `Status: ${status}`;
}

// Check email using Mailboxlayer API
async function checkEmailMailboxlayer(email: string): Promise<{
  exists: boolean;
  reason: string;
  status: string;
  details?: any;
}> {
  try {
    const response = await fetch(
      `https://apilayer.net/api/check?access_key=${MAILBOXLAYER_API_KEY}&email=${encodeURIComponent(email)}&smtp=1&format=1`,
      {
        method: 'GET',
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      throw new Error(`Mailboxlayer API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Mailboxlayer response structure
    let exists = false;
    let reason = '';
    let status = 'unknown';

    if (data.format_valid === false) {
      exists = false;
      reason = 'Invalid email format';
      status = 'invalid_syntax';
    } else if (data.mx_found === false) {
      exists = false;
      reason = 'No MX records found for domain';
      status = 'invalid_mx';
    } else if (data.disposable === true) {
      exists = false;
      reason = 'Disposable email address';
      status = 'disposable';
    } else if (data.smtp_check === false) {
      exists = false;
      reason = 'SMTP check failed - mailbox does not exist';
      status = 'email_disabled';
    } else if (data.catch_all === true) {
      exists = true;
      reason = 'Catch-all domain (accepts all emails)';
      status = 'ok_for_all';
    } else if (data.smtp_check === true && data.mx_found === true) {
      exists = true;
      reason = 'Email is valid and deliverable';
      status = 'ok';
    } else {
      exists = false;
      reason = 'Verification inconclusive';
      status = 'unknown';
    }

    return {
      exists,
      reason,
      status,
      details: data,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Mailboxlayer API timeout');
    }
    throw error;
  }
}

// Check email using Mails.so API
async function checkEmailMailsSo(email: string): Promise<{
  exists: boolean;
  reason: string;
  status: 'ok' | 'email_disabled' | 'invalid_mx' | 'disposable' | 'ok_for_all' | 'unknown' | 'invalid_syntax';
  details?: any;
}> {
  try {
    const response = await fetch(
      `https://api.mails.so/v1/validate?email=${encodeURIComponent(email)}`,
      {
        method: 'GET',
        headers: {
          'x-mails-api-key': MAILSSO_API_KEY,
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      throw new Error(`Mails.so API error: ${response.status}`);
    }

    const result = await response.json();
    const data = result.data;
    
    // Map Mails.so result to our status format
    let status: 'ok' | 'email_disabled' | 'invalid_mx' | 'disposable' | 'ok_for_all' | 'unknown' | 'invalid_syntax';
    let exists = false;
    let reason = data.reason || 'Unknown';
    
    // Check result type from Mails.so
    if (data.result === 'deliverable') {
      status = 'ok';
      exists = true;
      reason = 'Email is valid and deliverable';
    } else if (data.result === 'undeliverable') {
      // Check specific reason
      if (data.reason === 'invalid_format' || data.reason === 'invalid_domain') {
        status = 'invalid_syntax';
        reason = 'Email format or domain is invalid';
      } else if (data.reason === 'invalid_smtp' || data.reason === 'rejected_email') {
        status = 'email_disabled';
        reason = 'Email address does not exist or is disabled';
      } else if (!data.isv_mx) {
        status = 'invalid_mx';
        reason = 'Invalid MX record';
      } else {
        status = 'email_disabled';
        reason = 'Email is undeliverable';
      }
      exists = false;
    } else if (data.result === 'risky') {
      // Handle risky emails
      if (data.reason === 'catch_all') {
        status = 'ok_for_all';
        exists = true;
        reason = 'Domain accepts all emails (catch-all)';
      } else if (data.reason === 'disposable' || data.is_disposable) {
        status = 'disposable';
        exists = false;
        reason = 'Disposable email address';
      } else {
        status = 'ok_for_all';
        exists = true;
        reason = 'Email is risky but may be deliverable';
      }
    } else {
      // Unknown result
      status = 'unknown';
      exists = false;
      reason = 'Unable to verify email';
    }
    
    return {
      exists,
      reason,
      status,
      details: data,
    };
  } catch (error) {
    console.error('Mails.so verification error:', error);
    return {
      exists: false,
      reason: error instanceof Error ? error.message : 'Verification failed',
      status: 'unknown',
    };
  }
}

// Check email using Reacher API (check-if-email-exists)
async function checkEmailReacher(email: string, reacherUrl: string = 'http://localhost:8080'): Promise<{
  exists: boolean;
  reason: string;
  details?: any;
}> {
  try {
    const response = await fetch(reacherUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to_emails: [email], // Reacher expects an array
        from_email: 'user@example.com',
        hello_name: 'example.com',
      }),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Reacher API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Reacher returns an array of results
    const result = Array.isArray(data) ? data[0] : data;
    
    // Check the is_reachable field
    const isReachable = result.is_reachable === 'safe' || result.is_reachable === 'risky';
    const reason = result.is_reachable === 'safe' 
      ? 'Email exists and is deliverable'
      : result.is_reachable === 'risky'
      ? 'Email may exist but has delivery issues'
      : result.is_reachable === 'invalid'
      ? 'Email address is invalid'
      : 'Email verification failed';

    return {
      exists: isReachable,
      reason,
      details: result,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Reacher API timeout');
    }
    throw error;
  }
}

// Basic syntax validation
function isValidEmailSyntax(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

interface VerificationResult {
  email: string;
  valid: boolean;
  reason: string;
  status: 'valid' | 'invalid' | 'risky' | 'error';
  elvStatus?: string;
  details?: any;
}

// Rate limiting helper - max 15 requests per second
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  try {
    const { 
      emails, 
      concurrency = 5, // Reduced default to stay under rate limit
      method = 'emaillistverify',
      detailed = false // Use detailed API for more info
    } = await request.json();

    if (!emails || !Array.isArray(emails)) {
      return NextResponse.json(
        { error: 'Invalid request. Expected an array of emails.' },
        { status: 400 }
      );
    }

    if (emails.length === 0) {
      return NextResponse.json(
        { error: 'No emails provided.' },
        { status: 400 }
      );
    }

    if (emails.length > 10000) {
      return NextResponse.json(
        { error: 'Maximum 10,000 emails per request.' },
        { status: 400 }
      );
    }

    const results: VerificationResult[] = [];
    const uniqueEmails = [...new Set(emails)]; // Remove duplicates

    // Process emails in batches with concurrency control
    for (let i = 0; i < uniqueEmails.length; i += concurrency) {
      const batch = uniqueEmails.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (email: string): Promise<VerificationResult> => {
        const trimmedEmail = email.trim().toLowerCase();
        
        // Skip empty emails
        if (!trimmedEmail) {
          return {
            email: trimmedEmail,
            valid: false,
            reason: 'Empty email address',
            status: 'invalid' as const
          };
        }

        // First check syntax
        if (!isValidEmailSyntax(trimmedEmail)) {
          return {
            email: trimmedEmail,
            valid: false,
            reason: 'Invalid email syntax',
            status: 'invalid' as const
          };
        }

        // Check cache first
        const cached = await getCachedVerification(trimmedEmail);
        if (cached) {
          // Only skip verification for valid and invalid emails
          // Risky emails should be re-verified
          if (cached.status === 'valid' || cached.status === 'invalid') {
            return {
              email: trimmedEmail,
              valid: cached.status === 'valid',
              reason: `${cached.data?.reason || 'Cached result'} (from cache)`,
              status: cached.status as 'valid' | 'invalid' | 'risky',
              details: cached.data
            };
          }
          // For risky emails, continue to re-verify below
        }

        // Then verify with chosen method
        try {
          if (method === 'emaillistverify') {
            // Use EmailListVerify API
            const result = detailed 
              ? await checkEmailListVerifyDetailed(trimmedEmail)
              : await checkEmailListVerify(trimmedEmail);
            
            // Map ELV status to our status categories
            const elvStatus = result.status;
            let ourStatus: 'valid' | 'invalid' | 'risky' = 'invalid';
            
            if (elvStatus === 'ok') {
              ourStatus = 'valid';
            } else if (elvStatus === 'ok_for_all') {
              ourStatus = 'risky'; // Catch-all domains are risky
            } else if (['smtp_protocol', 'antispam_system', 'unknown'].includes(elvStatus)) {
              ourStatus = 'risky'; // Inconclusive results
            } else {
              ourStatus = 'invalid';
            }
            
            // Save to cache
            await saveVerificationResult(trimmedEmail, ourStatus as VerificationStatus, result.details);
            
            return {
              email: trimmedEmail,
              valid: result.exists,
              reason: result.reason,
              status: ourStatus,
              elvStatus: elvStatus,
              details: result.details
            };
          } else if (method === 'mailboxlayer') {
            // Use Mailboxlayer API
            const result = await checkEmailMailboxlayer(trimmedEmail);
            
            // Map Mailboxlayer status to our status categories
            let ourStatus: 'valid' | 'invalid' | 'risky' = 'invalid';
            
            if (result.status === 'ok') {
              ourStatus = 'valid';
            } else if (result.status === 'ok_for_all') {
              ourStatus = 'risky';
            } else if (result.status === 'unknown') {
              ourStatus = 'risky';
            } else {
              ourStatus = 'invalid';
            }
            
            // Save to cache
            await saveVerificationResult(trimmedEmail, ourStatus as VerificationStatus, result.details);
            
            return {
              email: trimmedEmail,
              valid: result.exists,
              reason: result.reason,
              status: ourStatus,
              elvStatus: result.status,
              details: result.details
            };
          } else if (method === 'reacher') {
            // Use Reacher API (check-if-email-exists)
            const result = await checkEmailReacher(trimmedEmail);
            const ourStatus: VerificationStatus = result.exists ? 'valid' : 'invalid';
            
            // Save to cache
            await saveVerificationResult(trimmedEmail, ourStatus, result.details);
            
            return {
              email: trimmedEmail,
              valid: result.exists,
              reason: result.reason,
              status: result.exists ? ('valid' as const) : ('invalid' as const),
              details: result.details
            };
          } else if (method === 'mailsso') {
            // Use Mails.so API
            const result = await checkEmailMailsSo(trimmedEmail);
            
            // Map Mails.so status to our status categories
            let ourStatus: 'valid' | 'invalid' | 'risky' = 'invalid';
            
            if (result.status === 'ok') {
              ourStatus = 'valid';
            } else if (result.status === 'ok_for_all') {
              ourStatus = 'risky';
            } else if (result.status === 'unknown') {
              ourStatus = 'risky';
            } else {
              ourStatus = 'invalid';
            }
            
            // Save to cache
            await saveVerificationResult(trimmedEmail, ourStatus as VerificationStatus, result.details);
            
            return {
              email: trimmedEmail,
              valid: result.exists,
              reason: result.reason,
              status: ourStatus,
              elvStatus: result.status,
              details: result.details
            };
          } else {
            // Fallback to EmailListVerify for any unknown method
            const result = await checkEmailListVerify(trimmedEmail);
            const ourStatus: VerificationStatus = result.exists ? 'valid' : 'invalid';
            
            // Save to cache
            await saveVerificationResult(trimmedEmail, ourStatus, result.details);
            
            return {
              email: trimmedEmail,
              valid: result.exists,
              reason: result.reason,
              status: result.exists ? ('valid' as const) : ('invalid' as const),
              elvStatus: result.status
            };
          }
        } catch (error) {
          // If SMTP check fails (timeout/network error), mark as risky
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          return {
            email: trimmedEmail,
            valid: false,
            reason: errorMsg === 'Timeout' || errorMsg.includes('timeout') 
              ? 'Verification timeout (server may be blocking)' 
              : `Verification failed: ${errorMsg}`,
            status: 'risky' as const
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            email: 'unknown',
            valid: false,
            reason: 'Processing error',
            status: 'error'
          });
        }
      });
      
      // Rate limiting: wait between batches to stay under 15 req/sec
      // If batch size is 5, wait ~350ms between batches
      if (i + concurrency < uniqueEmails.length) {
        await delay(Math.ceil(1000 / 15) * concurrency);
      }
    }

    // Calculate statistics
    const stats = {
      total: results.length,
      valid: results.filter(r => r.status === 'valid').length,
      invalid: results.filter(r => r.status === 'invalid').length,
      risky: results.filter(r => r.status === 'risky').length,
      error: results.filter(r => r.status === 'error').length,
      cached: results.filter(r => r.reason?.includes('from cache')).length,
    };

    return NextResponse.json({
      success: true,
      results,
      stats,
      message: stats.cached > 0 ? `${stats.cached} results retrieved from cache` : undefined
    });

  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify emails', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
