import { test, expect } from '@playwright/test';
import { TestUsers, setupMultiUserContexts, getTestUser } from './fixtures/auth-helpers';

test.describe('Multi-User Collaboration', () => {
  test('should show real-time card creation across multiple users', async ({ browser }) => {
    const { contexts } = await setupMultiUserContexts(
      browser,
      [await getTestUser('facilitator'), await getTestUser('participant1'), await getTestUser('participant2')],
      'http://localhost:5174'
    );

    const [facilitatorPage, participant1Page, participant2Page] = await Promise.all(
      contexts.map(ctx => ctx.newPage())
    );

    // All users navigate to the same board
    const boardUrl = '/board/test-board-slug';
    await Promise.all([
      facilitatorPage.goto(boardUrl),
      participant1Page.goto(boardUrl),
      participant2Page.goto(boardUrl)
    ]);

    // Participant 1 creates a card
    const p1Column = participant1Page.locator('[data-testid="column"]').first();
    await p1Column.locator('[data-testid="card-input"]').fill('Participant 1 card');
    await p1Column.locator('[data-testid="add-card-button"]').click();

    // Other users should see the card appear
    await expect(facilitatorPage.locator('text=Participant 1 card')).toBeVisible({ timeout: 3000 });
    await expect(participant2Page.locator('text=Participant 1 card')).toBeVisible({ timeout: 3000 });

    // Participant 2 creates a card in different column
    const p2Column = participant2Page.locator('[data-testid="column"]').nth(1);
    await p2Column.locator('[data-testid="card-input"]').fill('Participant 2 improvement');
    await p2Column.locator('[data-testid="add-card-button"]').click();

    // All users should see both cards
    await expect(facilitatorPage.locator('text=Participant 2 improvement')).toBeVisible({ timeout: 3000 });
    await expect(participant1Page.locator('text=Participant 2 improvement')).toBeVisible({ timeout: 3000 });

    // Verify card attribution
    const p1Card = facilitatorPage.locator('[data-testid="card"]:has-text("Participant 1 card")');
    await expect(p1Card.locator('[data-testid="card-author"]')).toContainText('Participant One');

    const p2Card = facilitatorPage.locator('[data-testid="card"]:has-text("Participant 2 improvement")');
    await expect(p2Card.locator('[data-testid="card-author"]')).toContainText('Participant Two');

    // Cleanup
    await Promise.all(contexts.map(ctx => ctx.close()));
  });

  test('should handle concurrent voting with real-time updates', async ({ browser }) => {
    const { contexts } = await setupMultiUserContexts(
      browser,
      [await getTestUser('facilitator'), await getTestUser('participant1'), await getTestUser('participant2')],
      'http://localhost:5174'
    );

    const [facilitatorPage, participant1Page, participant2Page] = await Promise.all(
      contexts.map(ctx => ctx.newPage())
    );

    // Navigate to review scene
    const boardUrl = '/board/test-board-slug?scene=review';
    await Promise.all([
      facilitatorPage.goto(boardUrl),
      participant1Page.goto(boardUrl),
      participant2Page.goto(boardUrl)
    ]);

    // Get the first card on each page
    const facilitatorCard = facilitatorPage.locator('[data-testid="card"]').first();
    const p1Card = participant1Page.locator('[data-testid="card"]').first();
    const p2Card = participant2Page.locator('[data-testid="card"]').first();

    // Both participants vote on the same card simultaneously
    await Promise.all([
      p1Card.locator('[data-testid="vote-button"]').click(),
      p2Card.locator('[data-testid="vote-button"]').click()
    ]);

    // Facilitator should see vote count of 2
    await expect(facilitatorCard.locator('[data-testid="vote-count"]')).toContainText('2', { timeout: 5000 });

    // All users should see updated vote counts
    await expect(p1Card.locator('[data-testid="vote-count"]')).toContainText('2');
    await expect(p2Card.locator('[data-testid="vote-count"]')).toContainText('2');

    // Check remaining votes decreased for both participants
    await expect(participant1Page.locator('[data-testid="votes-remaining"]')).toContainText('2 votes remaining');
    await expect(participant2Page.locator('[data-testid="votes-remaining"]')).toContainText('2 votes remaining');

    // Cleanup
    await Promise.all(contexts.map(ctx => ctx.close()));
  });

  test('should synchronize presence indicators correctly', async ({ browser }) => {
    const { contexts } = await setupMultiUserContexts(
      browser,
      [await getTestUser('facilitator'), await getTestUser('participant1'), await getTestUser('participant2')],
      'http://localhost:5174'
    );

    const [facilitatorPage, participant1Page, participant2Page] = await Promise.all(
      contexts.map(ctx => ctx.newPage())
    );

    const boardUrl = '/board/test-board-slug';

    // Facilitator joins first
    await facilitatorPage.goto(boardUrl);
    await expect(facilitatorPage.locator('[data-testid="presence-list"]')).toContainText('Test Facilitator');

    // Participant 1 joins
    await participant1Page.goto(boardUrl);

    // Both should see each other
    await expect(facilitatorPage.locator('[data-testid="presence-list"]')).toContainText('Participant One', { timeout: 3000 });
    await expect(participant1Page.locator('[data-testid="presence-list"]')).toContainText('Test Facilitator');

    // Participant 2 joins
    await participant2Page.goto(boardUrl);

    // All should see all three users
    await expect(facilitatorPage.locator('[data-testid="presence-list"]')).toContainText('Participant Two', { timeout: 3000 });
    await expect(participant1Page.locator('[data-testid="presence-list"]')).toContainText('Participant Two');
    await expect(participant2Page.locator('[data-testid="presence-list"]')).toContainText('Test Facilitator');
    await expect(participant2Page.locator('[data-testid="presence-list"]')).toContainText('Participant One');

    // Participant 1 leaves (close page)
    await participant1Page.close();

    // Others should no longer see Participant 1 after timeout
    await expect(facilitatorPage.locator('[data-testid="presence-list"]')).not.toContainText('Participant One', { timeout: 35000 });
    await expect(participant2Page.locator('[data-testid="presence-list"]')).not.toContainText('Participant One', { timeout: 35000 });

    // Cleanup remaining contexts
    await facilitatorPage.close();
    await participant2Page.close();
    await Promise.all(contexts.slice(1).map(ctx => ctx.close()));
  });

  test('should handle facilitator scene changes for all users', async ({ browser }) => {
    const { contexts } = await setupMultiUserContexts(
      browser,
      [await getTestUser('facilitator'), await getTestUser('participant1'), await getTestUser('participant2')],
      'http://localhost:5174'
    );

    const [facilitatorPage, participant1Page, participant2Page] = await Promise.all(
      contexts.map(ctx => ctx.newPage())
    );

    const boardUrl = '/board/test-board-slug';
    await Promise.all([
      facilitatorPage.goto(boardUrl),
      participant1Page.goto(boardUrl),
      participant2Page.goto(boardUrl)
    ]);

    // All users should start in brainstorm scene
    await expect(facilitatorPage.locator('[data-testid="current-scene"]')).toContainText('Brainstorm');
    await expect(participant1Page.locator('[data-testid="current-scene"]')).toContainText('Brainstorm');
    await expect(participant2Page.locator('[data-testid="current-scene"]')).toContainText('Brainstorm');

    // Participants should see card input fields
    await expect(participant1Page.locator('[data-testid="card-input"]')).toBeVisible();
    await expect(participant2Page.locator('[data-testid="card-input"]')).toBeVisible();

    // Facilitator advances to review scene
    await facilitatorPage.click('[data-testid="next-scene-button"]');

    // All users should see scene change
    await expect(facilitatorPage.locator('[data-testid="current-scene"]')).toContainText('Review', { timeout: 3000 });
    await expect(participant1Page.locator('[data-testid="current-scene"]')).toContainText('Review', { timeout: 3000 });
    await expect(participant2Page.locator('[data-testid="current-scene"]')).toContainText('Review', { timeout: 3000 });

    // Participants should no longer see card input fields
    await expect(participant1Page.locator('[data-testid="card-input"]')).not.toBeVisible();
    await expect(participant2Page.locator('[data-testid="card-input"]')).not.toBeVisible();

    // Participants should now see voting controls
    await expect(participant1Page.locator('[data-testid="vote-button"]').first()).toBeVisible();
    await expect(participant2Page.locator('[data-testid="vote-button"]').first()).toBeVisible();

    // Cleanup
    await Promise.all(contexts.map(ctx => ctx.close()));
  });

  test('should handle timer synchronization across users', async ({ browser }) => {
    const { contexts } = await setupMultiUserContexts(
      browser,
      [await getTestUser('facilitator'), await getTestUser('participant1'), await getTestUser('participant2')],
      'http://localhost:5174'
    );

    const [facilitatorPage, participant1Page, participant2Page] = await Promise.all(
      contexts.map(ctx => ctx.newPage())
    );

    const boardUrl = '/board/test-board-slug';
    await Promise.all([
      facilitatorPage.goto(boardUrl),
      participant1Page.goto(boardUrl),
      participant2Page.goto(boardUrl)
    ]);

    // Only facilitator should see timer controls
    await expect(facilitatorPage.locator('[data-testid="timer-controls"]')).toBeVisible();
    await expect(participant1Page.locator('[data-testid="timer-controls"]')).not.toBeVisible();
    await expect(participant2Page.locator('[data-testid="timer-controls"]')).not.toBeVisible();

    // Facilitator starts 2-minute timer
    await facilitatorPage.fill('[data-testid="timer-minutes-input"]', '2');
    await facilitatorPage.click('[data-testid="start-timer-button"]');

    // All users should see the timer display
    await expect(facilitatorPage.locator('[data-testid="timer-display"]')).toBeVisible();
    await expect(participant1Page.locator('[data-testid="timer-display"]')).toBeVisible({ timeout: 3000 });
    await expect(participant2Page.locator('[data-testid="timer-display"]')).toBeVisible({ timeout: 3000 });

    // Timer should show approximately same time on all screens
    await expect(facilitatorPage.locator('[data-testid="timer-display"]')).toContainText('1:5');
    await expect(participant1Page.locator('[data-testid="timer-display"]')).toContainText('1:5');
    await expect(participant2Page.locator('[data-testid="timer-display"]')).toContainText('1:5');

    // Facilitator pauses timer
    await facilitatorPage.click('[data-testid="pause-timer-button"]');

    // All users should see paused state
    await expect(facilitatorPage.locator('[data-testid="timer-paused"]')).toBeVisible();
    await expect(participant1Page.locator('[data-testid="timer-paused"]')).toBeVisible({ timeout: 3000 });
    await expect(participant2Page.locator('[data-testid="timer-paused"]')).toBeVisible({ timeout: 3000 });

    // Cleanup
    await Promise.all(contexts.map(ctx => ctx.close()));
  });

  test('should handle card grouping with real-time updates', async ({ browser }) => {
    const { contexts } = await setupMultiUserContexts(
      browser,
      [await getTestUser('facilitator'), await getTestUser('participant1')],
      'http://localhost:5174'
    );

    const [facilitatorPage, participant1Page, participant2Page] = await Promise.all(
      contexts.map(ctx => ctx.newPage())
    );

    // Navigate to review scene where grouping is allowed
    const boardUrl = '/board/test-board-slug?scene=review';
    await Promise.all([
      facilitatorPage.goto(boardUrl),
      participant1Page.goto(boardUrl),
      participant2Page.goto(boardUrl)
    ]);

    // Facilitator groups cards
    const facilitatorCards = facilitatorPage.locator('[data-testid="card"]');
    await facilitatorCards.nth(0).click({ modifiers: ['Control'] });
    await facilitatorCards.nth(1).click({ modifiers: ['Control'] });
    await facilitatorPage.click('[data-testid="group-selected-cards-button"]');

    // All users should see the card group appear
    await expect(facilitatorPage.locator('[data-testid="card-group"]')).toBeVisible();
    await expect(participant1Page.locator('[data-testid="card-group"]')).toBeVisible({ timeout: 3000 });
    await expect(participant2Page.locator('[data-testid="card-group"]')).toBeVisible({ timeout: 3000 });

    // Group should contain the grouped cards
    const facilitatorGroup = facilitatorPage.locator('[data-testid="card-group"]').first();
    const participant1Group = participant1Page.locator('[data-testid="card-group"]').first();
    const participant2Group = participant2Page.locator('[data-testid="card-group"]').first();

    await expect(facilitatorGroup.locator('[data-testid="card"]')).toHaveCount(2);
    await expect(participant1Group.locator('[data-testid="card"]')).toHaveCount(2);
    await expect(participant2Group.locator('[data-testid="card"]')).toHaveCount(2);

    // Cleanup
    await Promise.all(contexts.map(ctx => ctx.close()));
  });

  test('should handle rapid concurrent card creation', async ({ browser }) => {
    const { contexts } = await setupMultiUserContexts(
      browser,
      [await getTestUser('participant1'), await getTestUser('participant2')],
      'http://localhost:5174'
    );

    const [participant1Page, participant2Page] = await Promise.all(
      contexts.map(ctx => ctx.newPage())
    );

    const boardUrl = '/board/test-board-slug';
    await Promise.all([
      participant1Page.goto(boardUrl),
      participant2Page.goto(boardUrl)
    ]);

    // Both users rapidly create cards in the same column
    const p1Column = participant1Page.locator('[data-testid="column"]').first();
    const p2Column = participant2Page.locator('[data-testid="column"]').first();

    // Create multiple cards simultaneously
    const createCards = async (page: any, column: any, prefix: string) => {
      for (let i = 1; i <= 3; i++) {
        await column.locator('[data-testid="card-input"]').fill(`${prefix} card ${i}`);
        await column.locator('[data-testid="add-card-button"]').click();
        await page.waitForTimeout(100); // Small delay to avoid overwhelming
      }
    };

    // Run card creation concurrently
    await Promise.all([
      createCards(participant1Page, p1Column, 'P1'),
      createCards(participant2Page, p2Column, 'P2')
    ]);

    // Both users should see all 6 cards
    await expect(participant1Page.locator('[data-testid="card"]')).toHaveCount(6, { timeout: 5000 });
    await expect(participant2Page.locator('[data-testid="card"]')).toHaveCount(6, { timeout: 5000 });

    // Verify specific cards exist
    await expect(participant1Page.locator('text=P1 card 1')).toBeVisible();
    await expect(participant1Page.locator('text=P2 card 1')).toBeVisible();
    await expect(participant2Page.locator('text=P1 card 3')).toBeVisible();
    await expect(participant2Page.locator('text=P2 card 3')).toBeVisible();

    // Cleanup
    await Promise.all(contexts.map(ctx => ctx.close()));
  });

  test('should handle user disconnection and reconnection', async ({ browser }) => {
    const { contexts } = await setupMultiUserContexts(
      browser,
      [await getTestUser('facilitator'), await getTestUser('participant1')],
      'http://localhost:5174'
    );

    const [facilitatorPage, participant1Page] = await Promise.all(
      contexts.map(ctx => ctx.newPage())
    );

    const boardUrl = '/board/test-board-slug';
    await Promise.all([
      facilitatorPage.goto(boardUrl),
      participant1Page.goto(boardUrl)
    ]);

    // Both users should see each other
    await expect(facilitatorPage.locator('[data-testid="presence-list"]')).toContainText('Participant One', { timeout: 3000 });

    // Participant simulates connection loss
    await participant1Page.context().setOffline(true);

    // Create a card while offline
    const p1Column = participant1Page.locator('[data-testid="column"]').first();
    await p1Column.locator('[data-testid="card-input"]').fill('Offline card');
    await p1Column.locator('[data-testid="add-card-button"]').click();

    // Should show offline indicator
    await expect(participant1Page.locator('[data-testid="offline-indicator"]')).toBeVisible({ timeout: 5000 });

    // Facilitator should see participant as offline after timeout
    await expect(facilitatorPage.locator('[data-testid="presence-list"]')).not.toContainText('Participant One', { timeout: 35000 });

    // Participant reconnects
    await participant1Page.context().setOffline(false);

    // Should rejoin presence and sync pending actions
    await expect(facilitatorPage.locator('[data-testid="presence-list"]')).toContainText('Participant One', { timeout: 10000 });
    await expect(facilitatorPage.locator('text=Offline card')).toBeVisible({ timeout: 10000 });

    // Offline indicator should disappear
    await expect(participant1Page.locator('[data-testid="offline-indicator"]')).not.toBeVisible({ timeout: 5000 });

    // Cleanup
    await Promise.all(contexts.map(ctx => ctx.close()));
  });
});
