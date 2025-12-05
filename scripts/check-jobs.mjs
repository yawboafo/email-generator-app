import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkJobs() {
  try {
    const jobs = await prisma.job.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        status: true,
        progress: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    console.log('\n=== Recent Jobs ===');
    if (jobs.length === 0) {
      console.log('❌ No jobs found in database\n');
    } else {
      console.log(`Found ${jobs.length} jobs:\n`);
      jobs.forEach(job => {
        console.log(`ID: ${job.id.slice(0, 8)}... | Type: ${job.type} | Status: ${job.status} | Progress: ${job.progress}% | Created: ${job.createdAt.toISOString()}`);
      });
      console.log('');
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkJobs();
