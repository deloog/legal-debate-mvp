import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test global setup...');

  // Set up test database
  console.log('📊 Setting up test database...');
  // Note: We'll add database setup here once Prisma is properly configured

  // Wait for the application to be ready
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Wait for the app to be ready
    await page.goto(config.webServer?.url || 'http://localhost:3000');
    await page.waitForLoadState('networkidle');
    console.log('✅ Application is ready for E2E testing');
  } catch (error) {
    console.error('❌ Application failed to start:', error);
    throw error;
  } finally {
    await browser.close();
  }

  console.log('✅ E2E test global setup completed');
}

export default globalSetup;
