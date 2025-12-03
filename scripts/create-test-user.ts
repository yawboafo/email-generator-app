import 'dotenv/config';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

async function createTestUser() {
  console.log('🔄 Creating test user...\n');

  try {
    const testEmail = 'test@example.com';
    const testPassword = await bcrypt.hash('Test@2025!', 12);

    const existingUser = await prisma.user.findUnique({
      where: { email: testEmail },
    });

    if (existingUser) {
      console.log('✅ Test user already exists');
      console.log(`   Email: ${testEmail}`);
      return;
    }

    const user = await prisma.user.create({
      data: {
        email: testEmail,
        password: testPassword,
        name: 'Test User',
      },
    });

    console.log('✅ Test user created successfully!');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Password: Test@2025!`);
    console.log('\n🚀 You can now login with these credentials');

  } catch (error) {
    console.error('❌ Failed to create test user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
