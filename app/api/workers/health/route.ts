/**
 * Worker Health Check API
 * Check if workers are running and healthy
 */

import { NextResponse } from 'next/server';
import { getWorkerStatus } from '@/lib/workers/queueWorker';
import { getRedisClient } from '@/lib/redis';

export async function GET() {
  try {
    const workerStatus = getWorkerStatus();
    
    // Check Redis connection with timeout
    let redisHealthy = false;
    let redisError = null;
    let redisStatus = 'unknown';
    
    try {
      const redis = getRedisClient();
      redisStatus = redis.status;
      
      // Only ping if redis is ready
      if (redis.status === 'ready' || redis.status === 'connect') {
        const pingPromise = redis.ping();
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout after 2s')), 2000)
        );
        await Promise.race([pingPromise, timeoutPromise]);
        redisHealthy = true;
      } else if (redis.status === 'connecting') {
        redisError = 'Redis is connecting...';
      } else {
        redisError = `Redis status: ${redis.status}`;
      }
    } catch (error) {
      redisError = error instanceof Error ? error.message : 'Redis check failed';
    }

    const isHealthy = workerStatus.isRunning && redisHealthy;

    return NextResponse.json({
      healthy: isHealthy,
      timestamp: new Date().toISOString(),
      workers: {
        running: workerStatus.isRunning,
        active: workerStatus.activeWorkers,
      },
      redis: {
        connected: redisHealthy,
        status: redisStatus,
        error: redisError,
      },
    }, {
      status: isHealthy ? 200 : 503,
    });
  } catch (error) {
    console.error('❌ Health check error:', error);
    return NextResponse.json(
      { 
        healthy: false,
        error: error instanceof Error ? error.message : 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
