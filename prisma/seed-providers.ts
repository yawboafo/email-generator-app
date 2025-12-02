import { PrismaClient } from '@prisma/client';
import providersData from '../data/providers.json' assert { type: 'json' };

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding providers...');

  for (const provider of providersData) {
    await prisma.emailProvider.upsert({
      where: { providerId: provider.id },
      update: {
        name: provider.name,
        domain: provider.domain,
        popularity: provider.popularity,
        active: true,
      },
      create: {
        id: provider.id,
        providerId: provider.id,
        name: provider.name,
        domain: provider.domain,
        popularity: provider.popularity,
        active: true,
        updatedAt: new Date(),
      },
    });
    console.log(`  ✓ ${provider.name} (${provider.domain})`);
  }

  console.log('✅ Providers seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding providers:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
