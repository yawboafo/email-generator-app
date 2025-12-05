#!/usr/bin/env node

/**
 * Worker Monitor
 * Monitors worker health and restarts if needed
 * Can run as a separate process or cron job
 */

const http = require('http');

const HEALTH_CHECK_URL = 'http://localhost:3000/api/workers/health';
const CHECK_INTERVAL_MS = 30000; // Check every 30 seconds
const RESTART_API_URL = 'http://localhost:3000/api/workers/start';

let consecutiveFailures = 0;
const MAX_FAILURES_BEFORE_ALERT = 3;

function checkHealth() {
  return new Promise((resolve, reject) => {
    http.get(HEALTH_CHECK_URL, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          // Check if we got HTML instead of JSON (404 or route not found)
          if (data.startsWith('<!DOCTYPE') || data.startsWith('<html')) {
            reject(new Error('Health endpoint returned HTML instead of JSON. Route may not be built. Run: npm run build'));
            return;
          }
          
          const health = JSON.parse(data);
          resolve({
            healthy: health.healthy,
            status: res.statusCode,
            data: health,
          });
        } catch (error) {
          reject(new Error(`Failed to parse health response: ${error.message}. Response: ${data.substring(0, 100)}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Failed to connect to health endpoint: ${error.message}. Is the server running?`));
    });
  });
}

function attemptRestart() {
  return new Promise((resolve, reject) => {
    const req = http.request(RESTART_API_URL, {
      method: 'POST',
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function monitor() {
  console.log(`[${new Date().toISOString()}] Checking worker health...`);
  
  try {
    const health = await checkHealth();
    
    if (health.healthy) {
      console.log('✅ Workers healthy');
      consecutiveFailures = 0;
    } else {
      consecutiveFailures++;
      console.warn(`⚠️  Workers unhealthy (${consecutiveFailures}/${MAX_FAILURES_BEFORE_ALERT})`);
      console.warn('Details:', JSON.stringify(health.data, null, 2));
      
      if (consecutiveFailures >= MAX_FAILURES_BEFORE_ALERT) {
        console.log('🔄 Attempting to restart workers...');
        
        try {
          const result = await attemptRestart();
          console.log('✅ Worker restart result:', result);
          consecutiveFailures = 0;
        } catch (restartError) {
          console.error('❌ Failed to restart workers:', restartError);
          console.error('🚨 ALERT: Manual intervention may be required!');
        }
      }
    }
  } catch (error) {
    consecutiveFailures++;
    console.error(`❌ Health check failed (${consecutiveFailures}/${MAX_FAILURES_BEFORE_ALERT}):`, error.message);
    
    if (consecutiveFailures >= MAX_FAILURES_BEFORE_ALERT) {
      console.error('🚨 ALERT: Server may be down! Manual intervention required.');
    }
  }
}

// Run initial check
monitor();

// Schedule periodic checks
setInterval(monitor, CHECK_INTERVAL_MS);

console.log(`🔍 Worker monitor started. Checking health every ${CHECK_INTERVAL_MS / 1000} seconds.`);
console.log('Press Ctrl+C to stop.');

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Stopping worker monitor...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Stopping worker monitor...');
  process.exit(0);
});
