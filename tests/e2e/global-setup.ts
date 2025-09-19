import { chromium, FullConfig } from '@playwright/test';
import { TestDatabase } from './fixtures/test-db';

async function globalSetup(_config: FullConfig) {
  console.log('Setting up global test environment...');

  // Initialize test database
  const testDb = new TestDatabase();
  await testDb.setup();

  // Create a simple test user for basic testing
  try {
    const testUser = await testDb.createTestUser('test@example.com', 'password123');
    process.env.TEST_USER_ID = testUser.id;
    process.env.TEST_USER_EMAIL = testUser.email;
    console.log('✓ Created test user');
  } catch (error) {
    console.warn('Could not create test user:', error);
  }

  // Set up a browser context for pre-warming the application
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Pre-warm the application by making a request
    const response = await page.goto('http://localhost:5173/');
    if (!response?.ok()) {
      console.warn('Application may not be fully ready yet');
    }
  } catch (error) {
    console.warn('Could not pre-warm application:', error);
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  console.log('Global test setup completed');
}

export default globalSetup;
