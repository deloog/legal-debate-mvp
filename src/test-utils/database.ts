import { PrismaClient } from '@prisma/client';

// Create a test instance of Prisma Client
export const testPrisma = new PrismaClient();

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
    // Clean up all data
    await testPrisma.analysis.deleteMany();
    await testPrisma.chatMessage.deleteMany();
    await testPrisma.document.deleteMany();
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
  await testPrisma.analysis.deleteMany();
  await testPrisma.chatMessage.deleteMany();
  await testPrisma.document.deleteMany();
  await testPrisma.session.deleteMany();
  await testPrisma.account.deleteMany();
  await testPrisma.user.deleteMany();
};
