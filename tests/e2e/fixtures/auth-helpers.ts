import type { BrowserContext, Page } from "@playwright/test";

export interface TestUser {
	email: string;
	password: string;
	name: string;
	id?: string;
}

export class AuthHelper {
	constructor(private page: Page) {}

	/**
	 * Login via the login form
	 */
	async login(email: string, password: string) {
		await this.page.goto("/login");

		await this.page.fill("input#email", email);
		await this.page.fill("input#password", password);
		await this.page.click('button[type="submit"]');

		// Wait for redirect to dashboard or home
		await this.page.waitForURL(/\/(dashboard)?$/);
	}

	/**
	 * Register a new user via the registration form
	 */
	async register(email: string, password: string, name: string) {
		await this.page.goto("/register");

		await this.page.fill("input#email", email);
		await this.page.fill("input#name", name);
		await this.page.fill('input#password"]', password);
		await this.page.fill("input#confirmPassword", password);
		await this.page.click('button[type="submit"]');

		// Wait for redirect to dashboard after successful registration
		await this.page.waitForURL(/\/(dashboard)?$/);
	}

	/**
	 * Register via API call (faster for setup)
	 */
	async registerViaAPI(email: string, password: string, name?: string) {
		const response = await this.page.request.post("/api/auth/register", {
			data: { email, password, name },
		});

		if (!response.ok()) {
			throw new Error(`Registration failed: ${await response.text()}`);
		}

		// The session cookie should now be set
		return response.json();
	}

	/**
	 * Login via API call (faster for setup)
	 */
	async loginViaAPI(email: string, password: string) {
		const response = await this.page.request.post("/api/auth/login", {
			data: { email, password },
		});

		if (!response.ok()) {
			throw new Error(`Login failed: ${await response.text()}`);
		}

		// The session cookie should now be set
		return response.json();
	}

	/**
	 * Logout via UI
	 */
	async logout() {
		// Hover over avatar to show dropdown, then click Sign Out
		await this.page.hover(".avatar-dropdown-trigger");
		await this.page.click("text=Sign Out");

		// Wait for redirect to login or welcome page
		await this.page.waitForURL(/\/(login|welcome)?$/);
	}

	/**
	 * Logout via API call
	 */
	async logoutViaAPI() {
		await this.page.request.post("/api/auth/logout");
	}

	/**
	 * Check if user is currently logged in
	 */
	async isLoggedIn(): Promise<boolean> {
		try {
			const response = await this.page.request.get("/api/auth/me");
			return response.ok();
		} catch {
			return false;
		}
	}

	/**
	 * Get current user info
	 */
	async getCurrentUser() {
		const response = await this.page.request.get("/api/auth/me");
		if (response.ok()) {
			return response.json();
		}
		return null;
	}

	/**
	 * Ensure user is logged out before test
	 */
	async ensureLoggedOut() {
		if (await this.isLoggedIn()) {
			await this.logoutViaAPI();
		}
	}

	/**
	 * Ensure specific user is logged in
	 */
	async ensureLoggedIn(email: string, password: string) {
		const currentUser = await this.getCurrentUser();
		if (!currentUser || currentUser.user?.email !== email) {
			await this.ensureLoggedOut();
			await this.loginViaAPI(email, password);
		}
	}
}

/**
 * Create a new browser context with a logged-in user
 */
export async function createAuthenticatedContext(
	browser: any,
	user: TestUser,
	baseURL: string,
): Promise<BrowserContext> {
	const context = await browser.newContext({
		baseURL,
	});

	const page = await context.newPage();
	const auth = new AuthHelper(page);

	await auth.loginViaAPI(user.email, user.password);
	await page.close();

	return context;
}

/**
 * Setup multiple authenticated users in separate contexts
 */
export async function setupMultiUserContexts(
	browser: any,
	users: TestUser[],
	baseURL: string,
): Promise<{ contexts: BrowserContext[]; helpers: AuthHelper[] }> {
	const contexts: BrowserContext[] = [];
	const helpers: AuthHelper[] = [];

	for (const user of users) {
		const context = await createAuthenticatedContext(browser, user, baseURL);
		const page = await context.newPage();
		const helper = new AuthHelper(page);

		contexts.push(context);
		helpers.push(helper);
	}

	return { contexts, helpers };
}

/**
 * Test user factory with common test accounts
 */
export const TestUsers = {
	facilitator: {
		email: "facilitator@test.com",
		password: "password123",
		name: "Test Facilitator",
	},
	participant1: {
		email: "participant1@test.com",
		password: "password123",
		name: "Participant One",
	},
	participant2: {
		email: "participant2@test.com",
		password: "password123",
		name: "Participant Two",
	},
	admin: {
		email: "admin@test.com",
		password: "password123",
		name: "Test Admin",
	},
} as const;

/**
 * Get a test user with their database ID (queries database by email)
 */
export async function getTestUser(
	userKey: keyof typeof TestUsers,
): Promise<TestUser & { id: string }> {
	const userData = TestUsers[userKey];

	try {
		// First try to get from stored user IDs (from global setup)
		if (storedUserIds && storedUserIds[userKey]) {
			return {
				...userData,
				id: storedUserIds[userKey],
			};
		}

		// Fallback to database query
		const { db } = await import("../../../src/lib/server/db/index.js");
		const { users } = await import("../../../src/lib/server/db/schema.js");
		const { eq } = await import("drizzle-orm");

		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.email, userData.email));

		if (!user) {
			throw new Error(
				`Test user not found in database for ${userKey} (${userData.email}). Make sure global setup has run.`,
			);
		}

		return {
			...userData,
			id: user.id,
		};
	} catch (error) {
		throw new Error(
			`Failed to get test user ${userKey}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Get all test users with their database IDs
 */
export async function getAllTestUsers(): Promise<
	Record<string, TestUser & { id: string }>
> {
	const result: Record<string, TestUser & { id: string }> = {};

	for (const key of Object.keys(TestUsers) as (keyof typeof TestUsers)[]) {
		result[key] = await getTestUser(key);
	}

	return result;
}

// Storage for user IDs from global setup
let storedUserIds: Record<string, string> | null = null;

/**
 * Store the created test user IDs (called from global setup)
 */
export function setTestUserIds(userIds: Record<string, string>) {
	storedUserIds = userIds;
}

/**
 * Create an ad-hoc test user dynamically during a test
 * Useful when you need a fresh user that isn't one of the pre-defined test users
 */
export async function createAdHocTestUser(
	emailPrefix?: string,
): Promise<TestUser & { id: string }> {
	const timestamp = Date.now();
	const randomSuffix = Math.random().toString(36).substring(7);
	const prefix = emailPrefix || "adhoc";

	const email = `${prefix}-${timestamp}-${randomSuffix}@test.com`;
	const password = "password123";
	const name = `${prefix} Test User ${randomSuffix}`;

	const { TestDatabase } = await import("./test-db.js");
	const testDb = new TestDatabase(
		process.env.DATABASE_URL || "./teambeat-test.db",
	);

	try {
		const userId = await testDb.createTestUser(email, password, name);

		return {
			email,
			password,
			name,
			id: userId,
		};
	} catch (error) {
		throw new Error(
			`Failed to create ad-hoc test user: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}
