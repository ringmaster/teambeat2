import { chromium, FullConfig } from '@playwright/test';
import { TestDatabase } from './fixtures/test-db';
import { TestUsers, setTestUserIds } from './fixtures/auth-helpers';

async function globalSetup(_config: FullConfig) {
  console.log('Setting up global test environment...');

  // Create a consistent test database path that the web server will use
  const testDbPath = './teambeat-test.db';
  process.env.DATABASE_URL = testDbPath;

  // Initialize test database and run migrations
  const testDb = new TestDatabase(testDbPath);
  await testDb.setup();

  // Create all predefined test users
  try {
    const createdUsers: Record<string, any> = {};
    const userIds: Record<string, string> = {};

    for (const [key, userData] of Object.entries(TestUsers)) {
      const testUser = await testDb.createTestUser(userData.email, userData.password, userData.name);
      createdUsers[key] = testUser;
      userIds[key] = testUser.id;
      console.log(`✓ Created test user: ${userData.email}`);
    }

    // Store user IDs for use in tests
    setTestUserIds(userIds);

    // Store primary test user info in environment for backward compatibility
    process.env.TEST_USER_ID = createdUsers.facilitator.id;
    process.env.TEST_USER_EMAIL = createdUsers.facilitator.email;

    console.log('✓ Created all test users');
  } catch (error) {
    console.warn('Could not create test users:', error);
  }

  console.log('Global test setup completed');
  console.log('Application and tests will use the same migrated test database');
}

export default globalSetup;
