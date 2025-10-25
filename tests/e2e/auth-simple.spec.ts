import { expect, test } from "@playwright/test";

test.describe("Simple Authentication Tests", () => {
	test.beforeEach(async ({ page }) => {
		// Clear any existing sessions
		await page.context().clearCookies();
	});

	test("should load login page correctly", async ({ page }) => {
		await page.goto("/login");

		// Check that login page elements are present
		await expect(page.locator('h2:has-text("Welcome back")')).toBeVisible();
		await expect(page.locator("#email")).toBeVisible();
		await expect(page.locator("#password")).toBeVisible();
		await expect(page.locator('button[type="submit"]')).toBeVisible();

		// Check navigation link to register
		await expect(page.locator('a[href="/register"]').first()).toBeVisible();
	});

	test("should load registration page correctly", async ({ page }) => {
		await page.goto("/register");

		// Check that registration page elements are present
		await expect(page.locator('h2:has-text("Get Started")')).toBeVisible();
		await expect(page.locator("#email")).toBeVisible();
		await expect(page.locator("#name")).toBeVisible();
		await expect(page.locator("#password")).toBeVisible();
		await expect(page.locator("#confirmPassword")).toBeVisible();
		await expect(page.locator('button[type="submit"]')).toBeVisible();

		// Check navigation link to login
		await expect(page.locator('a[href="/login"]').first()).toBeVisible();
	});

	test("should show error for invalid login credentials", async ({ page }) => {
		await page.goto("/login");

		// Try to login with invalid credentials
		await page.fill("#email", "invalid@example.com");
		await page.fill("#password", "wrongpassword");
		await page.click('button[type="submit"]');

		// Should show error message
		await expect(page.locator(".form-error")).toBeVisible();
		await expect(page.locator("text=Invalid email or password")).toBeVisible();

		// Should remain on login page
		expect(page.url()).toContain("/login");
	});

	test("should register a new user successfully", async ({ page }) => {
		const testEmail = `test-${Date.now()}@example.com`;

		await page.goto("/register");

		// Fill out registration form
		await page.fill("#email", testEmail);
		await page.fill("#name", "Test User");
		await page.fill("#password", "password123");
		await page.fill("#confirmPassword", "password123");

		// Submit form
		await page.click('button[type="submit"]');

		// Should redirect to home page after successful registration
		await page.waitForURL("/", { timeout: 10000 });

		// Should show dashboard or welcome content for logged-in user
		await expect(
			page.locator("text=Test User").or(page.locator(".nav-brand-text")),
		).toBeVisible();
	});

	test("should show error for mismatched passwords during registration", async ({
		page,
	}) => {
		await page.goto("/register");

		// Fill form with mismatched passwords
		await page.fill("#email", "test@example.com");
		await page.fill("#name", "Test User");
		await page.fill("#password", "password123");
		await page.fill("#confirmPassword", "differentpassword");

		await page.click('button[type="submit"]');

		// Should show password mismatch error
		await expect(page.locator(".form-error")).toBeVisible();
		await expect(
			page
				.locator("text=Passwords do not match")
				.or(page.locator("text=Password confirmation does not match")),
		).toBeVisible();
	});

	test("should navigate between login and register pages", async ({ page }) => {
		// Start at login
		await page.goto("/login");
		await expect(page.locator('h2:has-text("Welcome back")')).toBeVisible();

		// Navigate to register
		await page.locator('a[href="/register"]').first().click();
		await expect(page).toHaveURL(/.*register/);
		await expect(page.locator('h2:has-text("Get Started")')).toBeVisible();

		// Navigate back to login
		await page.click('a[href="/login"]');
		await expect(page).toHaveURL(/.*login/);
		await expect(page.locator('h2:has-text("Welcome back")')).toBeVisible();
	});

	test("should redirect to login when accessing protected pages", async ({
		page,
	}) => {
		// Try to access a protected page without being logged in
		const response = await page.goto("/profile");

		// Should either redirect to login or return 401/403
		const currentUrl = page.url();
		const isRedirectedToLogin = currentUrl.includes("/login");
		const isUnauthorized = response && [401, 403].includes(response.status());

		expect(isRedirectedToLogin || isUnauthorized).toBe(true);
	});
});
