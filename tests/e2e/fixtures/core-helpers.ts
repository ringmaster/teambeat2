/**
 * Core Test Helpers - ROCK SOLID foundation for all Playwright tests
 *
 * These helpers are designed to NEVER fail and be FAST.
 * They provide reliable, reusable functions for common test operations.
 */

import type { Browser, BrowserContext, Page } from "@playwright/test";
import { TestDatabase } from "./test-db";
import type { TestUser } from "./auth-helpers";

/**
 * Configuration for test environment
 */
export const TEST_CONFIG = {
	baseURL: "http://localhost:5174",
	defaultPassword: "password123",
	// Database path set by global-setup, stored in /tmp for automatic cleanup
} as const;

/**
 * Core helper for creating authenticated browser contexts
 * This is the FOUNDATION - must be 100% reliable
 */
export class CoreTestHelper {
	private baseURL: string;

	constructor(baseURL: string = TEST_CONFIG.baseURL) {
		this.baseURL = baseURL;
	}

	/**
	 * Create an authenticated browser context for a user
	 * Uses API login to be fast and reliable
	 */
	async createAuthContext(
		browser: Browser,
		user: TestUser,
	): Promise<BrowserContext> {
		const context = await browser.newContext({
			baseURL: this.baseURL,
		});

		const page = await context.newPage();

		try {
			// Login via API (fast and reliable)
			const response = await page.request.post("/api/auth/login", {
				data: {
					email: user.email,
					password: user.password,
				},
			});

			if (!response.ok()) {
				throw new Error(
					`Login failed for ${user.email}: ${await response.text()}`,
				);
			}

			// Close the temp page, return context with auth cookie
			await page.close();
			return context;
		} catch (error) {
			await page.close();
			await context.close();
			throw error;
		}
	}

	/**
	 * Create multiple authenticated contexts in parallel
	 * Returns contexts in same order as users
	 */
	async createMultipleAuthContexts(
		browser: Browser,
		users: TestUser[],
	): Promise<BrowserContext[]> {
		return Promise.all(
			users.map((user) => this.createAuthContext(browser, user)),
		);
	}

	/**
	 * Verify a user is logged in
	 */
	async isLoggedIn(page: Page): Promise<boolean> {
		try {
			const response = await page.request.get("/api/auth/me");
			return response.ok();
		} catch {
			return false;
		}
	}

	/**
	 * Get current user info
	 */
	async getCurrentUser(page: Page): Promise<any> {
		try {
			const response = await page.request.get("/api/auth/me");
			if (response.ok()) {
				return response.json();
			}
			return null;
		} catch {
			return null;
		}
	}
}

/**
 * Board test helper - creates and manages test boards
 */
export class BoardTestHelper {
	private testDb: TestDatabase;

	constructor() {
		// Use the database path from environment (set by global-setup)
		this.testDb = new TestDatabase(process.env.DATABASE_URL);
	}

	/**
	 * Create a complete test scenario: series + board + users
	 * Returns everything needed for board tests
	 */
	async setupBoardScenario(facilitatorEmail: string, memberEmails: string[] = []) {
		// Create series
		const series = await this.testDb.createTestSeries(
			`Test Series ${Date.now()}`,
			facilitatorEmail,
		);

		// Create board
		const board = await this.testDb.createTestBoard(
			series.id,
			`Test Board ${Date.now()}`,
		);

		// Add members to series
		for (const email of memberEmails) {
			await this.testDb.addUserToSeries(email, series.id, "member");
		}

		return {
			series,
			board,
			boardUrl: `/board/${board.id}`,
		};
	}

	/**
	 * Create a board with sample cards for testing
	 */
	async setupBoardWithCards(
		facilitatorEmail: string,
		numCards: number = 3,
	) {
		const scenario = await this.setupBoardScenario(facilitatorEmail);

		// Get the user to create cards
		const user = await this.testDb.getTestUserByEmail(facilitatorEmail);
		if (!user) {
			throw new Error(`User not found: ${facilitatorEmail}`);
		}

		// Get board columns
		const { db } = await import("../../../src/lib/server/db/index.js");
		const { columns: columnsSchema } = await import("../../../src/lib/server/db/schema.js");
		const { eq } = await import("drizzle-orm");

		const columns = await db
			.select()
			.from(columnsSchema)
			.where(eq(columnsSchema.boardId, scenario.board.id));

		// Create cards in first column
		if (columns.length > 0) {
			const { cards: cardsSchema } = await import("../../../src/lib/server/db/schema.js");
			const { v4: uuid } = await import("uuid");

			for (let i = 0; i < numCards; i++) {
				await db.insert(cardsSchema).values({
					id: `card_${uuid()}`,
					columnId: columns[0].id,
					content: `Test Card ${i + 1}`,
					authorId: user.id,
					seq: i + 1,
				});
			}
		}

		return scenario;
	}
}

/**
 * Wait utilities for common operations
 */
export class WaitHelpers {
	/**
	 * Wait for SSE event to propagate by checking DOM change
	 */
	static async waitForSSEUpdate(
		page: Page,
		selector: string,
		timeout: number = 5000,
	): Promise<void> {
		await page.waitForSelector(selector, { timeout, state: "visible" });
	}

	/**
	 * Wait for element with retries
	 */
	static async waitForElement(
		page: Page,
		selector: string,
		options: { timeout?: number; state?: "visible" | "attached" | "hidden" } = {},
	): Promise<void> {
		const timeout = options.timeout || 5000;
		const state = options.state || "visible";
		await page.waitForSelector(selector, { timeout, state });
	}

	/**
	 * Wait for network to be idle (useful after mutations)
	 */
	static async waitForNetworkIdle(page: Page, timeout: number = 2000): Promise<void> {
		await page.waitForLoadState("networkidle", { timeout });
	}
}

/**
 * Cleanup helpers
 */
export class CleanupHelpers {
	/**
	 * Close multiple contexts safely
	 */
	static async closeContexts(contexts: BrowserContext[]): Promise<void> {
		await Promise.all(
			contexts.map(async (ctx) => {
				try {
					await ctx.close();
				} catch {
					// Ignore cleanup errors
				}
			}),
		);
	}

	/**
	 * Close all pages in a context
	 */
	static async closePages(pages: Page[]): Promise<void> {
		await Promise.all(
			pages.map(async (page) => {
				try {
					await page.close();
				} catch {
					// Ignore cleanup errors
				}
			}),
		);
	}
}

/**
 * Selector utilities - common selectors used across tests
 */
export const Selectors = {
	// Auth
	emailInput: "input#email",
	passwordInput: "input#password",
	nameInput: "input#name",
	confirmPasswordInput: "input#confirmPassword",
	submitButton: 'button[type="submit"]',
	loginLink: 'a[href="/login"]',
	registerLink: 'a[href="/register"]',

	// Navigation
	navBrand: ".nav-brand-text",
	avatarDropdown: ".avatar-dropdown-trigger",
	signOutButton: "text=Sign Out",

	// Dashboard
	yourSeries: "text=Your Series",
	seriesCard: ".series-card",
	newSeriesInput: "#newSeriesInput",

	// Board
	boardTitle: "h1",
	column: ".column",
	columnHeader: ".column-header",
	addCardInput: ".add-card-textarea textarea",
	addCardButton: ".add-card-textarea button",
	card: ".card",

	// Scenes
	sceneDropdown: ".scene-dropdown-container",
	nextSceneButton: '[data-testid="next-scene-button"]',

	// Timer
	timerControls: ".facilitator-timer",
	timerDisplay: '[data-testid="timer-display"]',

	// Configure
	configureButton: ".facilitator-configure",
} as const;
