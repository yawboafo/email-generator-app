# Email Verification System

This document explains how to use the email verification system with caching and reuse capabilities.

## Overview

The system verifies emails and caches the results in the database for reuse. This saves API calls and provides faster responses for previously verified emails.

## Database Schema

```prisma
model VerifiedEmail {
  id                String   @id @default(cuid())
  emailAddress      String   @unique
  status            String   // "valid", "risky", "invalid", "unknown"
  verificationData  Json?    // Store full API response
  lastVerifiedAt    DateTime @default(now())
  verificationCount Int      @default(1)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

## API Endpoints

### 1. Verify Single Email
```bash
POST /api/verify-email
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "apiKey": "your-api-key-here"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "email": "john.doe@example.com",
    "status": "valid",
    "fromCache": false,
    "data": { ... }
  }
}
```

### 2. Verify Multiple Emails (Bulk)
```bash
POST /api/verify-email
Content-Type: application/json

{
  "emails": [
    "user1@example.com",
    "user2@example.com",
    "user3@example.com"
  ],
  "apiKey": "your-api-key-here"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "email": "user1@example.com",
      "status": "valid",
      "fromCache": true
    },
    {
      "email": "user2@example.com",
      "status": "risky",
      "fromCache": false
    }
  ],
  "stats": {
    "total": 3,
    "valid": 1,
    "risky": 1,
    "invalid": 1,
    "unknown": 0,
    "fromCache": 1,
    "newlyVerified": 2
  }
}
```

### 3. Get Verification Statistics
```bash
GET /api/verify-email?action=stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 1500,
    "valid": 800,
    "risky": 300,
    "invalid": 350,
    "unknown": 50
  }
}
```

### 4. Get Cached Emails by Status
```bash
# Get valid emails
GET /api/verify-email?action=list&status=valid&limit=100

# Get risky emails
GET /api/verify-email?action=list&status=risky&limit=50

# Get multiple statuses
GET /api/verify-email?action=list&status=valid,risky&limit=200
```

**Response:**
```json
{
  "success": true,
  "emails": [
    "verified1@example.com",
    "verified2@example.com"
  ],
  "count": 2
}
```

## Programmatic Usage

### Import the module
```typescript
import {
  verifyEmailWithCache,
  verifyEmailsBulk,
  getVerifiedEmailsByStatus,
  getVerificationStats,
  saveVerificationResult,
  getCachedVerification
} from '@/lib/emailVerification';
```

### Verify a single email
```typescript
const result = await verifyEmailWithCache(
  'user@example.com',
  'your-api-key'
);

console.log(result);
// {
//   email: 'user@example.com',
//   status: 'valid',
//   fromCache: false,
//   data: { ... }
// }
```

### Verify multiple emails
```typescript
const { results, stats } = await verifyEmailsBulk(
  ['user1@example.com', 'user2@example.com'],
  'your-api-key'
);

console.log(stats);
// {
//   total: 2,
//   valid: 1,
//   risky: 1,
//   invalid: 0,
//   unknown: 0,
//   fromCache: 1,
//   newlyVerified: 1
// }
```

### Get cached emails for reuse
```typescript
// Get 100 valid emails from cache
const validEmails = await getVerifiedEmailsByStatus('valid', 100);

// Get risky emails
const riskyEmails = await getVerifiedEmailsByStatus('risky', 50);

// Get multiple statuses
const emails = await getVerifiedEmailsByStatus(['valid', 'risky'], 200);
```

### Get verification statistics
```typescript
const stats = await getVerificationStats();
console.log(stats);
// {
//   total: 1500,
//   valid: 800,
//   risky: 300,
//   invalid: 350,
//   unknown: 50
// }
```

## Status Types

- **valid**: Email is verified and deliverable
- **risky**: Email might be valid but has risks (catch-all, role-based, etc.)
- **invalid**: Email is not valid or undeliverable
- **unknown**: Verification could not be completed (no API key, API error, etc.)

## API Configuration

The system uses EmailListVerify API by default. To use it:

1. Sign up at https://www.emaillistverify.com/
2. Get your API secret key
3. Pass it as `apiKey` parameter to verification functions

**Without an API key**, the system will still cache emails with "unknown" status for tracking purposes.

## Benefits

1. **Cost Savings**: Reuse verified emails instead of re-verifying
2. **Speed**: Instant results for cached emails
3. **Analytics**: Track verification counts and patterns
4. **Flexibility**: Support for multiple email verification providers
5. **Bulk Processing**: Verify thousands of emails efficiently

## Admin Dashboard Integration

The verification stats are automatically included in the admin dashboard:

- Total verified emails
- Valid emails count
- Risky emails count
- Full verification statistics

## Maintenance

### Clear old verification cache (optional)
```typescript
import { clearOldVerifications } from '@/lib/emailVerification';

// Clear verifications older than 90 days
const deletedCount = await clearOldVerifications(90);
console.log(`Deleted ${deletedCount} old verifications`);
```

## Example Integration with Email Generator

```typescript
// Generate emails
const generatedEmails = await generateEmails({
  count: 1000,
  // ... other params
});

// Verify them with caching
const { results, stats } = await verifyEmailsBulk(
  generatedEmails,
  process.env.EMAIL_VERIFY_API_KEY
);

// Filter for valid emails only
const validEmails = results
  .filter(r => r.status === 'valid')
  .map(r => r.email);

// Save or use valid emails
console.log(`Generated ${generatedEmails.length} emails`);
console.log(`Valid: ${validEmails.length}`);
console.log(`From cache: ${stats.fromCache}`);
console.log(`Newly verified: ${stats.newlyVerified}`);
```

## Next Steps

1. Set up your email verification API key
2. Test with a small batch of emails
3. Monitor verification stats in admin dashboard
4. Build automation to reuse valid/risky emails
5. Implement periodic cache cleanup if needed
