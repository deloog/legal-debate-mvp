import { PrismaClient } from '@prisma/client';

// Create a test instance of Prisma Client with test database
// 使用环境变量 DATABASE_URL，CI 环境中由 GitHub Actions 设置
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/test_db';

export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

// Test database utilities
export const setupTestDatabase = async () => {
  try {
    // Connect to test database
    await testPrisma.$connect();

    // Run migrations if needed
    // Note: For SQLite, this will create database file
    // For PostgreSQL, ensure test database exists

    console.log('Test database connected successfully');
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw error;
  }
};

export const cleanupTestDatabase = async () => {
  try {
    // Clean up all data in correct order (respect foreign key constraints)
    await testPrisma.aIInteraction.deleteMany();
    await testPrisma.argument.deleteMany();
    await testPrisma.legalReference.deleteMany();
    await testPrisma.debateRound.deleteMany();
    await testPrisma.debate.deleteMany();
    await testPrisma.document.deleteMany();
    await testPrisma.case.deleteMany();
    await testPrisma.session.deleteMany();
    await testPrisma.account.deleteMany();
    await testPrisma.user.deleteMany();

    // Disconnect
    await testPrisma.$disconnect();

    console.log('Test database cleaned up successfully');
  } catch (error) {
    console.error('Failed to cleanup test database:', error);
    throw error;
  }
};

// Jest global setup and teardown
export const globalSetup = async () => {
  await setupTestDatabase();
};

export const globalTeardown = async () => {
  await cleanupTestDatabase();
};

// Individual test database reset
export const resetDatabase = async () => {
  // Delete all data in correct order (respect foreign key constraints)
  await testPrisma.lawArticleRelation.deleteMany();
  await testPrisma.aIInteraction.deleteMany();
  await testPrisma.argument.deleteMany();
  await testPrisma.legalReference.deleteMany();
  await testPrisma.debateRound.deleteMany();
  await testPrisma.debate.deleteMany();
  await testPrisma.document.deleteMany();
  await testPrisma.case.deleteMany();
  await testPrisma.session.deleteMany();
  await testPrisma.account.deleteMany();
  await testPrisma.user.deleteMany();
};

// Test database isolation utilities
export const createTestDatabase = async () => {
  // For SQLite, ensure we have a fresh test database
  const testDbPath = './test.db';

  try {
    // Remove existing test database file if it exists
    const fs = await import('fs/promises');
    try {
      await fs.unlink(testDbPath);
    } catch {
      // File doesn't exist, that's fine
    }

    await setupTestDatabase();
    console.log('Fresh test database created');
  } catch (error) {
    console.error('Failed to create test database:', error);
    throw error;
  }
};
