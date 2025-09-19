import { chromium, FullConfig } from '@playwright/test';
import { TestDatabase } from './fixtures/test-db';

async function globalSetup(_config: FullConfig) {
  console.log('Setting up global test environment...');

  // Initialize test database
  const testDb = new TestDatabase();
  await testDb.setup();

  // Create test users and basic data structure
  const scenario = await testDb.setupBasicScenario();

  // Store test data for use in tests
  process.env.TEST_FACILITATOR_ID = scenario.users.facilitator.id;
  process.env.TEST_PARTICIPANT1_ID = scenario.users.participant1.id;
  process.env.TEST_PARTICIPANT2_ID = scenario.users.participant2.id;
  process.env.TEST_SERIES_ID = scenario.series.id;
  process.env.TEST_BOARD_ID = scenario.board.id;
  process.env.TEST_BOARD_SLUG = scenario.series.slug;

  // Set up a browser context for pre-warming the application
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Pre-warm the application by making a request
    const response = await page.goto('http://localhost:4173/');
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
  console.log(`Test board available at: /board/${scenario.series.slug}`);
}

export default globalSetup;
