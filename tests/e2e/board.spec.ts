import { type BrowserContext, expect, test } from "@playwright/test";
import {
	AuthHelper,
	createAuthenticatedContext,
	getTestUser,
} from "./fixtures/auth-helpers";
import { getTestDb } from "./fixtures/test-db";

test.describe("Board Functionality", () => {
	let facilitatorContext: BrowserContext;
	let participantContext: BrowserContext;

	test.beforeAll(async ({ browser }) => {
		// Setup authenticated contexts for multi-user tests
		facilitatorContext = await createAuthenticatedContext(
			browser,
			await getTestUser("facilitator"),
			"http://localhost:5174",
		);
		participantContext = await createAuthenticatedContext(
			browser,
			await getTestUser("participant1"),
			"http://localhost:5174",
		);
	});

	test.afterAll(async () => {
		await facilitatorContext?.close();
		await participantContext?.close();
	});

	test("should create a new series and board via UI", async ({ page }) => {
		const auth = new AuthHelper(page);
		const facilitator = await getTestUser("facilitator");
		await auth.loginViaAPI(facilitator.email, facilitator.password);

		await page.goto("/");

		// Create new series
		await page.fill("#newSeriesInput", "Test Retro Series");
		await page.click("#newSeriesInput + button");

		// Should show success message and series card
		await expect(
			page.locator('.series-card:has-text("Test Retro Series")'),
		).toBeVisible();

		// Create board within series
		await page
			.locator('.series-card:has-text("Test Retro Series") input.input-field')
			.fill("Sprint 1 Retrospective");
		await page
			.locator('.series-card:has-text("Test Retro Series") input.input-field')
			.press("Enter");

		// Should navigate to new board
		await page.waitForURL(/\/board\/.+/);
		await expect(
			page.locator('h1:has-text("Sprint 1 Retrospective")'),
		).toBeVisible();

		// Define board
		await page
			.getByRole("button", { name: "Quick Setup with Templates" })
			.click();
		await page
			.getByRole("button", { name: "KAFE (Kvetches, Appreciations" })
			.click();
		await page.waitForSelector(".column-header");
		await expect(
			page.locator('h1:has-text("Sprint 1 Retrospective")'),
		).toBeVisible();
		await expect(page.locator('h2:has-text("Kvetches")')).toBeVisible();
		await expect(
			page
				.getByRole("region", { name: "Column: Kvetches" })
				.getByPlaceholder("Add a card..."),
		).toBeVisible();
	});

	test("should display board with correct initial state", async ({ page }) => {
		const auth = new AuthHelper(page);
		const facilitator = await getTestUser("facilitator");
		await auth.loginViaAPI(facilitator.email, facilitator.password);

		// Create test data using TestDatabase
		const testDb = getTestDb();

		// Create series and board for the test (facilitator should already exist from global setup)
		const series = await testDb.createTestSeries(
			"Test Board Series",
			facilitator.email,
		);
		const board = await testDb.createTestBoard(series.id, "Test Board Display");

		// Navigate to the created board
		await page.goto(`/board/${board.id}`);

		// Should show board title and current scene
		await expect(
			page.getByRole("heading", { name: "Test Board Display" }),
		).toBeVisible();
		await expect(page.locator(".scene-dropdown-container")).toContainText(
			"Brainstorm",
		);

		// Should show all columns (default setup creates 3 columns)
		const columns = page.locator(".column");
		await expect(columns).toHaveCount(3);

		// Should show facilitator controls
		await expect(page.locator(".facilitator-configure")).toBeVisible();
		await expect(page.locator(".facilitator-timer")).toBeVisible();
	});

	test("should allow adding cards in brainstorm scene", async ({ page }) => {
		const auth = new AuthHelper(page);
		const facilitator = await getTestUser("facilitator");
		await auth.loginViaAPI(facilitator.email, facilitator.password);

		// Create test data using TestDatabase
		const testDb = getTestDb();

		// Create series and board for the test (facilitator should already exist from global setup)
		const series = await testDb.createTestSeries(
			"Test Board Series",
			facilitator.email,
		);
		const board = await testDb.createTestBoard(series.id, "Test Board Display");

		// Navigate to the created board
		await page.goto(`/board/${board.id}`);

		// Add card to "What Went Well" column
		const firstColumn = page.locator(".column").first();
		await firstColumn
			.locator(".add-card-textarea textarea")
			.fill("Great team collaboration");
		await firstColumn.locator(".add-card-textarea textarea").press("Enter");
		await firstColumn.locator(".add-card-textarea button").click();

		// Card should appear
		await expect(page.locator("text=Great team collaboration")).toBeVisible();

		// Add another card to different column
		const secondColumn = page.locator(".column").nth(1);
		await secondColumn
			.locator(".add-card-textarea textarea")
			.fill("Need better testing");
		await secondColumn.locator(".add-card-textarea textarea").press("Enter");
		await secondColumn.locator(".add-card-textarea button").click();

		await expect(page.locator("text=Need better testing")).toBeVisible();
	});

	test("should show real-time card updates across users", async ({
		browser: _browser,
	}) => {
		const facilitatorPage = await facilitatorContext.newPage();
		const participantPage = await participantContext.newPage();

		// Both users navigate to same board
		await facilitatorPage.goto("/board/test-board-slug");
		await participantPage.goto("/board/test-board-slug");

		// Participant adds a card
		const participantColumn = participantPage
			.locator('[data-testid="column"]')
			.first();
		await participantColumn
			.locator('[data-testid="card-input"]')
			.fill("Real-time test card");
		await participantColumn.locator('[data-testid="add-card-button"]').click();

		// Facilitator should see the card appear without refresh
		await expect(
			facilitatorPage.locator("text=Real-time test card"),
		).toBeVisible({ timeout: 3000 });

		// Verify card has user attribution
		const cardElement = facilitatorPage.locator(
			'[data-testid="card"]:has-text("Real-time test card")',
		);
		await expect(
			cardElement.locator('[data-testid="card-author"]'),
		).toContainText("Participant One");

		await facilitatorPage.close();
		await participantPage.close();
	});

	test("should enforce scene permissions correctly", async ({ page }) => {
		const auth = new AuthHelper(page);
		const facilitator = await getTestUser("facilitator");
		await auth.loginViaAPI(facilitator.email, facilitator.password);

		await page.goto("/board/test-board-slug");

		// In brainstorm scene, should allow adding cards
		await expect(page.locator('[data-testid="card-input"]')).toBeVisible();
		await expect(page.locator('[data-testid="add-card-button"]')).toBeEnabled();

		// Switch to review scene
		await page.click('[data-testid="next-scene-button"]');
		await expect(page.locator('[data-testid="current-scene"]')).toContainText(
			"Review",
		);

		// Should hide add card inputs
		await expect(page.locator('[data-testid="card-input"]')).not.toBeVisible();

		// Should show voting controls
		await expect(
			page.locator('[data-testid="vote-button"]').first(),
		).toBeVisible();
	});

	test("should handle voting in review scene", async ({ page }) => {
		const auth = new AuthHelper(page);
		const participant = await getTestUser("participant1");
		await auth.loginViaAPI(participant.email, participant.password);

		await page.goto("/board/test-board-slug");

		// Switch to review scene (assuming facilitator control or direct scene navigation)
		// This might require facilitator action or direct URL manipulation
		await page.goto("/board/test-board-slug?scene=review");

		// Should show voting allocation
		await expect(page.locator('[data-testid="votes-remaining"]')).toContainText(
			"3 votes remaining",
		);

		// Vote on first card
		const firstCard = page.locator('[data-testid="card"]').first();
		await firstCard.locator('[data-testid="vote-button"]').click();

		// Vote count should increase
		await expect(firstCard.locator('[data-testid="vote-count"]')).toContainText(
			"1",
		);

		// Remaining votes should decrease
		await expect(page.locator('[data-testid="votes-remaining"]')).toContainText(
			"2 votes remaining",
		);

		// Clicking again should remove vote
		await firstCard.locator('[data-testid="vote-button"]').click();
		await expect(firstCard.locator('[data-testid="vote-count"]')).toContainText(
			"0",
		);
		await expect(page.locator('[data-testid="votes-remaining"]')).toContainText(
			"3 votes remaining",
		);
	});

	test("should show real-time voting updates", async ({
		browser: _browser,
	}) => {
		const facilitatorPage = await facilitatorContext.newPage();
		const participantPage = await participantContext.newPage();

		// Both users navigate to review scene
		await facilitatorPage.goto("/board/test-board-slug?scene=review");
		await participantPage.goto("/board/test-board-slug?scene=review");

		// Participant votes on a card
		const participantCard = participantPage
			.locator('[data-testid="card"]')
			.first();
		await participantCard.locator('[data-testid="vote-button"]').click();

		// Facilitator should see vote count update
		const facilitatorCard = facilitatorPage
			.locator('[data-testid="card"]')
			.first();
		await expect(
			facilitatorCard.locator('[data-testid="vote-count"]'),
		).toContainText("1", { timeout: 3000 });

		await facilitatorPage.close();
		await participantPage.close();
	});

	test("should prevent voting beyond allocation limit", async ({ page }) => {
		const auth = new AuthHelper(page);
		const participant = await getTestUser("participant1");
		await auth.loginViaAPI(participant.email, participant.password);

		await page.goto("/board/test-board-slug?scene=review");

		// Vote on three different cards (using default allocation of 3)
		const cards = page.locator('[data-testid="card"]');
		await cards.nth(0).locator('[data-testid="vote-button"]').click();
		await cards.nth(1).locator('[data-testid="vote-button"]').click();
		await cards.nth(2).locator('[data-testid="vote-button"]').click();

		// Should show no votes remaining
		await expect(page.locator('[data-testid="votes-remaining"]')).toContainText(
			"0 votes remaining",
		);

		// Attempting to vote on another card should be disabled or show error
		const fourthCard = cards.nth(3);
		if ((await fourthCard.count()) > 0) {
			const voteButton = fourthCard.locator('[data-testid="vote-button"]');
			await expect(voteButton).toBeDisabled();
		}
	});

	test("should show user presence indicators", async ({
		browser: _browser,
	}) => {
		const facilitatorPage = await facilitatorContext.newPage();
		const participantPage = await participantContext.newPage();

		// Facilitator joins board first
		await facilitatorPage.goto("/board/test-board-slug");

		// Should show facilitator in presence list
		await expect(
			facilitatorPage.locator('[data-testid="presence-list"]'),
		).toContainText("Test Facilitator");

		// Participant joins
		await participantPage.goto("/board/test-board-slug");

		// Both should see each other
		await expect(
			facilitatorPage.locator('[data-testid="presence-list"]'),
		).toContainText("Participant One", { timeout: 3000 });
		await expect(
			participantPage.locator('[data-testid="presence-list"]'),
		).toContainText("Test Facilitator");

		await facilitatorPage.close();
		await participantPage.close();
	});

	test("should handle connection interruptions gracefully", async ({
		page,
	}) => {
		const auth = new AuthHelper(page);
		const participant = await getTestUser("participant1");
		await auth.loginViaAPI(participant.email, participant.password);

		await page.goto("/board/test-board-slug");

		// Add a card first
		const column = page.locator('[data-testid="column"]').first();
		await column
			.locator('[data-testid="card-input"]')
			.fill("Connection test card");
		await column.locator('[data-testid="add-card-button"]').click();

		await expect(page.locator("text=Connection test card")).toBeVisible();

		// Simulate network interruption by going offline
		await page.context().setOffline(true);

		// Try to add another card - should show as pending or queue
		await column.locator('[data-testid="card-input"]').fill("Offline card");
		await column.locator('[data-testid="add-card-button"]').click();

		// Should show offline indicator or pending state
		await expect(
			page.locator(
				'[data-testid="offline-indicator"], [data-testid="pending-actions"]',
			),
		).toBeVisible({ timeout: 5000 });

		// Restore connection
		await page.context().setOffline(false);

		// Pending card should eventually appear
		await expect(page.locator("text=Offline card")).toBeVisible({
			timeout: 10000,
		});
	});

	test("should allow facilitator to control timer", async ({ page }) => {
		const auth = new AuthHelper(page);
		const facilitator = await getTestUser("facilitator");
		await auth.loginViaAPI(facilitator.email, facilitator.password);

		await page.goto("/board/test-board-slug");

		// Should show timer controls for facilitator
		await expect(page.locator('[data-testid="timer-controls"]')).toBeVisible();

		// Set and start timer
		await page.fill('[data-testid="timer-minutes-input"]', "5");
		await page.click('[data-testid="start-timer-button"]');

		// Should show running timer
		await expect(page.locator('[data-testid="timer-display"]')).toBeVisible();
		await expect(page.locator('[data-testid="timer-display"]')).toContainText(
			"4:5",
		);

		// Should be able to pause timer
		await page.click('[data-testid="pause-timer-button"]');
		await expect(page.locator('[data-testid="timer-paused"]')).toBeVisible();
	});

	test("should show timer to all participants", async ({
		browser: _browser,
	}) => {
		const facilitatorPage = await facilitatorContext.newPage();
		const participantPage = await participantContext.newPage();

		await facilitatorPage.goto("/board/test-board-slug");
		await participantPage.goto("/board/test-board-slug");

		// Facilitator starts timer
		await facilitatorPage.fill('[data-testid="timer-minutes-input"]', "3");
		await facilitatorPage.click('[data-testid="start-timer-button"]');

		// Participant should see timer
		await expect(
			participantPage.locator('[data-testid="timer-display"]'),
		).toBeVisible({ timeout: 3000 });
		await expect(
			participantPage.locator('[data-testid="timer-display"]'),
		).toContainText("2:5");

		// Participant should NOT see timer controls
		await expect(
			participantPage.locator('[data-testid="timer-controls"]'),
		).not.toBeVisible();

		await facilitatorPage.close();
		await participantPage.close();
	});

	test("should handle card grouping in review scene", async ({ page }) => {
		const auth = new AuthHelper(page);
		const facilitator = await getTestUser("facilitator");
		await auth.loginViaAPI(facilitator.email, facilitator.password);

		await page.goto("/board/test-board-slug?scene=review");

		// Should show grouping controls
		await expect(
			page.locator('[data-testid="group-cards-button"]'),
		).toBeVisible();

		// Select multiple cards for grouping
		const cards = page.locator('[data-testid="card"]');
		await cards.nth(0).click({ modifiers: ["Control"] });
		await cards.nth(1).click({ modifiers: ["Control"] });

		// Should show selected state
		await expect(cards.nth(0)).toHaveClass(/selected/);
		await expect(cards.nth(1)).toHaveClass(/selected/);

		// Group selected cards
		await page.click('[data-testid="group-selected-cards-button"]');

		// Should create card group
		await expect(page.locator('[data-testid="card-group"]')).toBeVisible();

		// Grouped cards should appear together
		const group = page.locator('[data-testid="card-group"]').first();
		await expect(group.locator('[data-testid="card"]')).toHaveCount(2);
	});

	test("should export board data", async ({ page }) => {
		const auth = new AuthHelper(page);
		const facilitator = await getTestUser("facilitator");
		await auth.loginViaAPI(facilitator.email, facilitator.password);

		await page.goto("/board/test-board-slug");

		// Should show export options
		await page.click('[data-testid="board-menu-button"]');
		await expect(
			page.locator('[data-testid="export-board-button"]'),
		).toBeVisible();

		// Start download
		const downloadPromise = page.waitForEvent("download");
		await page.click('[data-testid="export-board-button"]');

		const download = await downloadPromise;
		expect(download.suggestedFilename()).toContain(".json");

		// Verify download completed
		expect(download).toBeTruthy();
	});
});
