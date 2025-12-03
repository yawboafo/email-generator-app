# Verified Email Generation Feature

## Overview

The **Generate Verified Emails Only** feature is a premium functionality that automatically generates and verifies email addresses until the exact number of valid, deliverable emails is collected. This ensures that every email returned is ready to use without manual verification.

## How It Works

### Workflow

```
1. User specifies target number of valid emails (e.g., 100)
2. System generates emails in configurable batches (default: 50)
3. Each generated email is immediately verified using Mails.so API
4. Only emails with "valid" status are kept
5. Process continues until target count is reached
6. Final list contains only verified, deliverable emails
```

### Key Features

- **Automatic Verification**: Every generated email is verified before being added to results
- **Real-time Progress Tracking**: Live updates showing:
  - Total emails generated
  - Total emails verified
  - Valid emails collected
  - Invalid, risky, and unknown counts
  - Progress percentage
  - Elapsed time
- **Smart Batching**: Generates emails in batches to optimize performance
- **Guaranteed Results**: Returns exactly the number of valid emails requested
- **Cost Efficient**: Uses cached verification results to minimize API calls

## API Endpoint

### POST `/api/generate-verified-emails`

Generates and verifies emails until the target number of valid emails is reached.

#### Request Body

```typescript
{
  targetCount: number;        // Required: Number of valid emails to collect (1-1000)
  batchSize?: number;         // Optional: Emails per batch (default: 50)
  maxAttempts?: number;       // Optional: Max total emails before giving up (default: targetCount * 10)
  
  // Standard generation parameters
  providers: string[];        // Email domains to use
  country: string;           // Country code for name patterns
  ageRange: string;          // Age range for generation patterns
  gender: string;            // Gender for name selection
  interests?: string[];      // Optional interests for nickname generation
  pattern: string;           // Name pattern to use
  includeNumbers: boolean;   // Include random numbers
  numberRange: [number, number]; // Number range if included
  allowedCharacters: {       // Character restrictions
    letters: boolean;
    numbers: boolean;
    underscore: boolean;
    dot: boolean;
  };
}
```

#### Response

```typescript
{
  success: boolean;
  emails: string[];          // Array of verified valid emails
  progress: {
    totalGenerated: number;  // Total emails generated
    totalVerified: number;   // Total emails verified
    validCount: number;      // Valid emails found
    invalidCount: number;    // Invalid emails found
    riskyCount: number;      // Risky emails found
    unknownCount: number;    // Unknown status emails
  };
  meta: {
    targetCount: number;     // Requested number
    actualCount: number;     // Actual valid emails returned
    batchesProcessed: number; // Number of batches processed
    timeElapsed: number;     // Time in milliseconds
  };
  error?: string;            // Error message if applicable
}
```

#### Rate Limits

- **20 requests per hour** (stricter than standard generation)
- Individual email verification follows standard verification rate limits

## UI Component

### VerifiedEmailGenerator Component

Located at: `components/VerifiedEmailGenerator.tsx`

#### Features

1. **Target Count Input**: Specify exact number of valid emails needed (1-1000)
2. **Batch Size Configuration**: Control generation batch size (10-200)
3. **Real-time Progress Display**:
   - Animated progress bar
   - Live statistics grid showing all counts
   - Elapsed time counter
   - Status breakdown with color coding
4. **Standard Generation Options**: All standard email generation parameters
5. **Premium UI Design**: Green gradient theme to distinguish from standard generation

#### Usage in Main App

The component is integrated into the main page as a third generator mode:

```tsx
// In app/page.tsx
<VerifiedEmailGenerator 
  onGenerate={handleGenerate} 
  isLoading={isLoading}
  setIsLoading={setIsLoading}
/>
```

Access via the "Verified Only" button in the generator mode selector.

## Technical Implementation

### Core Function: `generateVerifiedEmails`

Located in: `app/api/generate-verified-emails/route.ts`

```typescript
async function generateVerifiedEmails(
  params: VerifiedEmailGenerationRequest,
  onProgress?: (progress: any) => void
): Promise<VerifiedEmailGenerationResponse>
```

#### Algorithm

1. Initialize counters and result array
2. While valid emails < target count AND total generated < max attempts:
   - Calculate how many more emails needed
   - Generate batch (3x remaining to account for ~30% valid rate)
   - Verify each email in batch
   - Add valid emails to results
   - Update progress counters
   - Report progress every 10 verifications
   - Add 500ms delay between batches to avoid API overload
3. Return results with full statistics

### Verification Integration

Uses existing `emailVerification.ts` functions:
- `verifyEmailWithCache()`: Checks cache first, then verifies with API
- Automatically caches valid and risky emails for reuse
- Skips verification for already cached valid emails

### Performance Optimizations

1. **Adaptive Batch Sizing**: Generates 3x remaining emails to minimize iterations
2. **Progress Batching**: Reports progress every 10 verifications (not every email)
3. **Rate Limiting**: 500ms delay between batches to respect API limits
4. **Cache Utilization**: Reuses cached verification results
5. **Safety Limits**: Maximum attempts prevent infinite loops

## Usage Examples

### Example 1: Basic Usage

```typescript
// Generate 100 verified emails
const response = await fetch('/api/generate-verified-emails', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    targetCount: 100,
    providers: ['gmail.com', 'yahoo.com'],
    country: 'US',
    ageRange: '26-35',
    gender: 'any',
    pattern: 'firstname.lastname',
    includeNumbers: true,
    numberRange: [1, 999],
    allowedCharacters: {
      letters: true,
      numbers: true,
      underscore: false,
      dot: true
    }
  })
});

const data = await response.json();
console.log(`Generated ${data.emails.length} valid emails`);
console.log(`Verification stats:`, data.progress);
```

### Example 2: High-Performance Batch

```typescript
// Generate 500 emails with larger batches for speed
const response = await fetch('/api/generate-verified-emails', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    targetCount: 500,
    batchSize: 150,  // Larger batches = faster but more API calls
    providers: ['gmail.com', 'outlook.com', 'yahoo.com'],
    country: 'GB',
    ageRange: '18-25',
    gender: 'male',
    pattern: 'firstnamelastname',
    includeNumbers: true,
    numberRange: [10, 99],
    allowedCharacters: {
      letters: true,
      numbers: true,
      underscore: false,
      dot: false
    }
  })
});
```

## Best Practices

### 1. Choose Appropriate Target Counts
- Start with smaller numbers (10-50) for testing
- Use 100-500 for typical production needs
- Maximum 1000 per request to maintain performance

### 2. Optimize Batch Size
- **Smaller batches (10-30)**: Better for slow verification APIs
- **Medium batches (50-100)**: Balanced performance (recommended)
- **Large batches (100-200)**: Faster but uses more API credits

### 3. Select Optimal Parameters
- Use multiple providers to increase diversity
- Choose appropriate country for target audience
- Select patterns that match your use case
- Consider allowing numbers to increase uniqueness

### 4. Monitor Progress
- Watch the progress display for insights into verification rates
- If invalid count is very high, adjust generation parameters
- Note elapsed time to estimate completion for larger batches

### 5. Handle Errors Gracefully
- Always check `success` field in response
- Review `error` field if target not reached
- Consider retry logic with adjusted parameters

## Troubleshooting

### Issue: Slow Generation

**Possible Causes:**
- Large target count
- Small batch size
- Slow verification API
- High invalid rate

**Solutions:**
- Increase batch size (50-150)
- Reduce target count for initial testing
- Check verification API status
- Adjust generation parameters for higher valid rate

### Issue: High Invalid Rate

**Possible Causes:**
- Poor provider selection
- Overly restrictive patterns
- Country/pattern mismatch

**Solutions:**
- Use well-known providers (gmail.com, yahoo.com, outlook.com)
- Try simpler patterns (firstname.lastname, firstnamelastname)
- Ensure country has good name data
- Allow numbers for more variety

### Issue: Target Not Reached

**Possible Causes:**
- Hit maxAttempts limit
- Verification API errors
- Rate limiting

**Solutions:**
- Increase maxAttempts parameter
- Check verification API credentials
- Reduce request frequency
- Try again after rate limit reset

## Performance Metrics

### Typical Performance

- **Valid Rate**: ~30-50% (varies by parameters)
- **Speed**: ~10-20 emails/second (depends on verification API)
- **Time for 100 valid emails**: 1-3 minutes
- **Time for 500 valid emails**: 5-15 minutes

### Resource Usage

- **API Calls**: ~3x target count (due to invalid emails)
- **Memory**: Minimal (stores only valid emails)
- **Network**: Moderate (batch processing reduces requests)

## Future Enhancements

1. **Streaming Progress**: WebSocket support for real-time updates
2. **Custom Verification Providers**: Support for multiple verification APIs
3. **Advanced Filtering**: Additional criteria beyond "valid" status
4. **Batch Export**: Direct export to CSV/JSON
5. **Historical Analytics**: Track generation success rates over time
6. **Smart Parameter Suggestions**: AI-powered parameter recommendations

## Security Considerations

1. **Rate Limiting**: Strict limits prevent abuse
2. **API Key Protection**: Verification keys stored securely
3. **Input Validation**: All parameters validated before processing
4. **Result Limits**: Maximum 1000 emails per request
5. **Audit Logging**: All requests logged for monitoring

## Cost Analysis

### API Usage

For generating 100 valid emails:
- **Emails Generated**: ~300 (assuming 33% valid rate)
- **Verification Calls**: ~300 (minus cached results)
- **Cached Results**: Varies (reused on subsequent requests)

### Cost Optimization

1. **Use caching**: Previously verified emails don't cost API calls
2. **Optimize parameters**: Better parameters = higher valid rate = fewer calls
3. **Batch processing**: Process larger batches less frequently
4. **Monitor statistics**: Track invalid rates and adjust parameters

## Support

For issues or questions:
1. Check this documentation
2. Review API error messages
3. Check rate limit headers in responses
4. Verify API keys are configured correctly
5. Contact support with request details

---

**Version**: 1.0.0  
**Last Updated**: December 3, 2025  
**Maintained By**: Email Management Platform Team
