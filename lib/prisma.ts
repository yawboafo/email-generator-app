import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Singleton pattern for Prisma Client to avoid multiple instances
// in development due to hot reloading

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: pg.Pool | undefined;
};

// Create connection pool singleton
if (!globalForPrisma.pool) {
  globalForPrisma.pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL,
    max: 3, // Increase max connections for worker concurrency
    idleTimeoutMillis: 10000, // Shorter idle timeout
    connectionTimeoutMillis: 10000, // Increased connection timeout
    query_timeout: 30000, // 30 second query timeout for large queries
    statement_timeout: 30000, // 30 second statement timeout
    keepAlive: true,
    keepAliveInitialDelayMillis: 0,
    ssl: false, // Disable SSL for Railway proxy
  });
  
  // Handle pool errors
  globalForPrisma.pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
  });
  
  // Log successful connections
  globalForPrisma.pool.on('connect', () => {
    console.log('✓ Database connection established');
  });
}

const pool = globalForPrisma.pool;
const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ 
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
