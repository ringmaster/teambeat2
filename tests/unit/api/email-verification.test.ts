import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as GetEmailConfig } from '../../../src/routes/api/auth/email-config/+server';
import { POST as SendVerificationEmail } from '../../../src/routes/api/auth/send-verification-email/+server';
import { POST as VerifyEmail } from '../../../src/routes/api/auth/verify-email/+server';
import { createMockRequestEvent } from '../helpers/mock-request';

// Note: Environment variables need to be set before modules are imported
// The EMAIL_PROVIDER is read at module load time in the actual endpoints

// Mock auth modules
vi.mock('../../../src/lib/server/auth/index', () => ({
	getUser: vi.fn()
}));

// Mock email modules
vi.mock('../../../src/lib/server/email/index', () => ({
	emailService: {
		send: vi.fn()
	},
	isEmailConfigured: true
}));

// Mock user repository
vi.mock('../../../src/lib/server/repositories/user', () => ({
	findUserById: vi.fn(),
	getUserById: vi.fn(),
	markEmailVerified: vi.fn(),
	ensureEmailVerificationSecret: vi.fn()
}));

// Mock email verification
vi.mock('../../../src/lib/server/auth/email-verification', () => ({
	generateEmailVerificationToken: vi.fn(),
	validateEmailVerificationToken: vi.fn()
}));

// Import mocked modules
import { getUser } from '../../../src/lib/server/auth/index';
import { emailService } from '../../../src/lib/server/email/index';
import { findUserById, getUserById, markEmailVerified, ensureEmailVerificationSecret } from '../../../src/lib/server/repositories/user';
import {
	generateEmailVerificationToken,
	validateEmailVerificationToken
} from '../../../src/lib/server/auth/email-verification';

describe('GET /api/auth/email-config', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Mock console methods to prevent output during tests
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(console, 'log').mockImplementation(() => {});
	});

	it('should return success with isEmailConfigured boolean', async () => {
		const event = createMockRequestEvent({});

		const response = await GetEmailConfig(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toHaveProperty('success', true);
		expect(data).toHaveProperty('isEmailConfigured');
		expect(typeof data.isEmailConfigured).toBe('boolean');
	});
});

describe('POST /api/auth/send-verification-email', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Mock console methods to prevent output during tests
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(console, 'log').mockImplementation(() => {});
	});

	it('should return 401 if user is not authenticated', async () => {
		vi.mocked(getUser).mockReturnValue(null);

		const event = createMockRequestEvent({});

		const response = await SendVerificationEmail(event);
		const data = await response.json();

		expect(response.status).toBe(401);
		expect(data.error).toBe('Not authenticated');
	});


	it('should return 400 if user is already verified', async () => {
		vi.mocked(getUser).mockReturnValue({
			userId: 'user-1',
			email: 'test@example.com',
			expiresAt: Date.now() + 1000000
		});
		vi.mocked(findUserById).mockResolvedValue({
			id: 'user-1',
			email: 'test@example.com',
			emailVerified: true,
			emailVerificationSecret: 'secret-123',
			name: 'Test User',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			passwordHash: 'hash',
			is_admin: false,
			role: 'user'
		});

		const event = createMockRequestEvent({});

		const response = await SendVerificationEmail(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toBe('Email already verified');
	});

	it('should send verification email successfully for unverified user', async () => {
		vi.mocked(getUser).mockReturnValue({
			userId: 'user-1',
			email: 'test@example.com',
			expiresAt: Date.now() + 1000000
		});
		vi.mocked(findUserById).mockResolvedValue({
			id: 'user-1',
			email: 'test@example.com',
			emailVerified: false,
			emailVerificationSecret: 'secret-123',
			name: 'Test User',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			passwordHash: 'hash',
			is_admin: false,
			role: 'user'
		});
		vi.mocked(ensureEmailVerificationSecret).mockResolvedValue('secret-123');
		vi.mocked(generateEmailVerificationToken).mockReturnValue('token-123');
		vi.mocked(emailService.send).mockResolvedValue({ success: true });

		const event = createMockRequestEvent({});

		const response = await SendVerificationEmail(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.message).toBe('Verification email sent');
		expect(ensureEmailVerificationSecret).toHaveBeenCalledWith('user-1');
		expect(emailService.send).toHaveBeenCalledWith(
			expect.objectContaining({
				to: 'test@example.com',
				subject: 'Verify your TeamBeat email address'
			})
		);
	});

	it('should generate secret if user has no emailVerificationSecret', async () => {
		vi.mocked(getUser).mockReturnValue({
			userId: 'user-1',
			email: 'test@example.com',
			expiresAt: Date.now() + 1000000
		});
		vi.mocked(findUserById).mockResolvedValue({
			id: 'user-1',
			email: 'test@example.com',
			emailVerified: false,
			emailVerificationSecret: null, // No secret set
			name: 'Test User',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			passwordHash: 'hash',
			is_admin: false,
			role: 'user'
		});
		// ensureEmailVerificationSecret generates a new secret
		vi.mocked(ensureEmailVerificationSecret).mockResolvedValue('newly-generated-secret');
		vi.mocked(generateEmailVerificationToken).mockReturnValue('token-456');
		vi.mocked(emailService.send).mockResolvedValue({ success: true });

		const event = createMockRequestEvent({});

		const response = await SendVerificationEmail(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.message).toBe('Verification email sent');
		expect(ensureEmailVerificationSecret).toHaveBeenCalledWith('user-1');
		expect(generateEmailVerificationToken).toHaveBeenCalledWith('user-1', 'newly-generated-secret');
		expect(emailService.send).toHaveBeenCalled();
	});
});

describe('POST /api/auth/verify-email', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Mock console methods to prevent output during tests
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(console, 'log').mockImplementation(() => {});
	});

	it('should return 400 if token is missing', async () => {
		const event = createMockRequestEvent({
			method: 'POST',
			body: {}
		});

		const response = await VerifyEmail(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toBe('Invalid request');
	});

	it('should return 400 if token is invalid', async () => {
		vi.mocked(validateEmailVerificationToken).mockResolvedValue({
			valid: false,
			error: 'Invalid signature'
		});

		const event = createMockRequestEvent({
			method: 'POST',
			body: { token: 'invalid-token' }
		});

		const response = await VerifyEmail(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toBe('Invalid verification link.');
	});

	it('should return 400 if token is expired', async () => {
		vi.mocked(validateEmailVerificationToken).mockResolvedValue({
			valid: false,
			error: 'Token expired'
		});

		const event = createMockRequestEvent({
			method: 'POST',
			body: { token: 'expired-token' }
		});

		const response = await VerifyEmail(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toBe('Verification link expired. Please request a new one.');
	});

	it('should verify email successfully with valid token', async () => {
		vi.mocked(validateEmailVerificationToken).mockResolvedValue({
			valid: true,
			userId: 'user-1'
		});
		vi.mocked(markEmailVerified).mockResolvedValue(undefined);

		const event = createMockRequestEvent({
			method: 'POST',
			body: { token: 'valid-token' }
		});

		const response = await VerifyEmail(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.message).toBe('Email verified successfully');
		expect(markEmailVerified).toHaveBeenCalledWith('user-1');
	});
});
