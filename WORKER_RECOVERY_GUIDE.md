# Worker Crash Recovery & Monitoring Guide

## Overview

Your email generation system now has **automatic crash recovery** for workers. Workers will automatically restart if they crash, and you have monitoring tools to track their health.

## What's Been Added

### 1. **Automatic Worker Recovery** ✅
- Workers automatically restart up to 5 times if they crash
- 5-second delay between restart attempts
- Prevents infinite restart loops
- Logs all restart attempts

### 2. **Enhanced Error Handling** ✅
- Better Redis connection monitoring
- Stalled job detection and recovery
- Graceful worker shutdown handling
- Detailed error logging with emojis for visibility

### 3. **Health Check API** ✅
**Endpoint**: `GET /api/workers/health`

Check if workers are running and healthy:
```bash
curl http://localhost:3000/api/workers/health
```

Response:
```json
{
  "healthy": true,
  "timestamp": "2025-12-05T08:00:00.000Z",
  "workers": {
    "running": true,
    "active": 1
  },
  "redis": {
    "connected": true,
    "error": null
  }
}
```

### 4. **Worker Monitor Script** ✅
**Location**: `scripts/monitor-workers.js`

Standalone monitoring script that:
- Checks worker health every 30 seconds
- Automatically restarts workers if unhealthy 3 times in a row
- Alerts when manual intervention is needed
- Can run as a background process

## Usage

### Quick Health Check
```bash
npm run worker:health
```

### Start Monitoring (Recommended for Production)
```bash
npm run worker:monitor
```

This will:
- Check health every 30 seconds
- Automatically restart failed workers
- Log all status changes
- Run until you press Ctrl+C

### Manual Worker Control

**Start workers manually:**
```bash
curl -X POST http://localhost:3000/api/workers/start
```

**Check worker status:**
```bash
curl http://localhost:3000/api/workers/start
```

## What Happens When Workers Crash

### Scenario 1: Worker Process Crashes
1. Worker detects crash via `closed` event
2. Waits 5 seconds
3. Attempts automatic restart
4. Repeats up to 5 times
5. If all attempts fail, logs error requiring manual restart

### Scenario 2: Redis Connection Lost
1. Redis client automatically attempts reconnection
2. Worker detects connection issues
3. Logs reconnection attempts
4. Once Redis reconnects, workers resume processing

### Scenario 3: Job Crashes
1. Job-specific error is caught
2. Job marked as `failed` in database
3. Error logged with details
4. Worker continues processing other jobs
5. Failed job can be retried manually

## Monitoring Best Practices

### Development
Just run `npm run dev` - workers auto-start with the server.

### Production

**Option 1: Use the monitor script** (Recommended)
```bash
# In a separate terminal or background
npm run worker:monitor &

# Check it's running
ps aux | grep monitor-workers
```

**Option 2: Set up a cron job**
```bash
# Check every 5 minutes
*/5 * * * * cd /path/to/app && npm run worker:health
```

**Option 3: Use a process manager like PM2**
```bash
# Install PM2
npm install -g pm2

# Start your app
pm2 start npm --name "email-app" -- run start

# Start monitor
pm2 start npm --name "worker-monitor" -- run worker:monitor

# Save configuration
pm2 save

# Auto-start on reboot
pm2 startup
```

## When Manual Intervention IS Required

You'll need to restart the server manually if:

1. **Max restart attempts exceeded** (5 failures in a row)
   - Check logs for root cause
   - Fix the underlying issue
   - Restart: `npm run dev` or restart production server

2. **Redis server is completely down**
   - Start Redis: `redis-server` or check your Redis hosting
   - Workers will auto-reconnect once Redis is back

3. **Server crashes completely** (not just workers)
   - Check logs in `.next/`
   - Fix any code errors
   - Restart server

4. **Database connection fails**
   - Check DATABASE_URL in `.env`
   - Verify database is accessible
   - Check database server status

## Troubleshooting

### Workers won't start
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# Check if port 3000 is available
lsof -i :3000

# Check environment variables
echo $DATABASE_URL
echo $REDIS_URL
```

### Workers keep restarting
```bash
# Check Redis connection
curl http://localhost:3000/api/workers/health

# Check job queue for stuck jobs
# (You can add a queue inspection API if needed)

# Check server logs
tail -f .next/trace
```

### Jobs stuck at 0% progress
1. Check worker status: `npm run worker:health`
2. If workers are down, they'll auto-restart
3. If jobs are stuck after worker restart, check job ID in database
4. You may need to cancel and restart the job

## Environment Variables

Make sure these are set:
```bash
# Required
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."  # or REDIS_HOST, REDIS_PORT, REDIS_PASSWORD

# Optional
AUTO_START_WORKERS="true"  # Default: true in development
JOB_CONCURRENCY="3"        # Number of concurrent jobs per worker
NODE_ENV="development"     # or "production"
```

## Monitoring Dashboard (Optional Future Enhancement)

Consider adding:
- Real-time worker status in admin UI
- Job queue metrics (pending, active, completed, failed)
- Worker uptime tracking
- Auto-restart history
- Email/Slack alerts for critical failures

## Common Issues

### Monitor shows "Unexpected token '<', \"<!DOCTYPE\"... is not valid JSON"

This means the health endpoint returned HTML instead of JSON (404 error).

**Solution**: Rebuild the app
```bash
npm run build
npm start
```

Or use development mode:
```bash
npm run dev
```

### Health check returns 503 (Service Unavailable)

This is normal during startup. Wait a few seconds for workers and Redis to connect.

If it persists:
```bash
# Check Redis
redis-cli ping

# Check worker status
curl http://localhost:3000/api/workers/start
```

## Summary

**Do you need to restart manually?** 
- ❌ **NO** - for most worker crashes (auto-recovery handles it)
- ❌ **NO** - for Redis reconnections (automatic)
- ❌ **NO** - for individual job failures (jobs are isolated)
- ✅ **YES** - only if worker fails 5+ times in a row
- ✅ **YES** - if the entire server crashes
- ✅ **YES** - if the database is unreachable

**Recommendation**: Run the monitor script (`npm run worker:monitor`) in production to catch issues before they become problems.
