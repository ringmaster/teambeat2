import { expect, test } from "@playwright/test";
import { AuthHelper, getTestUser, TestUsers } from "./fixtures/auth-helpers";

test.describe("Authentication", () => {
	test.beforeEach(async ({ page }) => {
		const auth = new AuthHelper(page);
		await auth.ensureLoggedOut();
	});

	test("should display welcome page for unauthenticated users", async ({
		page,
	}) => {
		await page.goto("/");

		// Should show welcome page, not dashboard
		await expect(page.locator("text=Welcome")).toBeVisible();
	});

	test("should login with valid credentials", async ({ page }) => {
		const auth = new AuthHelper(page);

		// Navigate to login page
		await page.goto("/login");

		// Fill and submit login form
		const facilitator = await getTestUser("facilitator");
		await page.fill("input#email", facilitator.email);
		await page.fill("input#password", facilitator.password);
		await page.click('button[type="submit"]');

		// Should redirect to root/dashboard
		await page.waitForURL(/\/$/);

		// Verify user is logged in
		expect(await auth.isLoggedIn()).toBe(true);

		// Should show dashboard content (Your Series heading)
		await expect(page.locator("text=Your Series")).toBeVisible();
	});

	test("should show error for invalid credentials", async ({ page }) => {
		await page.goto("/login");

		await page.fill("input#email", "invalid@example.com");
		await page.fill("input#password", "wrongpassword");
		await page.click('button[type="submit"]');

		// Should show error message
		await expect(page.locator("text=Invalid email or password")).toBeVisible();

		// Should remain on login page
		expect(page.url()).toContain("/login");
	});

	test("should register new user", async ({ page }) => {
		const auth = new AuthHelper(page);
		const testEmail = `newuser-${Date.now()}@test.com`;

		await page.goto("/register");

		await page.fill("input#email", testEmail);
		await page.fill("input#name", "New Test User");
		await page.fill("input#password", "password123");
		await page.fill("input#confirmPassword", "password123");
		await page.click('button[type="submit"]');

		// Should redirect to dashboard after registration
		await page.waitForURL(/\/(dashboard)?$/);

		// Verify user is logged in
		expect(await auth.isLoggedIn()).toBe(true);

		const currentUser = await auth.getCurrentUser();
		expect(currentUser.user.email).toBe(testEmail);
	});

	test("should show error for mismatched passwords", async ({ page }) => {
		await page.goto("/register");

		await page.fill("input#email", "test@example.com");
		await page.fill("input#name", "Test User");
		await page.fill("input#password", "password123");
		await page.fill("input#confirmPassword", "differentpassword");
		await page.click('button[type="submit"]');

		// Should show password mismatch error
		await expect(page.locator("text=Passwords do not match")).toBeVisible();
	});

	test("should show error for duplicate email", async ({ page }) => {
		await page.goto("/register");

		// Try to register with existing email
		const facilitator = await getTestUser("facilitator");
		await page.fill("input#email", facilitator.email);
		await page.fill("input#name", "Another User");
		await page.fill("input#password", "password123abc");
		await page.fill("input#confirmPassword", "password123abc");
		await page.click('button[type="submit"]');

		// Should show duplicate email error
		await expect(page.locator("text=Registration failed")).toBeVisible();
	});

	test("should logout successfully", async ({ page }) => {
		const auth = new AuthHelper(page);

		// Login first
		const facilitator = await getTestUser("facilitator");
		await auth.loginViaAPI(facilitator.email, facilitator.password);
		await page.goto("/");

		// Should show dashboard
		await expect(page.locator("text=Your Series")).toBeVisible();

		// Hover over avatar to show dropdown, then click Sign Out
		await page.hover(".avatar-dropdown-trigger");
		await page.click("text=Sign Out");

		// Should redirect to welcome page
		await page.waitForURL(/\/$/);
		await expect(page.locator("text=Welcome to TeamBeat")).toBeVisible();

		// Verify user is logged out
		expect(await auth.isLoggedIn()).toBe(false);
	});

	test("should redirect to login when accessing protected pages while logged out", async ({
		page,
	}) => {
		// Try to access a protected page
		await page.goto("/profile");

		// Should redirect to login
		await page.waitForURL("/login");
		expect(page.url()).toContain("/login");
	});

	test("should redirect authenticated users away from login page", async ({
		page,
	}) => {
		const auth = new AuthHelper(page);

		// Login first
		const facilitator = await getTestUser("facilitator");
		await auth.loginViaAPI(facilitator.email, facilitator.password);

		// Try to access login page
		await page.goto("/login");

		// Should redirect to dashboard
		await page.waitForURL(/\/$/);
	});

	test("should maintain session across page refreshes", async ({ page }) => {
		const auth = new AuthHelper(page);

		// Login and navigate to dashboard
		const facilitator = await getTestUser("facilitator");
		await auth.loginViaAPI(facilitator.email, facilitator.password);
		await page.goto("/");

		await expect(page.locator("text=Your Series")).toBeVisible();

		// Refresh the page
		await page.reload();

		// Should still be logged in
		await expect(page.locator("text=Your Series")).toBeVisible();
		expect(await auth.isLoggedIn()).toBe(true);
	});

	test("should handle session expiration gracefully", async ({ page }) => {
		const auth = new AuthHelper(page);

		// Login first
		const facilitator = await getTestUser("facilitator");
		await auth.loginViaAPI(facilitator.email, facilitator.password);
		await page.goto("/");

		// Manually expire session by calling logout API
		await auth.logoutViaAPI();

		// Try to access a protected API endpoint
		const response = await page.request.get("/api/auth/me");
		expect(response.status()).toBe(401);

		// Navigation to protected page should redirect to login
		await page.goto("/profile");
		await page.waitForURL("/login");
	});
});
