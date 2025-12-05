const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');

const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl: false
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkJob(jobId) {
  try {
    console.log(`Checking for job: ${jobId}\n`);
    
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    if (!job) {
      console.log('❌ Job not found in database');
      
      // Check if there are any jobs at all
      const totalJobs = await prisma.job.count();
      console.log(`\nTotal jobs in database: ${totalJobs}`);
      
      if (totalJobs > 0) {
        console.log('\nRecent jobs:');
        const recentJobs = await prisma.job.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            type: true,
            status: true,
            progress: true,
            createdAt: true,
            user: {
              select: { email: true }
            }
          }
        });
        recentJobs.forEach(j => {
          console.log(`  - ${j.id} | ${j.type} | ${j.status} | ${j.progress}% | ${j.createdAt.toISOString()} | ${j.user.email}`);
        });
      }
    } else {
      console.log('✅ Job found!');
      console.log('\nJob Details:');
      console.log(`  ID: ${job.id}`);
      console.log(`  Type: ${job.type}`);
      console.log(`  Status: ${job.status}`);
      console.log(`  Progress: ${job.progress}%`);
      console.log(`  User: ${job.user.email} (${job.user.name || 'N/A'})`);
      console.log(`  Created: ${job.createdAt.toISOString()}`);
      console.log(`  Updated: ${job.updatedAt.toISOString()}`);
      if (job.completedAt) {
        console.log(`  Completed: ${job.completedAt.toISOString()}`);
      }
      if (job.errorMessage) {
        console.log(`  Error: ${job.errorMessage}`);
      }
      
      console.log('\nMetadata:');
      console.log(JSON.stringify(job.metadata, null, 2));
      
      if (job.resultData) {
        console.log('\nResult Data:');
        console.log(JSON.stringify(job.resultData, null, 2));
      }
    }
  } catch (error) {
    console.error('Error checking job:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const jobId = process.argv[2] || 'cmisjauj';
checkJob(jobId);
