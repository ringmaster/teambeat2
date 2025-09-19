# TeamBeat Testing Suite

This directory contains the Playwright end-to-end testing suite for TeamBeat, focusing on multi-user collaboration scenarios and real-time functionality.

## Overview

The test suite is designed to validate:
- **Authentication flows** - Login, registration, session management
- **Board functionality** - Series/board creation, card management, scene transitions
- **Real-time collaboration** - Multi-user interactions, SSE synchronization, presence tracking
- **Permission enforcement** - Role-based access, scene-specific permissions
- **Edge cases** - Network interruptions, concurrent actions, error handling

## Test Structure

```
tests/
├── e2e/
│   ├── fixtures/
│   │   ├── auth-helpers.ts    # Authentication utilities
│   │   └── test-db.ts         # Test database setup
│   ├── auth.spec.ts           # Authentication tests
│   ├── board.spec.ts          # Board functionality tests
│   ├── collaboration.spec.ts  # Multi-user collaboration tests
│   ├── smoke.spec.ts          # Basic smoke tests
│   ├── global-setup.ts        # Global test initialization
│   └── global-teardown.ts     # Global test cleanup
├── load_test_script.js        # Existing load testing
├── load_test_sse_script.js    # Existing SSE load testing
└── README.md                  # This file
```

## Running Tests

### All Tests
```bash
npm run test
```

### Interactive UI Mode
```bash
npm run test:ui
```

### Debug Mode (with browser)
```bash
npm run test:debug
```

### Headed Mode (visible browser)
```bash
npm run test:headed
```

### View Test Report
```bash
npm run test:report
```

### Specific Test Files
```bash
npx playwright test smoke.spec.ts
npx playwright test auth.spec.ts
npx playwright test collaboration.spec.ts
```

### Run on Specific Browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Database

Tests use an **isolated in-memory SQLite database** that is created fresh for each test run:

- **No impact on development/production data**
- **Fast test execution** with in-memory operations
- **Automatic cleanup** after test completion
- **Uses actual Drizzle migrations** - no duplicate schema maintenance
- **Consistent test state** with factory methods

## Key Improvement: Migration-Based Schema

The test database now uses your **actual Drizzle migrations** instead of manually maintaining a separate schema. This provides several critical benefits:

### ✅ **Schema Consistency**
- **Single source of truth** - Test database matches production exactly
- **No sync issues** - Schema changes automatically apply to tests
- **Real constraints** - Foreign keys, indexes, and validation rules are identical

### ✅ **Maintenance Benefits**
- **Zero duplicate maintenance** - Add/modify tables once in migrations
- **Automatic updates** - New migrations automatically available in tests
- **Reduced errors** - No risk of test schema drifting from production

### ✅ **Implementation**
```typescript
// Before: Manual schema creation (error-prone)
this.sqlite.exec(`CREATE TABLE users (...)`); // Had to maintain separately

// After: Uses your actual migrations
await migrate(this.db, { migrationsFolder: './drizzle' }); // Automatically in sync
```

This ensures your tests always validate against the **exact same database structure** as production.

### Test Data Factory

The `TestDatabase` class uses your actual Drizzle migrations and provides factory methods for creating test data:

```typescript
// Database automatically applies your migrations from ./drizzle/
const testDb = new TestDatabase();
await testDb.setup(); // Applies all your migration files

// Create test users using the real schema
const facilitator = await testDb.createTestUser('facilitator@test.com', 'password123');
const participant = await testDb.createTestUser('participant@test.com', 'password123');

// Create series and boards with actual schema structure
const series = await testDb.createTestSeries('Test Series', facilitator.id);
const board = await testDb.createTestBoard(series.id, 'Test Board');

// Complete scenario setup
const scenario = await testDb.setupBasicScenario();
```

## Multi-User Testing

The test suite includes comprehensive multi-user scenarios:

### Browser Context Isolation
- Each test user gets a **separate browser context**
- **Independent sessions** and cookies
- **Parallel user actions** for realistic collaboration testing

### Real-time Synchronization Tests
- **Card creation/editing** across multiple users
- **Voting synchronization** with concurrent actions
- **Presence tracking** and user join/leave events
- **Scene transitions** initiated by facilitators
- **Timer synchronization** across all participants

### Example Multi-User Test
```typescript
test('should show real-time card updates', async ({ browser }) => {
  const { contexts } = await setupMultiUserContexts(
    browser,
    [TestUsers.facilitator, TestUsers.participant1],
    'http://localhost:4173'
  );

  const [facilitatorPage, participantPage] = await Promise.all(
    contexts.map(ctx => ctx.newPage())
  );

  // Both users join same board
  await facilitatorPage.goto('/board/test-board-slug');
  await participantPage.goto('/board/test-board-slug');

  // Participant creates card
  await participantPage.fill('[data-testid="card-input"]', 'New idea');
  await participantPage.click('[data-testid="add-card-button"]');

  // Facilitator sees card appear in real-time
  await expect(facilitatorPage.locator('text=New idea')).toBeVisible({ timeout: 3000 });
});
```

## Authentication Helpers

The `AuthHelper` class provides utilities for test authentication:

```typescript
const auth = new AuthHelper(page);

// Login via API (fast)
await auth.loginViaAPI(email, password);

// Login via UI (for testing forms)
await auth.login(email, password);

// Check login status
const isLoggedIn = await auth.isLoggedIn();

// Ensure specific user is logged in
await auth.ensureLoggedIn(email, password);
```

## Test Data IDs

Tests use `data-testid` attributes for reliable element selection:

```html
<!-- Good - stable test selectors -->
<button data-testid="add-card-button">Add Card</button>
<div data-testid="card" data-card-id="crd_123">Card content</div>
<div data-testid="presence-list">Users online...</div>

<!-- Avoid - brittle selectors -->
<button class="btn btn-primary">Add Card</button>
<div class="card-item">Card content</div>
```

## Network Conditions Testing

Tests include network interruption scenarios:

```typescript
// Simulate offline condition
await page.context().setOffline(true);

// Perform actions while offline
await page.fill('[data-testid="card-input"]', 'Offline card');
await page.click('[data-testid="add-card-button"]');

// Should show offline indicator
await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();

// Restore connection
await page.context().setOffline(false);

// Changes should sync
await expect(page.locator('text=Offline card')).toBeVisible({ timeout: 10000 });
```

## Performance Considerations

### Test Performance
- **Parallel execution** when possible
- **API login** preferred over UI login for setup
- **In-memory database** with real migrations for fast, accurate operations
- **Minimal waiting** with specific element expectations
- **Schema consistency** - tests always use your actual database structure

### Application Performance
Tests validate performance requirements:
- **Page load times** under 300ms for reasonable connections
- **Real-time updates** appearing within 3 seconds
- **Presence timeouts** working correctly (30-second timeout)
- **Connection recovery** handling within 10 seconds
- **Migration application** - test database setup under 100ms

## Debugging Tests

### Debug Individual Test
```bash
npx playwright test auth.spec.ts --debug
```

### View Test Results
```bash
npx playwright show-report
```

### Screenshots and Videos
Failed tests automatically capture:
- **Screenshots** of the final page state
- **Videos** of the test execution (in headed mode)
- **Browser traces** for detailed debugging

### Console Output
Tests capture and report:
- **Browser console errors**
- **Network request failures**
- **JavaScript exceptions**
- **SSE connection issues**

## CI/CD Integration

The test configuration is optimized for CI environments:

```typescript
// playwright.config.ts
export default defineConfig({
  // Single worker in CI to avoid resource conflicts
  workers: process.env.CI ? 1 : undefined,

  // Retry failed tests in CI
  retries: process.env.CI ? 2 : 0,

  // Start application server before tests
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
```

## Test Coverage Goals

### Critical Path Coverage ✅
- ✅ User authentication (login/logout/register)
- ✅ Series and board creation
- ✅ Card creation and editing
- ✅ Real-time synchronization
- ✅ Multi-user collaboration
- ✅ Voting functionality
- ✅ Scene transitions
- ✅ Permission enforcement

### Future Coverage Areas
- [ ] API endpoint testing (Vitest integration)
- [ ] Component unit testing
- [ ] Performance testing under load
- [ ] Accessibility compliance testing
- [ ] Mobile responsiveness validation
- [ ] WebAuthn/biometric authentication
- [ ] Export/import functionality

## Contributing to Tests

### Adding New Tests
1. **Use existing fixtures** (`auth-helpers.ts`, `test-db.ts`)
2. **Follow multi-user patterns** for collaboration features
3. **Include real-time validation** for SSE functionality
4. **Test both happy path and edge cases**
5. **Use descriptive test names** that explain the scenario

### Test Writing Guidelines
- **One scenario per test** - focused and specific
- **Arrange-Act-Assert pattern** - clear test structure
- **Realistic data** - use meaningful test content
- **Proper cleanup** - use fixtures for automatic cleanup
- **Timeout handling** - appropriate waits for real-time features

### Example New Test
```typescript
test('should handle facilitator changing voting allocation mid-session', async ({ browser }) => {
  const { contexts } = await setupMultiUserContexts(
    browser,
    [TestUsers.facilitator, TestUsers.participant1],
    'http://localhost:4173'
  );

  // Setup: Both users in review scene, participant has used votes
  // When: Facilitator changes allocation from 3 to 5
  // Then: Participant gets additional votes, vote counts update correctly
  // Cleanup: Contexts closed automatically
});
```

This testing suite ensures TeamBeat's collaborative features work reliably across different users, network conditions, and usage patterns.
