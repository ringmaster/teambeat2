import { Page, BrowserContext } from '@playwright/test';

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
    await this.page.goto('/login');

    await this.page.fill('input#email', email);
    await this.page.fill('input#password', password);
    await this.page.click('button[type="submit"]');

    // Wait for redirect to dashboard or home
    await this.page.waitForURL(/\/(dashboard)?$/);
  }

  /**
   * Register a new user via the registration form
   */
  async register(email: string, password: string, name: string) {
    await this.page.goto('/register');

    await this.page.fill('input#email', email);
    await this.page.fill('input#name', name);
    await this.page.fill('input#password"]', password);
    await this.page.fill('input#confirmPassword', password);
    await this.page.click('button[type="submit"]');

    // Wait for redirect to dashboard after successful registration
    await this.page.waitForURL(/\/(dashboard)?$/);
  }

  /**
   * Login via API call (faster for setup)
   */
  async loginViaAPI(email: string, password: string) {
    const response = await this.page.request.post('/api/auth/login', {
      data: { email, password }
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
    // Look for logout button/link in navigation
    await this.page.click('[data-testid="logout-button"], a[href*="logout"]');

    // Wait for redirect to login or welcome page
    await this.page.waitForURL(/\/(login|welcome)?$/);
  }

  /**
   * Logout via API call
   */
  async logoutViaAPI() {
    await this.page.request.post('/api/auth/logout');
  }

  /**
   * Check if user is currently logged in
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      const response = await this.page.request.get('/api/auth/me');
      return response.ok();
    } catch {
      return false;
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser() {
    const response = await this.page.request.get('/api/auth/me');
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
  baseURL: string
): Promise<BrowserContext> {
  const context = await browser.newContext({
    baseURL
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
  baseURL: string
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
    email: 'facilitator@test.com',
    password: 'password123',
    name: 'Test Facilitator'
  },
  participant1: {
    email: 'participant1@test.com',
    password: 'password123',
    name: 'Participant One'
  },
  participant2: {
    email: 'participant2@test.com',
    password: 'password123',
    name: 'Participant Two'
  },
  admin: {
    email: 'admin@test.com',
    password: 'password123',
    name: 'Test Admin'
  }
} as const;
