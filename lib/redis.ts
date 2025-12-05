/**
 * Redis Connection
 * Singleton Redis client for BullMQ
 */

import Redis from 'ioredis';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  // Support multiple Redis URL formats (Railway, Upstash, etc.)
  const redisUrl = process.env.REDIS_URL || 
                   process.env.REDIS_PRIVATE_URL || 
                   process.env.REDIS_PUBLIC_URL ||
                   process.env.REDISURL;
  
  if (redisUrl) {
    console.log('🔗 Connecting to Redis via URL...');
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false, // Connect immediately
      retryStrategy: (times) => {
        // Exponential backoff: 50ms, 100ms, 200ms...max 3s
        const delay = Math.min(times * 50, 3000);
        console.log(`🔄 Redis retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
    });
  } else {
    // Use individual connection parameters
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379');
    console.log(`🔗 Connecting to Redis at ${host}:${port}...`);
    
    redisClient = new Redis({
      host,
      port,
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false, // Connect immediately
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 3000);
        console.log(`🔄 Redis retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
    });
  }

  redisClient.on('error', (err) => {
    console.error('❌ Redis connection error:', err);
  });

  redisClient.on('connect', () => {
    console.log('✅ Redis connected');
  });

  redisClient.on('ready', () => {
    console.log('✅ Redis ready');
  });

  redisClient.on('reconnecting', () => {
    console.log('🔄 Redis reconnecting...');
  });

  redisClient.on('close', () => {
    console.warn('⚠️  Redis connection closed');
  });

  return redisClient;
}

export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

