import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateEmails } from '@/lib/emailGenerator';
import { verifyEmailsBulk, type VerificationService } from '@/lib/emailVerification';
import { getCurrentUser } from '@/lib/auth';

export const maxDuration = 300; // 5 minutes max

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      targetCount,
      country,
      ageRange,
      gender,
      pattern,
      includeNumbers,
      providers,
      verificationService = 'mailsso'
    } = body;

    // Validate inputs
    if (!targetCount || targetCount < 1 || targetCount > 10000) {
      return NextResponse.json(
        { error: 'Target count must be between 1 and 10,000' },
        { status: 400 }
      );
    }

    if (!providers || providers.length === 0) {
      return NextResponse.json(
        { error: 'At least one provider must be selected' },
        { status: 400 }
      );
    }

    // Create the job with userId
    const job = await prisma.job.create({
      data: {
        type: 'verified-email-generation',
        status: 'pending',
        progress: 0,
        userId: currentUser.userId,
        metadata: {
          targetCount,
          country,
          ageRange,
          gender,
          pattern,
          includeNumbers,
          providers,
          verificationService,
          generated: 0,
          verified: 0,
          valid: 0,
          cachedCount: 0
        },
        resultData: {
          data: {
            validEmails: [],
            totalGenerated: 0,
            cachedCount: 0
          }
        }
      }
    });

    // Start background processing
    processVerifiedEmailGenerationJob(job.id).catch(error => {
      console.error('Error in background job:', error);
      prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorMessage: error.message || 'Unknown error occurred'
        }
      }).catch(console.error);
    });

    return NextResponse.json({ jobId: job.id });
  } catch (error: any) {
    console.error('Error creating verified email generation job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create job' },
      { status: 500 }
    );
  }
}

async function processVerifiedEmailGenerationJob(jobId: string) {
  try {
    // Update to running
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'running', progress: 0 }
    });

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Job not found');

    const {
      targetCount,
      country,
      ageRange,
      gender,
      pattern,
      includeNumbers,
      providers,
      verificationService
    } = job.metadata as any;

    const validEmails: string[] = [];
    let totalGenerated = 0;
    let totalCachedCount = 0;
    const batchSize = 100; // Generate 100 at a time
    const verifyBatchSize = 50; // Verify 50 at a time

    while (validEmails.length < targetCount) {
      // Check if job was cancelled
      const currentJob = await prisma.job.findUnique({ where: { id: jobId } });
      if (currentJob?.status === 'cancelled') {
        break;
      }

      // Generate a batch of emails
      const emailsToGenerate = Math.min(batchSize, targetCount * 2); // Generate extra to account for invalid
      const generatedBatch = await generateEmails(
        emailsToGenerate,
        providers,
        country,
        ageRange,
        gender,
        [], // interests
        pattern,
        includeNumbers,
        [1, 999], // numberRange
        {
          letters: true,
          numbers: true,
          dot: true,
          underscore: true
        } // allowedCharacters
      );

      totalGenerated += generatedBatch.length;

      // Verify the batch
      const verificationResult = await verifyEmailsBulk(
        generatedBatch,
        verificationService as VerificationService
      );

      // Filter valid emails
      const validBatch = verificationResult.results
        .filter(r => r.status === 'valid')
        .map(r => r.email);

      validEmails.push(...validBatch);
      totalCachedCount += verificationResult.stats.fromCache;

      // Don't exceed target
      if (validEmails.length > targetCount) {
        validEmails.length = targetCount;
      }

      // Calculate progress
      const progress = Math.min(
        Math.round((validEmails.length / targetCount) * 100),
        100
      );

      // Update job with progress
      await prisma.job.update({
        where: { id: jobId },
        data: {
          progress,
          metadata: {
            targetCount,
            country,
            ageRange,
            gender,
            pattern,
            includeNumbers,
            providers,
            verificationService,
            generated: totalGenerated,
            verified: totalGenerated,
            valid: validEmails.length,
            cachedCount: totalCachedCount
          },
          resultData: {
            data: {
              validEmails,
              totalGenerated,
              cachedCount: totalCachedCount
            }
          }
        }
      });

      // If we've reached the target, break
      if (validEmails.length >= targetCount) {
        break;
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Mark as completed
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
        metadata: {
          targetCount,
          country,
          ageRange,
          gender,
          pattern,
          includeNumbers,
          providers,
          verificationService,
          generated: totalGenerated,
          verified: totalGenerated,
          valid: validEmails.length,
          cachedCount: totalCachedCount
        },
        resultData: {
          data: {
            validEmails,
            totalGenerated,
            cachedCount: totalCachedCount
          }
        }
      }
    });
  } catch (error: any) {
    console.error('Error processing verified email generation job:', error);
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        errorMessage: error.message || 'Unknown error occurred'
      }
    });
  }
}
