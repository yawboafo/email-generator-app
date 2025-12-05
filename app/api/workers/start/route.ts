/**
 * Worker Startup API
 * Manually start workers if they're not running
 */

import { NextResponse } from 'next/server';
import { startWorkers, getWorkerStatus } from '@/lib/workers/queueWorker';

export async function POST() {
  try {
    const status = getWorkerStatus();
    
    if (status.isRunning) {
      return NextResponse.json({
        success: true,
        message: 'Workers already running',
        status,
      });
    }

    startWorkers();

    return NextResponse.json({
      success: true,
      message: 'Workers started successfully',
      status: getWorkerStatus(),
    });
  } catch (error) {
    console.error('Error starting workers:', error);
    return NextResponse.json(
      { error: 'Failed to start workers' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const status = getWorkerStatus();
    return NextResponse.json({ status });
  } catch (error) {
    console.error('Error getting worker status:', error);
    return NextResponse.json(
      { error: 'Failed to get worker status' },
      { status: 500 }
    );
  }
}
