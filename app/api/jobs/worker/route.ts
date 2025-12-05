/**
 * Job Worker API
 * POST /api/jobs/worker - Start workers
 * GET /api/jobs/worker - Get worker status
 */

import { NextRequest, NextResponse } from 'next/server';
import { startWorkers, stopWorkers, getWorkerStatus } from '@/lib/workers/queueWorker';
import { getQueueStats } from '@/lib/queue';

let workersStarted = false;

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json().catch(() => ({}));
    
    if (action === 'stop') {
      await stopWorkers();
      workersStarted = false;
      return NextResponse.json({
        success: true,
        message: 'Workers stopped',
      });
    }

    // Start workers
    if (!workersStarted) {
      startWorkers();
      workersStarted = true;
    }

    return NextResponse.json({
      success: true,
      message: 'Workers started',
      status: getWorkerStatus(),
    });
  } catch (error) {
    console.error('Error managing workers:', error);
    return NextResponse.json(
      { error: 'Failed to manage workers' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const [workerStatus, queueStats] = await Promise.all([
      Promise.resolve(getWorkerStatus()),
      getQueueStats(),
    ]);

    return NextResponse.json({
      success: true,
      workers: workerStatus,
      queue: queueStats,
      workersStarted,
    });
  } catch (error) {
    console.error('Error getting worker status:', error);
    return NextResponse.json(
      { error: 'Failed to get worker status' },
      { status: 500 }
    );
  }
}

