/**
 * Job Stream API
 * GET /api/jobs/[id]/stream - Stream job progress updates via SSE
 */

import { NextRequest } from 'next/server';
import { getJob } from '@/lib/jobManager';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;

  if (!jobId) {
    return new Response('Job ID is required', { status: 400 });
  }

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial connection message
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'connected', jobId })}\n\n`)
        );

        let lastProgress = -1;
        let isComplete = false;

        // Poll for job updates
        const interval = setInterval(async () => {
          try {
            const job = await getJob(jobId);

            if (!job) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Job not found' })}\n\n`)
              );
              clearInterval(interval);
              controller.close();
              return;
            }

            // Only send update if progress changed or status changed
            if (job.progress !== lastProgress || isComplete !== (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled')) {
              lastProgress = job.progress;
              isComplete = job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled';

              const update = {
                type: 'progress',
                jobId: job.id,
                status: job.status,
                progress: job.progress,
                metadata: job.metadata,
                resultData: job.resultData,
                errorMessage: job.errorMessage,
                updatedAt: job.updatedAt,
              };

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(update)}\n\n`)
              );

              // If job is complete, close the stream
              if (isComplete) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'complete', jobId: job.id })}\n\n`)
                );
                clearInterval(interval);
                controller.close();
              }
            }
          } catch (error) {
            console.error('Error streaming job progress:', error);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Stream error' })}\n\n`)
            );
            clearInterval(interval);
            controller.close();
          }
        }, 1000); // Poll every second

        // Cleanup on connection close
        request.signal.addEventListener('abort', () => {
          clearInterval(interval);
          controller.close();
        });
      } catch (error) {
        console.error('Error starting stream:', error);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Failed to start stream' })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering in Nginx
    },
  });
}
