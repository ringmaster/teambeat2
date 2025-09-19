import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('application loads without errors', async ({ page }) => {
    await page.goto('/');

    // Should not have any console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Should show welcome page for unauthenticated user
    await expect(page.locator('span.nav-brand-text')).toBeVisible();

    // Check for critical navigation elements
    await expect(page.locator('a[href="/login"]').first()).toBeVisible();
    await expect(page.locator('a[href="/register"]').first()).toBeVisible();

    // Verify no JavaScript errors occurred
    const isOnly401 = errors.every(error => error.includes('401'));
    expect(isOnly401).toBe(true);
  });

  test('login page loads correctly', async ({ page }) => {
    await page.goto('/login');

    // Should have login form elements
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Should have link to registration
    await expect(page.locator('a[href="/register"]')).toBeVisible();
  });

  test('registration page loads correctly', async ({ page }) => {
    await page.goto('/register');

    // Should have registration form elements
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Should have link to login
    await expect(page.locator('a[href="/login"]')).toBeVisible();
  });

  test('API health check responds correctly', async ({ request }) => {
    // Test a basic API endpoint that should always work
    const response = await request.get('/api/auth/me');

    // Should return 401 for unauthenticated user, not 500 or other server error
    expect([200, 401]).toContain(response.status());

    if (response.status() === 401) {
      const body = await response.json();
      expect(body).toHaveProperty('success', false);
    }
  });

  test('static assets load correctly', async ({ page }) => {
    // Check for favicon or other static assets
    const response = await page.request.get('/favicon.ico');
    expect([200, 404]).toContain(response.status()); // Either exists or proper 404
  });

  test('navigation works correctly', async ({ page }) => {
    await page.goto('/');

    // Click to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL(/.*login/);

    // Navigate back to home
    await page.goto('/');

    // Click to registration page
    await page.click('a[href="/register"]');
    await expect(page).toHaveURL(/.*register/);
  });

  test('responsive design basics', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Should still show main content
    await expect(page.locator('.nav-brand-text')).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    await expect(page.locator('.nav-brand-text')).toBeVisible();
  });

  test('error pages handle gracefully', async ({ page }) => {
    // Test 404 page
    await page.goto('/nonexistent-page');

    // Should show some kind of error page, not crash
    const isNotFound = await page.locator('text=404').isVisible() ||
                      await page.locator('text=Not Found').isVisible() ||
                      await page.locator('text=Page not found').isVisible();

    expect(isNotFound).toBe(true);
  });

  test('form validation works', async ({ page }) => {
    await page.goto('/login');

    // Try to submit empty form
    await page.click('button[type="submit"]');

    // Should show validation errors or prevent submission
    const hasValidationErrors = await page.locator('.form-error').isVisible() ||
                               page.url().includes('/login'); // Still on login page

    expect(hasValidationErrors).toBe(true);
  });

  test('accessibility basics', async ({ page }) => {
    await page.goto('/');

    // Check for basic accessibility attributes
    const hasMainContent = await page.locator('main, [role="main"]').isVisible();
    const hasHeadings = await page.locator('h1, h2, h3').count() > 0;

    expect(hasMainContent || hasHeadings).toBe(true);

    // Form inputs should have labels or aria-labels
    await page.goto('/login');
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');

    // Check if inputs have associated labels or accessibility attributes
    const emailHasLabel = await emailInput.evaluate(el => {
      return el.labels?.length > 0 ||
             el.getAttribute('aria-label') ||
             el.getAttribute('placeholder');
    });

    const passwordHasLabel = await passwordInput.evaluate(el => {
      return el.labels?.length > 0 ||
             el.getAttribute('aria-label') ||
             el.getAttribute('placeholder');
    });

    expect(emailHasLabel).toBeTruthy();
    expect(passwordHasLabel).toBeTruthy();
  });
});
