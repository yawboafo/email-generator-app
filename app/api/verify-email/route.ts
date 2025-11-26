import { NextRequest, NextResponse } from 'next/server';
import {
  verifyEmailWithCache,
  verifyEmailsBulk,
  getVerifiedEmailsByStatus,
  getVerificationStats
} from '@/lib/emailVerification';
import { prisma } from '@/lib/prisma';

// POST /api/verify-email - Verify single email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, emails, apiKey } = body;

    // Handle bulk verification
    if (emails && Array.isArray(emails)) {
      if (emails.length === 0) {
        return NextResponse.json(
          { error: 'No emails provided' },
          { status: 400 }
        );
      }

      if (emails.length > 1000) {
        return NextResponse.json(
          { error: 'Maximum 1000 emails per request' },
          { status: 400 }
        );
      }

      const result = await verifyEmailsBulk(emails, apiKey);
      
      return NextResponse.json({
        success: true,
        ...result
      });
    }

    // Handle single email verification
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const result = await verifyEmailWithCache(email, apiKey);
    
    return NextResponse.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Error in verify-email API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to verify email',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET /api/verify-email - Get cached emails or stats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Get statistics
    if (action === 'stats') {
      const stats = await getVerificationStats();
      return NextResponse.json({ success: true, stats });
    }

    // Get cached emails by status (just email addresses)
    if (action === 'list' && status) {
      const statuses = status.split(',') as any[];
      const emails = await getVerifiedEmailsByStatus(statuses, limit);
      
      return NextResponse.json({
        success: true,
        emails,
        count: emails.length
      });
    }

    // Get full details of cached emails
    if (action === 'details') {
      const statuses = status ? status.split(',') : ['valid', 'risky', 'invalid', 'unknown'];
      const verifiedEmails = await prisma.verifiedEmail.findMany({
        where: {
          status: { in: statuses }
        },
        select: {
          emailAddress: true,
          status: true,
          lastVerifiedAt: true,
          verificationCount: true,
        },
        orderBy: {
          lastVerifiedAt: 'desc'
        },
        take: limit
      });

      return NextResponse.json({
        success: true,
        emails: verifiedEmails,
        count: verifiedEmails.length
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use ?action=stats or ?action=list&status=valid' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in verify-email GET API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch verification data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
