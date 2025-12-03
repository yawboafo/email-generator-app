/**
 * Migration script to add user authentication
 * This script:
 * 1. Creates a default "system" user for existing jobs
 * 2. Assigns all existing jobs to this user
 * 3. Applies the schema changes
 */

import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

async function migrate() {
  console.log('🔄 Starting migration to add user authentication...\n');

  try {
    // Step 1: Create a system user for existing data
    console.log('Step 1: Creating system user for existing jobs...');
    
    const systemUserEmail = 'system@localhost';
    const systemUserPassword = await bcrypt.hash('System@2025!', 12);
    
    // Check if system user already exists
    let systemUser = await prisma.$queryRaw`
      SELECT * FROM "User" WHERE email = ${systemUserEmail}
    `.catch(() => null);

    if (!systemUser || (Array.isArray(systemUser) && systemUser.length === 0)) {
      // Create system user using raw SQL since User model might not exist yet
      await prisma.$executeRaw`
        INSERT INTO "User" (id, email, password, name, "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          ${systemUserEmail},
          ${systemUserPassword},
          'System User',
          NOW(),
          NOW()
        )
        ON CONFLICT (email) DO NOTHING
      `;
      console.log('✅ System user created');
    } else {
      console.log('✅ System user already exists');
    }

    // Get the system user ID
    const systemUserResult: any = await prisma.$queryRaw`
      SELECT id FROM "User" WHERE email = ${systemUserEmail}
    `;
    const systemUserId = systemUserResult[0]?.id;

    if (!systemUserId) {
      throw new Error('Failed to get system user ID');
    }

    console.log(`System user ID: ${systemUserId}\n`);

    // Step 2: Update all existing jobs with NULL userId to system user
    console.log('Step 2: Assigning existing jobs to system user...');
    
    const updateResult: any = await prisma.$executeRaw`
      UPDATE "Job"
      SET "userId" = ${systemUserId}
      WHERE "userId" IS NULL
    `;
    
    console.log(`✅ Updated ${updateResult} jobs\n`);

    // Step 3: Update all existing SavedEmails with NULL userId
    console.log('Step 3: Assigning existing saved emails to system user...');
    
    const updateSavedResult: any = await prisma.$executeRaw`
      UPDATE "SavedEmail"
      SET "userId" = ${systemUserId}
      WHERE "userId" IS NULL
    `;
    
    console.log(`✅ Updated ${updateSavedResult} saved emails\n`);

    console.log('✅ Migration completed successfully!');
    console.log('\n📝 Summary:');
    console.log(`   - System user created/verified: ${systemUserEmail}`);
    console.log(`   - Jobs migrated: ${updateResult}`);
    console.log(`   - Saved emails migrated: ${updateSavedResult}`);
    console.log('\n⚠️  System user credentials:');
    console.log(`   Email: ${systemUserEmail}`);
    console.log(`   Password: System@2025!`);
    console.log('\n🚀 You can now run: npx prisma db push');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
