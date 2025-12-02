import * as cheerio from 'cheerio';
import axios from 'axios';

/**
 * Extract emails from HTML text using regex
 */
function extractEmailsFromText(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return text.match(emailRegex) || [];
}

/**
 * Scrape emails from a single URL
 */
export async function scrapeEmailsFromUrl(url: string): Promise<string[]> {
  try {
    // Add timeout and headers to avoid being blocked
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    const html = response.data;
    const $ = cheerio.load(html);
    const emails = new Set<string>();

    // Extract emails from page text
    const pageText = $('body').text();
    const textEmails = extractEmailsFromText(pageText);
    textEmails.forEach(email => emails.add(email.toLowerCase()));

    // Extract emails from mailto links
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        const email = href.replace('mailto:', '').split('?')[0].trim();
        if (email.includes('@')) {
          emails.add(email.toLowerCase());
        }
      }
    });

    // Extract emails from data attributes
    $('[data-email]').each((_, el) => {
      const email = $(el).attr('data-email');
      if (email && email.includes('@')) {
        emails.add(email.toLowerCase());
      }
    });

    // Extract from meta tags
    $('meta[property="og:email"], meta[name="email"]').each((_, el) => {
      const email = $(el).attr('content');
      if (email && email.includes('@')) {
        emails.add(email.toLowerCase());
      }
    });

    return Array.from(emails);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to scrape ${url}: ${error.message}`);
    }
    throw new Error(`Failed to scrape ${url}: ${error}`);
  }
}

/**
 * Scrape emails from multiple pages of a domain
 */
export async function scrapeEmailsFromDomain(
  domain: string,
  maxPages: number = 10
): Promise<{ emails: string[]; pagesScraped: number; errors: string[] }> {
  const allEmails = new Set<string>();
  const visited = new Set<string>();
  const errors: string[] = [];
  const toVisit = [`https://${domain}`, `https://${domain}/contact`, `https://${domain}/about`];

  while (toVisit.length > 0 && visited.size < maxPages) {
    const url = toVisit.shift()!;
    if (visited.has(url)) continue;

    visited.add(url);

    try {
      const emails = await scrapeEmailsFromUrl(url);
      emails.forEach(e => allEmails.add(e));

      // Optional: Find more pages on same domain (basic crawling)
      // This is commented out to avoid over-crawling
      /*
      const response = await axios.get(url, { timeout: 5000 });
      const $ = cheerio.load(response.data);
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.startsWith('/')) {
          const fullUrl = `https://${domain}${href}`;
          if (!visited.has(fullUrl) && toVisit.length < maxPages * 2) {
            toVisit.push(fullUrl);
          }
        }
      });
      */
    } catch (error) {
      errors.push(`Failed to scrape ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Add delay to be polite to servers
    await new Promise(resolve => setTimeout(resolve, 1000));
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
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
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
  
  emails.forEach(email => {
    const cleaned = email.toLowerCase().trim();
    
    // Check if valid format
    if (!emailRegex.test(cleaned)) return;
    
    // Check if not a placeholder
    if (excludePatterns.some(pattern => cleaned.includes(pattern))) return;
    
    // Check if reasonable length
    if (cleaned.length < 6 || cleaned.length > 254) return;
    
    validEmails.add(cleaned);
  });
  
  return Array.from(validEmails);
}
