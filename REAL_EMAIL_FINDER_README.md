# Real Email Finder Feature

## Overview

The Real Email Finder is a comprehensive solution for finding **actual, existing email addresses** from various sources, as opposed to generating synthetic email combinations. This feature is critical for scenarios where you need verified, real-world email addresses.

## What Was Implemented

### 1. Web Scraping Library (`/lib/emailScraper.ts`)
**Purpose**: Extract emails from websites using HTML parsing

**Functions**:
- `scrapeEmailsFromUrl(url, maxPages)` - Scrape a single webpage
- `scrapeEmailsFromDomain(domain, maxPages)` - Crawl an entire domain
- `batchScrapeUrls(urls, maxPages)` - Process multiple URLs in batch
- `cleanAndValidateEmails(emails)` - Filter out false positives

**Features**:
- Finds emails in `mailto:` links and plain text
- Filters out common false positives (`noreply@`, `example.com`, etc.)
- Respects rate limiting (20 requests/hour)
- Handles errors gracefully

### 2. Hunter.io Integration (`/lib/emailFinders/hunter.ts`)
**Purpose**: Professional email finder API (25 free searches/month)

**Functions**:
- `findEmailsWithHunter(domain, apiKey)` - Domain search with confidence filtering (≥50%)
- `verifyEmailWithHunter(email, apiKey)` - Verify email deliverability
- `findPersonEmail(firstName, lastName, domain, apiKey)` - Find specific person's email
- `findEmailPattern(domain, apiKey)` - Discover company email patterns

**API Signup**: https://hunter.io/api

### 3. Apollo.io Integration (`/lib/emailFinders/apollo.ts`)
**Purpose**: B2B contact database (50 free contacts/month)

**Functions**:
- `searchPeopleOnApollo(params, apiKey)` - Advanced people search with filters:
  - Job titles
  - Seniority levels
  - Departments
  - Company domains
  - Locations
- `enrichPersonApollo(params, apiKey)` - Enrich contact data
- `searchOrganizationsApollo(params, apiKey)` - Company search

**API Signup**: https://apollo.io/api

### 4. RocketReach Integration (`/lib/emailFinders/rocketreach.ts`)
**Purpose**: Professional contact lookup (10 free lookups/month)

**Functions**:
- `lookupEmailsRocketReach(params, apiKey)` - Search people by name + company
- `lookupPersonRocketReach(params, apiKey)` - Single person lookup
- `bulkLookupRocketReach(people, apiKey)` - Batch lookups

**API Signup**: https://rocketreach.co/api

### 5. API Routes

#### `/api/scrape-emails` (POST)
**Purpose**: Web scraping endpoint
**Rate Limit**: 20 requests/hour

**Request Body**:
```json
{
  "url": "https://example.com/contact",       // For single URL
  "domain": "example.com",                     // For domain scraping
  "urls": ["url1", "url2"],                    // For batch scraping
  "maxPages": 10                               // Max pages to crawl
}
```

**Response**:
```json
{
  "emails": ["email1@example.com", "email2@example.com"],
  "count": 2,
  "pagesScraped": 5,
  "errors": []
}
```

#### `/api/find-emails` (POST)
**Purpose**: Unified endpoint for all email finder services
**Rate Limit**: 50 requests/hour

**Request Body**:
```json
{
  "service": "hunter|apollo|rocketreach",
  "action": "domain-search|people-search|person-lookup",
  "apiKey": "your-api-key",
  "domain": "example.com",                     // For domain search
  "companyName": "Google",                     // For people search
  "firstName": "John",                         // For person lookup
  "lastName": "Doe",                           // For person lookup
  "jobTitles": ["CEO", "CTO"],                 // Optional filters
  "location": ["San Francisco, CA"]            // Optional filters
}
```

**Response**:
```json
{
  "emails": ["john.doe@example.com"],
  "count": 1,
  "pattern": "{first}.{last}@example.com",     // Hunter only
  "organization": "Example Corp"                // Hunter only
}
```

### 6. UI Component (`/components/RealEmailFinder.tsx`)
**Purpose**: Comprehensive interface for real email finding

**Features**:
- 4 method selection cards (Scraper, Hunter, Apollo, RocketReach)
- Dynamic form fields based on selected method and action
- Action selection:
  - Scraper: Single URL, Whole Domain, Batch URLs
  - APIs: Domain Search, People Search, Person Lookup
- Real-time results display with copy functionality
- Error handling and loading states
- Visual badges showing free tier limits

### 7. Main Dashboard Integration (`/app/page.tsx`)
**Changes**:
- Added new "Find Real" tab with animated "NEW" badge
- Tab icon: Magnifying glass (search)
- Integrated RealEmailFinder component
- Results automatically populate the emails state for verification

## How to Use

### Method 1: Web Scraping (Free)
1. Click "Find Real" tab
2. Select "Web Scraper" method
3. Choose action:
   - **Single URL**: Scrape one webpage for emails
   - **Whole Domain**: Crawl an entire website (up to 50 pages)
   - **Batch URLs**: Process multiple URLs at once
4. Enter URL(s) and click "Scrape Real Emails"
5. Found emails appear in results panel

**Pros**: Free, no API keys needed
**Cons**: Slower, rate limited, depends on website structure

### Method 2: Hunter.io (25 free/month)
1. Get API key from https://hunter.io/api
2. Select "Hunter.io" method
3. Choose action:
   - **Domain Search**: Find all emails for a company domain
   - **People Search**: Search by company + job titles
   - **Person Lookup**: Find specific person's email
4. Enter API key and required fields
5. Click "Find Real Emails"

**Pros**: High accuracy, includes email patterns, confidence scores
**Cons**: Limited free tier

### Method 3: Apollo.io (50 free/month)
1. Get API key from https://apollo.io/api
2. Select "Apollo.io" method
3. Choose action:
   - **Domain Search**: Find contacts at a company
   - **People Search**: Advanced filtering by job title, seniority, department
   - **Person Lookup**: Find specific person
4. Enter API key and filters
5. Click "Find Real Emails"

**Pros**: Best for B2B, advanced filtering, higher free tier
**Cons**: Focused on business contacts

### Method 4: RocketReach (10 free/month)
1. Get API key from https://rocketreach.co/api
2. Select "RocketReach" method
3. Choose action:
   - **Domain Search**: Find company contacts
   - **People Search**: Search by name + company
   - **Person Lookup**: Direct person lookup
4. Enter API key and person details
5. Click "Find Real Emails"

**Pros**: Good for finding specific individuals
**Cons**: Lowest free tier

## API Keys Setup

Create a `.env.local` file in your project root (optional, users can enter keys in UI):

```bash
# Optional: Pre-configure API keys
HUNTER_API_KEY=your_hunter_key_here
APOLLO_API_KEY=your_apollo_key_here
ROCKETREACH_API_KEY=your_rocketreach_key_here
```

## Rate Limiting

- **Web Scraping**: 20 requests/hour per IP
- **Email Finders**: 50 requests/hour per IP
- Limits reset after 1 hour
- Excess requests return 429 error

## Integration with Other Features

### Verification Flow
1. Find real emails using any method
2. Results automatically populate the emails state
3. Switch to "Verify" tab to check deliverability
4. Send to valid addresses using "Send" tab

### Saving Results
1. Find real emails
2. Results populate the main email list
3. Click "Save" button to store batch
4. Access later from "Saved" tab

## Technical Details

### Dependencies
- `cheerio` - HTML parsing for web scraping
- `axios` - HTTP requests
- Built-in `rateLimit` utility for request throttling

### Error Handling
- Invalid API keys → Clear error message with link to signup
- Rate limit exceeded → Shows retry-after time
- No emails found → Returns empty array with explanation
- Network errors → Retries with exponential backoff

### Security
- API keys accepted via UI (not stored)
- HTTPS required for all API calls
- XSS protection on scraped content
- Input validation on all fields

## Troubleshooting

### No Emails Found
- **Web Scraping**: Website may not have visible emails or uses obfuscation
- **APIs**: Try different search parameters or check API key validity

### Rate Limit Errors
- Wait 1 hour for limits to reset
- Use different methods to distribute requests
- Consider upgrading to paid API tiers

### API Key Invalid
- Verify key is copied correctly
- Check if key has required permissions
- Ensure account is active and within quota

### Scraping Blocked
- Some websites block automated access
- Try different URLs from same domain
- Consider using API methods instead

## Future Enhancements

- [ ] Bulk export to CSV
- [ ] Email validation integration during search
- [ ] Historical search results caching
- [ ] API key storage in database
- [ ] Advanced filtering UI
- [ ] Results pagination
- [ ] LinkedIn URL enrichment
- [ ] Company org chart visualization

## Cost Comparison

| Service | Free Tier | Paid Tier | Best For |
|---------|-----------|-----------|----------|
| Web Scraper | Unlimited (rate limited) | N/A | Contact pages, small sites |
| Hunter.io | 25/month | $49/month (500 searches) | Domain searches, patterns |
| Apollo.io | 50/month | $49/month (unlimited) | B2B contacts, job titles |
| RocketReach | 10/month | $39/month (80 lookups) | Specific individuals |

## Security & Compliance

⚠️ **Important**: This tool is for legitimate business use only. Ensure compliance with:
- GDPR (EU data protection)
- CAN-SPAM Act (US email marketing)
- CASL (Canadian anti-spam)
- Company privacy policies
- Terms of service for APIs

**Do NOT use for**:
- Unsolicited spam
- Data scraping at scale without permission
- Harassment or malicious purposes

## Support

For issues or questions:
1. Check API provider documentation
2. Review error messages in the UI
3. Check browser console for detailed logs
4. Verify API keys and quotas

---

**Built for**: Email Management Suite
**Developer**: HackerOneBigFire
**Feature Status**: ✅ Production Ready
