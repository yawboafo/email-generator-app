const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:jJwYfEvKUqaDBTipqeXXuKJGQVREtEfx@ballast.proxy.rlwy.net:12936/railway';

const pool = new Pool({
  connectionString,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkPatternElements() {
  try {
    const count = await prisma.patternElement.count();
    console.log(`\n✓ Total PatternElements in database: ${count}`);
    
    const grouped = await prisma.patternElement.groupBy({
      by: ['type'],
      _count: true,
    });
    
    console.log('\nBreakdown by type:');
    grouped.forEach(group => {
      console.log(`  ${group.type}: ${group._count}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPatternElements();
