/**
 * Board Functionality Tests - Consolidated and Fixed
 *
 * These tests use the ROCK SOLID core helpers to test board features reliably.
 * Starting simple with core functionality, then building up to complex features.
 */

import { expect, test } from "@playwright/test";
import { getTestUser } from "./fixtures/auth-helpers";
import { BoardTestHelper, CoreTestHelper } from "./fixtures/core-helpers";

test.describe("Board Basics", () => {
	let coreHelper: CoreTestHelper;
	let boardHelper: BoardTestHelper;

	test.beforeEach(() => {
		coreHelper = new CoreTestHelper();
		boardHelper = new BoardTestHelper();
	});

	test("should create and load a board", async ({ browser }) => {
		// Setup: Get facilitator and create board via API
		const facilitator = await getTestUser("facilitator");
		const scenario = await boardHelper.setupBoardScenario(facilitator.email);

		// Create authenticated context
		const context = await coreHelper.createAuthContext(browser, facilitator);
		const page = await context.newPage();

		try {
			// Navigate to board
			await page.goto(scenario.boardUrl);

			// Verify board loaded
			await expect(page.locator("h1")).toContainText("Test Board");

			// Verify we're in Brainstorm scene
			await expect(page.locator(".scene-dropdown-container")).toContainText("Brainstorm");

			// Verify columns exist (default setup creates 3)
			const columns = page.locator(".column");
			await expect(columns).toHaveCount(3);
		} finally {
			await page.close();
			await context.close();
		}
	});

	test("should show facilitator controls", async ({ browser }) => {
		const facilitator = await getTestUser("facilitator");
		const scenario = await boardHelper.setupBoardScenario(facilitator.email);

		const context = await coreHelper.createAuthContext(browser, facilitator);
		const page = await context.newPage();

		try {
			await page.goto(scenario.boardUrl);

			// Facilitator should see configuration button
			await expect(page.locator(".facilitator-configure")).toBeVisible();

			// Facilitator should see timer controls
			await expect(page.locator(".facilitator-timer")).toBeVisible();
		} finally {
			await page.close();
			await context.close();
		}
	});

	test("should add a card to first column", async ({ browser }) => {
		const facilitator = await getTestUser("facilitator");
		const scenario = await boardHelper.setupBoardScenario(facilitator.email);

		const context = await coreHelper.createAuthContext(browser, facilitator);
		const page = await context.newPage();

		try {
			await page.goto(scenario.boardUrl);

			// Wait for columns to load and be visible
			const firstColumn = page.locator(".column").first();
			await expect(firstColumn).toBeVisible();

			// Wait for the add card section to appear (it's conditional based on scene)
			const addCardSection = firstColumn.locator(".add-card-section");
			await expect(addCardSection).toBeVisible({ timeout: 10000 });

			// Now interact with the textarea
			const textarea = addCardSection.locator("textarea.textarea-field");
			await expect(textarea).toBeVisible();
			await textarea.fill("Great teamwork today!");

			// Click the add button
			const addButton = addCardSection.locator("button.textarea-button");
			await addButton.click();

			// Card should appear in the column (via SSE broadcast back to same client)
			await expect(page.locator("text=Great teamwork today!")).toBeVisible({ timeout: 10000 });
		} finally {
			await page.close();
			await context.close();
		}
	});

	test("should add cards to multiple columns", async ({ browser }) => {
		const facilitator = await getTestUser("facilitator");
		const scenario = await boardHelper.setupBoardScenario(facilitator.email);

		const context = await coreHelper.createAuthContext(browser, facilitator);
		const page = await context.newPage();

		try {
			await page.goto(scenario.boardUrl);

			// Wait for all columns to load
			await expect(page.locator(".column").first()).toBeVisible();

			// Add card to first column
			const firstColumn = page.locator(".column").nth(0);
			const firstAddSection = firstColumn.locator(".add-card-section");
			await expect(firstAddSection).toBeVisible({ timeout: 10000 });
			await firstAddSection.locator("textarea.textarea-field").fill("First column card");
			await firstAddSection.locator("button.textarea-button").click();
			await expect(page.locator("text=First column card")).toBeVisible({ timeout: 10000 });

			// Add card to second column
			const secondColumn = page.locator(".column").nth(1);
			const secondAddSection = secondColumn.locator(".add-card-section");
			await expect(secondAddSection).toBeVisible();
			await secondAddSection.locator("textarea.textarea-field").fill("Second column card");
			await secondAddSection.locator("button.textarea-button").click();
			await expect(page.locator("text=Second column card")).toBeVisible({ timeout: 10000 });

			// Add card to third column
			const thirdColumn = page.locator(".column").nth(2);
			const thirdAddSection = thirdColumn.locator(".add-card-section");
			await expect(thirdAddSection).toBeVisible();
			await thirdAddSection.locator("textarea.textarea-field").fill("Third column card");
			await thirdAddSection.locator("button.textarea-button").click();
			await expect(page.locator("text=Third column card")).toBeVisible({ timeout: 10000 });
		} finally {
			await page.close();
			await context.close();
		}
	});

	test("should maintain session across page refreshes", async ({ browser }) => {
		const facilitator = await getTestUser("facilitator");
		const scenario = await boardHelper.setupBoardScenario(facilitator.email);

		const context = await coreHelper.createAuthContext(browser, facilitator);
		const page = await context.newPage();

		try {
			await page.goto(scenario.boardUrl);

			// Verify board loads
			await expect(page.locator(".column").first()).toBeVisible();

			// Add a card before refresh
			const firstColumn = page.locator(".column").first();
			const addSection = firstColumn.locator(".add-card-section");
			await expect(addSection).toBeVisible({ timeout: 10000 });
			await addSection.locator("textarea.textarea-field").fill("Before refresh");
			await addSection.locator("button.textarea-button").click();
			await expect(page.locator("text=Before refresh")).toBeVisible({ timeout: 10000 });

			// Refresh page
			await page.reload();

			// Should still show board content and the card
			await expect(page.locator(".column").first()).toBeVisible();
			await expect(page.locator("text=Before refresh")).toBeVisible();

			// Verify still logged in
			expect(await coreHelper.isLoggedIn(page)).toBe(true);
		} finally {
			await page.close();
			await context.close();
		}
	});
});

test.describe("Board Multi-User Functionality", () => {
	let coreHelper: CoreTestHelper;
	let boardHelper: BoardTestHelper;

	test.beforeEach(() => {
		coreHelper = new CoreTestHelper();
		boardHelper = new BoardTestHelper();
	});

	test("should show real-time card updates across users", async ({ browser }) => {
		// Setup: Create board with two users
		const facilitator = await getTestUser("facilitator");
		const participant = await getTestUser("participant1");

		const scenario = await boardHelper.setupBoardScenario(
			facilitator.email,
			[participant.email],
		);

		// Create two separate authenticated contexts
		const [facilitatorContext, participantContext] = await coreHelper.createMultipleAuthContexts(
			browser,
			[facilitator, participant],
		);

		const facilitatorPage = await facilitatorContext.newPage();
		const participantPage = await participantContext.newPage();

		try {
			// Both users navigate to the same board
			await facilitatorPage.goto(scenario.boardUrl);
			await participantPage.goto(scenario.boardUrl);

			// Wait for both pages to load completely
			await expect(facilitatorPage.locator(".column").first()).toBeVisible();
			await expect(participantPage.locator(".column").first()).toBeVisible();

			// Wait for add card sections to be visible
			const participantColumn = participantPage.locator(".column").first();
			const participantAddSection = participantColumn.locator(".add-card-section");
			await expect(participantAddSection).toBeVisible({ timeout: 10000 });

			// Participant adds a card
			await participantAddSection.locator("textarea.textarea-field").fill("Real-time test card");
			await participantAddSection.locator("button.textarea-button").click();

			// Participant should see their own card
			await expect(participantPage.locator("text=Real-time test card")).toBeVisible({ timeout: 5000 });

			// Facilitator should see the card appear via SSE (without refresh)
			await expect(facilitatorPage.locator("text=Real-time test card")).toBeVisible({ timeout: 5000 });
		} finally {
			await facilitatorPage.close();
			await participantPage.close();
			await facilitatorContext.close();
			await participantContext.close();
		}
	});

	test("should handle concurrent card creation", async ({ browser }) => {
		// Setup: Create board with two participants
		const participant1 = await getTestUser("participant1");
		const participant2 = await getTestUser("participant2");

		const scenario = await boardHelper.setupBoardScenario(
			participant1.email,
			[participant2.email],
		);

		const [context1, context2] = await coreHelper.createMultipleAuthContexts(
			browser,
			[participant1, participant2],
		);

		const page1 = await context1.newPage();
		const page2 = await context2.newPage();

		try {
			// Both navigate to board
			await page1.goto(scenario.boardUrl);
			await page2.goto(scenario.boardUrl);

			// Wait for load
			await expect(page1.locator(".column").first()).toBeVisible();
			await expect(page2.locator(".column").first()).toBeVisible();

			// Wait for add sections to appear
			const column1 = page1.locator(".column").first();
			const addSection1 = column1.locator(".add-card-section");
			await expect(addSection1).toBeVisible({ timeout: 10000 });

			const column2 = page2.locator(".column").first();
			const addSection2 = column2.locator(".add-card-section");
			await expect(addSection2).toBeVisible({ timeout: 10000 });

			// Both create cards simultaneously in first column
			await Promise.all([
				addSection1.locator("textarea.textarea-field").fill("User 1 card"),
				addSection2.locator("textarea.textarea-field").fill("User 2 card"),
			]);

			await Promise.all([
				addSection1.locator("button.textarea-button").click(),
				addSection2.locator("button.textarea-button").click(),
			]);

			// Both should see both cards
			await expect(page1.locator("text=User 1 card")).toBeVisible({ timeout: 5000 });
			await expect(page1.locator("text=User 2 card")).toBeVisible({ timeout: 5000 });
			await expect(page2.locator("text=User 1 card")).toBeVisible({ timeout: 5000 });
			await expect(page2.locator("text=User 2 card")).toBeVisible({ timeout: 5000 });
		} finally {
			await page1.close();
			await page2.close();
			await context1.close();
			await context2.close();
		}
	});
});
