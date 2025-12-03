# Persistent Background Job System - Complete Implementation Guide

## 🎯 Overview

This email platform now features a **production-grade persistent background job system** that ensures:

- ✅ Jobs continue running even after page refresh
- ✅ Jobs survive browser tab closure
- ✅ Jobs can be resumed days later
- ✅ Real-time progress updates via Server-Sent Events (SSE)
- ✅ Automatic email verification deduplication
- ✅ Checkpoint-based resumability
- ✅ Enterprise-ready reliability

## 📊 Architecture

### Database Schema

```prisma
model Job {
  id           String   @id @default(cuid())
  type         String   // Job type (generate-emails, verify-emails, etc.)
  status       String   // pending, running, completed, failed, cancelled
  progress     Int      @default(0) // 0-100
  resultData   Json?    // Final results
  metadata     Json?    // Job parameters and state
  errorMessage String?  // Error details if failed
  userId       String?  // Optional user tracking
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  completedAt  DateTime?
  
  @@index([type, status])
}
```

### Job Types

1. **generate-emails** - Pattern-based email generation
2. **generate-verified-emails** - Generate + verify in one job
3. **verify-emails** - Bulk email verification with deduplication
4. **scrape-emails** - Web scraping from domains
5. **find-emails** - Real email discovery
6. **ai-generate** - AI-powered generation
7. **send-emails** - Bulk email sending

## 🚀 API Endpoints

### Core Job Management

#### Create Job
```bash
POST /api/jobs
Content-Type: application/json

{
  "type": "generate-emails",
  "metadata": {
    "params": { /* job parameters */ }
  },
  "userId": "optional-user-id"
}

Response:
{
  "success": true,
  "jobId": "clx1234567890",
  "message": "Job created successfully"
}
```

#### Get Job Status
```bash
GET /api/jobs/{jobId}/status

Response:
{
  "success": true,
  "job": {
    "id": "clx1234567890",
    "type": "generate-emails",
    "status": "running",
    "progress": 45,
    "metadata": { /* job state */ },
    "resultData": null,
    "errorMessage": null,
    "createdAt": "2025-12-03T10:00:00Z",
    "updatedAt": "2025-12-03T10:05:00Z"
  }
}
```

#### Stream Job Progress (SSE)
```bash
GET /api/jobs/{jobId}/stream

# Server-Sent Events stream
data: {"type":"connected","jobId":"clx1234567890"}

data: {"type":"progress","jobId":"clx1234567890","status":"running","progress":45,"metadata":{...}}

data: {"type":"complete","jobId":"clx1234567890"}
```

#### Cancel Job
```bash
POST /api/jobs/{jobId}/cancel

Response:
{
  "success": true,
  "message": "Job cancelled successfully"
}
```

#### List Jobs
```bash
GET /api/jobs/list?type=verify-emails&status=running&limit=50

Response:
{
  "success": true,
  "jobs": [...],
  "count": 10
}
```

### Job-Specific Endpoints

#### Generate Emails (Job-Based)
```bash
POST /api/generate-emails-job
Content-Type: application/json

{
  "count": 10000,
  "providers": ["gmail.com", "outlook.com"],
  "country": "US",
  "ageRange": "18-65",
  "gender": "any",
  "pattern": "{firstname}.{lastname}"
}

Response:
{
  "success": true,
  "jobId": "clx1234567890",
  "streamUrl": "/api/jobs/clx1234567890/stream",
  "statusUrl": "/api/jobs/clx1234567890/status"
}
```

#### Verify Emails (Job-Based)
```bash
POST /api/verify-emails-job
Content-Type: application/json

{
  "emails": ["test@example.com", "user@gmail.com"],
  "service": "mailsso",
  "apiKey": "optional-api-key"
}

Response:
{
  "success": true,
  "jobId": "clx9876543210",
  "streamUrl": "/api/jobs/clx9876543210/stream"
}
```

#### Scrape Emails (Job-Based)
```bash
POST /api/scrape-emails-job
Content-Type: application/json

{
  "domains": ["example.com", "company.com"],
  "maxPagesPerDomain": 5
}

Response:
{
  "success": true,
  "jobId": "clxabc123456",
  "streamUrl": "/api/jobs/clxabc123456/stream"
}
```

## 💻 React Integration

### Using the `useJob` Hook

```typescript
import { useJob } from '@/hooks/useJob';

function MyComponent() {
  const {
    job,
    loading,
    error,
    isRunning,
    isCompleted,
    cancelJob,
  } = useJob(jobId, {
    persistKey: 'my-job', // Survives refresh
    onProgress: (job) => {
      console.log('Progress:', job.progress);
    },
    onComplete: (job) => {
      console.log('Done!', job.resultData);
    },
  });

  return (
    <div>
      {job && (
        <div>
          <div>Status: {job.status}</div>
          <div>Progress: {job.progress}%</div>
          
          {isRunning && (
            <button onClick={() => cancelJob(job.id)}>
              Cancel
            </button>
          )}
          
          {isCompleted && (
            <div>
              Results: {JSON.stringify(job.resultData)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### Creating a New Job

```typescript
import { useCreateJob } from '@/hooks/useJob';

function EmailGenerator() {
  const {
    createJob,
    creating,
    job,
    isRunning,
    isCompleted,
  } = useCreateJob('generate-emails', {
    persistKey: 'email-gen-job',
    onComplete: (job) => {
      alert(`Generated ${job.resultData.data.emails.length} emails!`);
    },
  });

  const handleGenerate = async () => {
    await createJob({
      count: 10000,
      providers: ['gmail.com'],
      country: 'US',
      pattern: '{firstname}.{lastname}',
    });
  };

  return (
    <div>
      <button onClick={handleGenerate} disabled={creating || isRunning}>
        {creating ? 'Starting...' : 'Generate'}
      </button>
      
      {job && (
        <div className="progress-bar">
          <div style={{ width: `${job.progress}%` }} />
        </div>
      )}
    </div>
  );
}
```

## 🔄 Resumability & Checkpoints

### How It Works

1. **Checkpoints** - Jobs save state every batch/iteration
2. **Metadata** - Contains `checkpoint` object with resume data
3. **Resume Logic** - Workers check for checkpoints on start
4. **Deduplication** - Processed items tracked in checkpoint

### Example Checkpoint Structure

```json
{
  "params": { "count": 10000, "country": "US" },
  "totalItems": 10000,
  "processedItems": 4500,
  "successCount": 4500,
  "partialResults": ["email1@gmail.com", "..."],
  "checkpoint": {
    "batchIndex": 4,
    "emailsGenerated": ["...array of 4500 emails..."]
  }
}
```

### Resume Example

```typescript
// If job was interrupted, it resumes from last checkpoint
const job = await getJobWithMetadata(jobId);

if (job.metadata.checkpoint) {
  // Resume from checkpoint
  const { batchIndex, emailsGenerated } = job.metadata.checkpoint;
  startIndex = batchIndex;
  existingResults = emailsGenerated;
}
```

## 🛡️ Email Verification Deduplication

### Smart Caching

The verification system **NEVER verifies the same email twice**:

```typescript
// Check cache first
for (const email of emails) {
  const cached = await getCachedVerification(email);
  if (cached) {
    results.push(cached);
    continue; // Skip verification
  }
  uncachedEmails.push(email);
}

// Only verify uncached emails
if (uncachedEmails.length > 0) {
  const newResults = await verifyEmailsBulk(uncachedEmails);
  // Results automatically saved to VerifiedEmail table
}
```

### Database Schema

```prisma
model VerifiedEmail {
  id                String   @id
  emailAddress      String   @unique
  status            String   // valid, risky, invalid, unknown
  verificationData  Json?
  lastVerifiedAt    DateTime @default(now())
  verificationCount Int      @default(1)
  createdAt         DateTime @default(now())
  updatedAt         DateTime
  
  @@index([emailAddress])
}
```

## 📱 Frontend Persistence

### LocalStorage Integration

Jobs are tracked in localStorage for seamless recovery:

```typescript
// Save job ID on creation
localStorage.setItem('email-gen-job', jobId);

// On page load, check for active job
useEffect(() => {
  const savedJobId = localStorage.getItem('email-gen-job');
  if (savedJobId) {
    // Resume tracking this job
    streamJob(savedJobId);
  }
}, []);

// Clear on completion
if (isCompleted) {
  localStorage.removeItem('email-gen-job');
}
```

### URL-Based Recovery

Add job ID to URL for shareable progress:

```typescript
// Update URL with job ID
const url = new URL(window.location.href);
url.searchParams.set('jobId', jobId);
window.history.replaceState({}, '', url);

// On mount, check URL
const urlParams = new URLSearchParams(window.location.search);
const jobId = urlParams.get('jobId');
if (jobId) {
  fetchJobStatus(jobId);
}
```

## 🔧 Worker Implementation

### Email Generation Worker

```typescript
// lib/workers/generateEmailsWorker.ts
export async function executeGenerateEmailsJob(jobId: string) {
  await updateJobStatus(jobId, 'running');
  
  const job = await getJobWithMetadata(jobId);
  const { params } = job.metadata;
  
  // Resume from checkpoint
  let startIndex = job.metadata.checkpoint?.batchIndex || 0;
  let results = job.metadata.checkpoint?.emailsGenerated || [];
  
  // Process in batches
  for (let i = startIndex; i < totalBatches; i++) {
    // Check if cancelled
    const current = await getJobWithMetadata(jobId);
    if (current.status === 'cancelled') return;
    
    // Generate batch
    const batchResults = await generateEmails(/*...*/);
    results.push(...batchResults);
    
    // Update progress
    await updateJobProgress(jobId, progress);
    
    // Save checkpoint
    await saveCheckpoint(jobId, {
      batchIndex: i + 1,
      emailsGenerated: results
    });
  }
  
  // Save final results
  await saveJobResult(jobId, { success: true, data: results });
}
```

## 🧪 Testing Scenarios

### Test 1: Refresh During Job
```bash
1. Start a job generating 10,000 emails
2. Wait for 30% progress
3. Refresh the page (F5)
4. ✅ Job continues, progress resumes from 30%
```

### Test 2: Close Tab and Return
```bash
1. Start email verification job (5,000 emails)
2. Close browser tab completely
3. Return hours later
4. Open same URL
5. ✅ Job completed, results available
```

### Test 3: Multi-Day Resume
```bash
1. Start scraping job (100 domains)
2. Let it run for 20 domains
3. Shut down computer
4. Return next day
5. Open app, check jobs list
6. ✅ Job shows progress, can view results
```

### Test 4: Deduplication
```bash
1. Verify 1,000 emails
2. Wait for completion
3. Verify same 1,000 emails again
4. ✅ Instant results from cache, 0 API calls
```

## 📊 Monitoring & Cleanup

### Get Job Statistics
```bash
GET /api/jobs/list?stats=true

Response:
{
  "success": true,
  "stats": {
    "total": 1250,
    "pending": 3,
    "running": 5,
    "completed": 1200,
    "failed": 40,
    "cancelled": 2
  }
}
```

### Cleanup Old Jobs
```typescript
import { cleanupOldJobs } from '@/lib/jobManager';

// Delete jobs older than 30 days
const deletedCount = await cleanupOldJobs(30);
console.log(`Cleaned up ${deletedCount} old jobs`);
```

## 🎓 Best Practices

### 1. Always Use Jobs for Long Operations
```typescript
// ❌ Bad - Synchronous, loses progress on refresh
POST /api/generate-emails (waits for completion)

// ✅ Good - Job-based, survives refresh
POST /api/generate-emails-job (returns immediately with jobId)
```

### 2. Save Checkpoints Frequently
```typescript
// Save every batch, not at the end
for (const batch of batches) {
  await processBatch(batch);
  await saveCheckpoint(jobId, { batchIndex, results });
}
```

### 3. Check for Cancellation
```typescript
// Always check if job was cancelled
const job = await getJobWithMetadata(jobId);
if (job.status === 'cancelled') {
  console.log('Job cancelled, stopping...');
  return;
}
```

### 4. Use Deduplication
```typescript
// Always check cache before processing
const cached = await getCachedVerification(email);
if (cached) return cached; // Instant result
```

### 5. Handle Errors Gracefully
```typescript
try {
  await processItem(item);
} catch (error) {
  // Don't fail entire job for one item
  failedCount++;
  continue;
}
```

## 🎉 Result

You now have a **production-ready persistent job system** that:

✅ Survives page refreshes
✅ Survives tab closures  
✅ Survives browser restarts
✅ Can be resumed days later
✅ Never loses progress
✅ Provides real-time updates
✅ Deduplicates automatically
✅ Handles failures gracefully
✅ Scales to enterprise workloads

## 🔗 Quick Links

- **Job Management API**: `/api/jobs/*`
- **Job Hook**: `hooks/useJob.ts`
- **Workers**: `lib/workers/`
- **Job Manager**: `lib/jobManager.ts`
- **Example Component**: `components/JobBasedEmailGenerator.tsx`
