#!/usr/bin/env node
/**
 * Clear All Jobs Script
 * This script deletes ALL jobs from the database for ALL users
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearAllJobs() {
  try {
    console.log('\n🗑️  Clearing all jobs from database...\n');

    // Count jobs before deletion
    const countBefore = await prisma.job.count();
    console.log(`Found ${countBefore} jobs in database`);

    if (countBefore === 0) {
      console.log('✅ No jobs to delete\n');
      await prisma.$disconnect();
      return;
    }

    // Confirm deletion
    console.log('\n⚠️  WARNING: This will DELETE ALL JOBS for ALL USERS');
    console.log('Press Ctrl+C now to cancel, or wait 3 seconds to proceed...\n');
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Delete all jobs
    const result = await prisma.job.deleteMany({});
    
    console.log(`✅ Successfully deleted ${result.count} jobs\n`);

    // Verify deletion
    const countAfter = await prisma.job.count();
    console.log(`Jobs remaining: ${countAfter}\n`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

clearAllJobs();
