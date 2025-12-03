import * as cheerio from 'cheerio';
import axios from 'axios';

/**
 * Extract emails from HTML text using improved regex
 */
function extractEmailsFromText(text: string): string[] {
  // More strict regex that requires word boundaries and proper email structure
  const emailRegex = /\b[a-zA-Z0-9][a-zA-Z0-9._%+-]{0,63}@[a-zA-Z0-9][a-zA-Z0-9.-]{0,253}\.[a-zA-Z]{2,}\b/g;
  const matches = text.match(emailRegex) || [];
  
  // Filter out false positives (image files, CSS files, etc.)
  return matches.filter(email => {
    const localPart = email.split('@')[0];
    const domainPart = email.split('@')[1];
    
    // Exclude if it looks like a filename
    if (localPart.match(/\.(png|jpg|jpeg|gif|svg|webp|css|js|ico)$/i)) return false;
    if (email.match(/\@\dx/i)) return false; // Matches @2x, @3x in image names
    
    // Must have reasonable local part (not just numbers or special chars)
    if (!localPart.match(/[a-zA-Z]/)) return false;
    
    // Domain must have at least one letter (not just numbers)
    if (!domainPart.match(/[a-zA-Z]/)) return false;
    
    // Exclude common image/asset patterns
    if (email.match(/-dark|light-|icon|logo|button/i)) return false;
    
    return true;
  });
}

/**
 * Scrape emails from a single URL with improved extraction
 */
export async function scrapeEmailsFromUrl(url: string): Promise<string[]> {
  try {
    // Add timeout and headers to avoid being blocked
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400, // Accept 2xx and 3xx
    });

    const html = response.data;
    const $ = cheerio.load(html);
    const emails = new Set<string>();

    // 1. Extract from mailto links (highest priority)
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        const email = href.replace('mailto:', '').split('?')[0].split('&')[0].trim();
        if (email.includes('@')) {
          emails.add(email.toLowerCase());
        }
      }
    });

    // 2. Extract emails from visible text
    const pageText = $('body').text();
    const textEmails = extractEmailsFromText(pageText);
    textEmails.forEach(email => emails.add(email.toLowerCase()));

    // 3. Extract from HTML source (catches obfuscated emails)
    const sourceEmails = extractEmailsFromText(html);
    sourceEmails.forEach(email => emails.add(email.toLowerCase()));

    // 4. Extract emails from data attributes
    $('[data-email], [data-mail]').each((_, el) => {
      const email = $(el).attr('data-email') || $(el).attr('data-mail');
      if (email && email.includes('@')) {
        emails.add(email.toLowerCase());
      }
    });

    // 5. Extract from meta tags
    $('meta[property="og:email"], meta[name="email"], meta[name="contact:email"]').each((_, el) => {
      const email = $(el).attr('content');
      if (email && email.includes('@')) {
        emails.add(email.toLowerCase());
      }
    });

    // 6. Extract from specific classes/ids commonly used for contact info
    $('.email, .e-mail, #email, [class*="contact-email"], [class*="email-address"]').each((_, el) => {
      const text = $(el).text();
      const foundEmails = extractEmailsFromText(text);
      foundEmails.forEach(email => emails.add(email.toLowerCase()));
    });

    // 7. Look for obfuscated emails (e.g., "user [at] domain [dot] com")
    const obfuscatedRegex = /([a-zA-Z0-9._%+-]+)\s*[\[\(]?\s*at\s*[\]\)]?\s*([a-zA-Z0-9.-]+)\s*[\[\(]?\s*dot\s*[\]\)]?\s*([a-zA-Z]{2,})/gi;
    const matches = pageText.matchAll(obfuscatedRegex);
    for (const match of matches) {
      const email = `${match[1]}@${match[2]}.${match[3]}`.toLowerCase();
      emails.add(email);
    }

    return Array.from(emails);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 404) {
        throw new Error(`Request failed with status code 404`);
      }
      throw new Error(`${error.message}`);
    }
    throw new Error(`${error}`);
  }
}

/**
 * Get common paths to check for emails on a domain
 */
function getCommonEmailPaths(domain: string): string[] {
  // Normalize domain (remove www, https, etc)
  const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
  
  return [
    `https://${cleanDomain}`,
    `https://www.${cleanDomain}`,
    `https://${cleanDomain}/about`,
    `https://${cleanDomain}/about-us`,
    `https://${cleanDomain}/contact-us`,
    `https://${cleanDomain}/team`,
    `https://${cleanDomain}/company`,
    `https://${cleanDomain}/support`,
    `https://${cleanDomain}/help`,
  ];
}

/**
 * Try to find actual contact page by scraping links
 */
async function findContactPage(baseUrl: string, domain: string): Promise<string[]> {
  try {
    const response = await axios.get(baseUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    const $ = cheerio.load(response.data);
    const contactUrls = new Set<string>();

    // Find links with contact-related text
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().toLowerCase();
      
      if (href && (
        text.includes('contact') ||
        text.includes('about') ||
        text.includes('team') ||
        text.includes('support') ||
        href.toLowerCase().includes('contact') ||
        href.toLowerCase().includes('about')
      )) {
        let fullUrl = href;
        
        // Handle relative URLs
        if (href.startsWith('/')) {
          fullUrl = `https://${domain}${href}`;
        } else if (href.startsWith('http')) {
          // Only include if same domain
          if (href.includes(domain)) {
            fullUrl = href;
          }
        } else if (!href.startsWith('mailto:') && !href.startsWith('#')) {
          fullUrl = `https://${domain}/${href}`;
        }
        
        if (fullUrl.startsWith('http') && fullUrl.includes(domain)) {
          contactUrls.add(fullUrl);
        }
      }
    });

    return Array.from(contactUrls);
  } catch (error) {
    return [];
  }
}

/**
 * Scrape emails from multiple pages of a domain with improved strategy
 */
export async function scrapeEmailsFromDomain(
  domain: string,
  maxPages: number = 10
): Promise<{ emails: string[]; pagesScraped: number; errors: string[] }> {
  const allEmails = new Set<string>();
  const visited = new Set<string>();
  const errors: string[] = [];
  
  // Clean domain
  const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
  
  // Start with common paths
  const initialUrls = getCommonEmailPaths(cleanDomain);
  const toVisit: string[] = [...initialUrls];

  // Try to find actual contact/about pages from homepage
  try {
    const discoveredUrls = await findContactPage(`https://${cleanDomain}`, cleanDomain);
    // Add discovered URLs that aren't already in the list
    discoveredUrls.forEach(url => {
      if (!toVisit.includes(url) && !visited.has(url)) {
        toVisit.push(url);
      }
    });
  } catch (error) {
    // Continue with default URLs if discovery fails
  }

  while (toVisit.length > 0 && visited.size < maxPages) {
    const url = toVisit.shift()!;
    if (visited.has(url)) continue;

    visited.add(url);

    try {
      const emails = await scrapeEmailsFromUrl(url);
      emails.forEach(e => allEmails.add(e));
      
      // If we found emails, optionally stop early
      if (allEmails.size >= 5) {
        // Found enough emails, can stop early
        break;
      }
    } catch (error) {
      // Only log error if it's not a 404
      if (error instanceof Error && !error.message.includes('404')) {
        errors.push(`Failed to scrape ${url}: ${error.message}`);
      }
      // Silently skip 404s since /contact may not exist
    }

    // Add delay to be polite to servers
    await new Promise(resolve => setTimeout(resolve, 800));
  }

  return {
    emails: Array.from(allEmails),
    pagesScraped: visited.size,
    errors,
  };
}

/**
 * Search for emails by Google dorking (simulated)
 * Note: Actual implementation would require Google Custom Search API
 */
export async function searchEmailsByQuery(
  query: string,
  numResults: number = 10
): Promise<string[]> {
  // This is a placeholder - actual implementation would use:
  // 1. Google Custom Search API
  // 2. Bing Search API
  // 3. Or scraping search results (not recommended, against TOS)
  
  throw new Error('Search functionality requires Google Custom Search API key');
}

/**
 * Extract emails from a list of URLs in batch
 */
export async function batchScrapeUrls(
  urls: string[],
  concurrency: number = 3
): Promise<{ url: string; emails: string[]; error?: string }[]> {
  const results: { url: string; emails: string[]; error?: string }[] = [];
  
  // Process URLs in batches to avoid overwhelming servers
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const promises = batch.map(async (url) => {
      try {
        const emails = await scrapeEmailsFromUrl(url);
        return { url, emails };
      } catch (error) {
        return {
          url,
          emails: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
    
    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
    
    // Add delay between batches
    if (i + concurrency < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return results;
}

/**
 * Validate and clean scraped emails
 */
export function cleanAndValidateEmails(emails: string[]): string[] {
  const validEmails = new Set<string>();
  const emailRegex = /^[a-zA-Z0-9][a-zA-Z0-9._%+-]{0,63}@[a-zA-Z0-9][a-zA-Z0-9.-]{0,253}\.[a-zA-Z]{2,}$/;
  
  // Common false positives to filter out
  const excludePatterns = [
    '@example.com',
    '@domain.com',
    '@test.com',
    '@placeholder',
    'noreply@',
    'no-reply@',
    'donotreply@',
  ];
  
  // Image/asset filename patterns
  const assetPatterns = [
    /\@\dx/i,  // @2x, @3x image names
    /\.(png|jpg|jpeg|gif|svg|webp|css|js|ico|woff|ttf|eot)$/i,  // File extensions
    /-dark\@/i, /\@dark/i,  // Dark mode variants
    /-light\@/i, /\@light/i,  // Light mode variants  
    /icon\@/i, /\@icon/i,  // Icon files
    /logo\@/i, /\@logo/i,  // Logo files
    /button\@/i, /\@button/i,  // Button images
    /\@\d+x\d+/i,  // Size specifications like @300x200
  ];
  
  emails.forEach(email => {
    const cleaned = email.toLowerCase().trim();
    
    // Check if valid format
    if (!emailRegex.test(cleaned)) return;
    
    // Check if not a placeholder
    if (excludePatterns.some(pattern => cleaned.includes(pattern))) return;
    
    // Check if not an asset filename
    if (assetPatterns.some(pattern => pattern.test(cleaned))) return;
    
    // Local part must contain at least one letter
    const localPart = cleaned.split('@')[0];
    if (!localPart.match(/[a-zA-Z]/)) return;
    
    // Check if reasonable length
    if (cleaned.length < 6 || cleaned.length > 254) return;
    
    // Domain part must have at least one letter
    const domainPart = cleaned.split('@')[1];
    if (!domainPart || !domainPart.match(/[a-zA-Z]/)) return;
    
    validEmails.add(cleaned);
  });
  
  return Array.from(validEmails);
}
