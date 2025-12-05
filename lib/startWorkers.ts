/**
 * Start Workers on Server Startup
 * This file can be imported to automatically start workers when the server starts
 */

import { startWorkers, getWorkerStatus } from './workers/queueWorker';

// Auto-start workers in development or when explicitly enabled
if (process.env.AUTO_START_WORKERS === 'true' || process.env.NODE_ENV === 'development') {
  // Only start if not already started (avoid multiple instances)
  if (typeof window === 'undefined') {
    // Server-side only - check if workers are already running
    const status = getWorkerStatus();
    if (!status.isRunning) {
      console.log('🚀 Starting BullMQ workers...');
      startWorkers();
      console.log('✅ Workers auto-started successfully');
    } else {
      console.log('✅ Workers already running');
    }
  }
}

