import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

// Get all saved email batches for current user
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      );
    }

    // Get all saved emails for this user, grouped by batch
    const savedEmails = await prisma.savedEmail.findMany({
      where: {
        userId: currentUser.userId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Group by name (batch name) - we'll use name field as batch identifier
    const batches: any[] = [];
    const batchMap = new Map<string, any>();

    savedEmails.forEach(email => {
      const batchName = email.name || 'Unnamed Batch';
      
      if (!batchMap.has(batchName)) {
        batchMap.set(batchName, {
          id: `batch_${batchName}_${email.createdAt.getTime()}`,
          name: batchName,
          emails: [],
          count: 0,
          createdAt: email.createdAt.toISOString(),
          providers: email.provider ? [email.provider] : [],
          country: email.countryCode || 'US',
          pattern: 'firstname.lastname',
          userId: email.userId
        });
      }

      const batch = batchMap.get(batchName);
      batch.emails.push(email.emailAddress);
      batch.count++;
      
      // Add provider if not already in list
      if (email.provider && !batch.providers.includes(email.provider)) {
        batch.providers.push(email.provider);
      }
    });

    batches.push(...batchMap.values());

    return NextResponse.json({ batches });
  } catch (error: any) {
    console.error('Error fetching saved emails:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch saved emails' },
      { status: 500 }
    );
  }
}

// Save a new batch of emails
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, emails, providers, country, pattern } = body;

    if (!name || !emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: 'Name and emails array are required' },
        { status: 400 }
      );
    }

    // Save each email to database with user association
    const savedEmails = await Promise.all(
      emails.map((email: string) => 
        prisma.savedEmail.create({
          data: {
            id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            emailAddress: email,
            name, // Use name as batch identifier
            countryCode: country,
            provider: providers && providers.length > 0 ? providers[0] : null,
            notes: JSON.stringify({ pattern, providers }),
            userId: currentUser.userId,
            updatedAt: new Date()
          }
        })
      )
    );

    return NextResponse.json({
      success: true,
      batch: {
        id: `batch_${name}_${Date.now()}`,
        name,
        emails,
        count: emails.length,
        createdAt: new Date().toISOString(),
        providers,
        country,
        pattern,
        userId: currentUser.userId
      },
      savedCount: savedEmails.length
    });
  } catch (error: any) {
    console.error('Error saving emails:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save emails' },
      { status: 500 }
    );
  }
}

// Delete saved emails by batch name
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const batchName = searchParams.get('name');

    if (!batchName) {
      return NextResponse.json(
        { error: 'Batch name is required' },
        { status: 400 }
      );
    }

    // Delete all emails in this batch for this user only
    const result = await prisma.savedEmail.deleteMany({
      where: {
        name: batchName,
        userId: currentUser.userId // CRITICAL: Only delete user's own emails
      }
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count
    });
  } catch (error: any) {
    console.error('Error deleting saved emails:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete emails' },
      { status: 500 }
    );
  }
}
