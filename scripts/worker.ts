/**
 * Standalone Worker Process
 * Run this as a separate process to handle background jobs
 * 
 * Usage: tsx scripts/worker.ts
 * Or: npm run worker
 */

import { startWorkers, stopWorkers } from '../lib/workers/queueWorker';

console.log('Starting email job workers...');

// Start workers
startWorkers();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down workers...');
  await stopWorkers();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down workers...');
  await stopWorkers();
  process.exit(0);
});

// Keep process alive
console.log('Workers started. Press Ctrl+C to stop.');

