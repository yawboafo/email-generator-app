# Job Queue System Setup

This application uses **BullMQ** with **Redis** for reliable background job processing.

## Prerequisites

1. **Redis Server** - Required for the job queue
   - Local: Install Redis locally or use Docker
   - Production: Use a Redis service (Redis Cloud, AWS ElastiCache, etc.)

## Setup

### 1. Install Redis

**Local Development (macOS):**
```bash
brew install redis
brew services start redis
```

**Local Development (Docker):**
```bash
docker run -d -p 6379:6379 redis:latest
```

**Production:**
- Use a managed Redis service (Redis Cloud, AWS ElastiCache, etc.)
- Set `REDIS_URL` environment variable

### 2. Environment Variables

Add to your `.env` file:

```env
# Redis Configuration
REDIS_URL=redis://localhost:6379
# OR use individual settings:
# REDIS_HOST=localhost
# REDIS_PORT=6379
# REDIS_PASSWORD=your-password-if-needed

# Optional: Auto-start workers on server startup
AUTO_START_WORKERS=true

# Optional: Number of concurrent jobs to process
JOB_CONCURRENCY=3
```

### 3. Start Workers

Workers process jobs from the queue. You have two options:

**Option A: Auto-start (Development)**
- Set `AUTO_START_WORKERS=true` in `.env`
- Workers start automatically when the server starts

**Option B: Manual Start (Recommended for Production)**
- Call `POST /api/jobs/worker` to start workers
- Or create a separate worker process (see below)

**Check Worker Status:**
```bash
GET /api/jobs/worker
```

## Architecture

### Components

1. **Queue** (`lib/queue.ts`)
   - Manages job queue using BullMQ
   - Handles job addition, statistics, and removal

2. **Workers** (`lib/workers/queueWorker.ts`)
   - Processes jobs from the queue
   - Routes to appropriate worker based on job type
   - Handles retries and failures

3. **Worker Functions** (`lib/workers/`)
   - `generateEmailsWorker.ts` - Email generation
   - `verifyEmailsWorker.ts` - Email verification
   - `scrapeEmailsWorker.ts` - Email scraping

### Job Flow

1. **Job Creation**: API endpoint creates job in database
2. **Queue Addition**: Job added to BullMQ queue
3. **Worker Processing**: Worker picks up job and executes
4. **Progress Updates**: Worker updates database progress
5. **SSE Streaming**: Client receives real-time updates via SSE

## API Endpoints

### Start/Stop Workers
```bash
POST /api/jobs/worker
Body: { "action": "stop" }  # Optional, omit to start

GET /api/jobs/worker  # Get worker status
```

### Job Management
- `POST /api/generate-emails-job` - Create email generation job
- `POST /api/verify-emails-job` - Create verification job
- `POST /api/scrape-emails-job` - Create scraping job
- `GET /api/jobs/[id]/status` - Get job status
- `GET /api/jobs/[id]/stream` - Stream job progress (SSE)
- `POST /api/jobs/[id]/cancel` - Cancel a job

## Production Deployment

### Option 1: Separate Worker Process

Create a separate worker process that runs independently:

```typescript
// scripts/worker.ts
import { startWorkers } from '../lib/workers/queueWorker';

startWorkers();

// Keep process alive
process.on('SIGTERM', async () => {
  await stopWorkers();
  process.exit(0);
});
```

Run with:
```bash
tsx scripts/worker.ts
```

### Option 2: API Route (Simple)

Use the `/api/jobs/worker` endpoint to start workers. This works but workers will restart if the server restarts.

### Option 3: PM2 (Recommended)

Use PM2 to run workers as a separate process:

```bash
npm install -g pm2

# Create ecosystem.config.js
pm2 start scripts/worker.ts --name email-worker
```

## Monitoring

### Queue Statistics
```bash
GET /api/jobs/worker
```

Returns:
```json
{
  "workers": {
    "activeWorkers": 1,
    "isRunning": true
  },
  "queue": {
    "waiting": 5,
    "active": 2,
    "completed": 100,
    "failed": 3,
    "delayed": 0,
    "total": 110
  }
}
```

### Redis CLI
```bash
redis-cli
> KEYS *
> LLEN bull:email-jobs:waiting
> LLEN bull:email-jobs:active
```

## Troubleshooting

### Workers Not Processing Jobs

1. **Check Redis Connection**
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

2. **Check Workers Are Running**
   ```bash
   GET /api/jobs/worker
   ```

3. **Check Queue Has Jobs**
   ```bash
   GET /api/jobs/worker
   # Check "queue.waiting" > 0
   ```

4. **Check Logs**
   - Look for "Worker started" message
   - Check for Redis connection errors
   - Check for job processing errors

### Jobs Stuck in "Pending"

- Workers might not be started
- Redis connection issue
- Worker crashed (check logs)

### Jobs Failing

- Check job error messages in database
- Check worker logs for exceptions
- Verify job metadata is correct

## Benefits of Queue System

✅ **Reliability**: Jobs persist even if server restarts
✅ **Scalability**: Multiple workers can process jobs concurrently
✅ **Retry Logic**: Automatic retries with exponential backoff
✅ **Monitoring**: Queue statistics and job tracking
✅ **Priority**: Can prioritize certain job types
✅ **Rate Limiting**: Built-in rate limiting support

