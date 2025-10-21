import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUT as AdminVerifyUser } from '../../../src/routes/api/admin/users/[userId]/verify/+server';
import { createMockRequestEvent } from '../helpers/mock-request';

// Mock auth modules
vi.mock('../../../src/lib/server/auth/index', () => ({
	getUser: vi.fn()
}));

// Mock user repository
vi.mock('../../../src/lib/server/repositories/user', () => ({
	findUserById: vi.fn(),
	setEmailVerified: vi.fn()
}));

// Import mocked modules
import { getUser } from '../../../src/lib/server/auth/index';
import { findUserById, setEmailVerified } from '../../../src/lib/server/repositories/user';

describe('PUT /api/admin/users/[userId]/verify', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Mock console methods to prevent output during tests
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(console, 'log').mockImplementation(() => {});
	});

	it('should return 401 if user is not authenticated', async () => {
		vi.mocked(getUser).mockReturnValue(null);

		const event = createMockRequestEvent({
			method: 'PUT',
			params: { userId: 'target-user-1' },
			body: { verified: true }
		});

		const response = await AdminVerifyUser(event);
		const data = await response.json();

		expect(response.status).toBe(401);
		expect(data.error).toBe('Unauthorized');
		expect(setEmailVerified).not.toHaveBeenCalled();
	});

	it('should return 403 if user is not an admin', async () => {
		vi.mocked(getUser).mockReturnValue({
			userId: 'user-1',
			email: 'user@example.com',
			expiresAt: Date.now() + 1000000
		});
		vi.mocked(findUserById).mockResolvedValue({
			id: 'user-1',
			email: 'user@example.com',
			emailVerified: true,
			emailVerificationSecret: 'secret-123',
			name: 'Regular User',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			passwordHash: 'hash',
			is_admin: false, // NOT an admin
			role: 'user'
		});

		const event = createMockRequestEvent({
			method: 'PUT',
			params: { userId: 'target-user-1' },
			body: { verified: true }
		});

		const response = await AdminVerifyUser(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.error).toBe('Unauthorized');
		expect(findUserById).toHaveBeenCalledWith('user-1');
		expect(setEmailVerified).not.toHaveBeenCalled();
	});

	it('should return 403 if session user does not exist in database', async () => {
		vi.mocked(getUser).mockReturnValue({
			userId: 'nonexistent-user',
			email: 'ghost@example.com',
			expiresAt: Date.now() + 1000000
		});
		vi.mocked(findUserById).mockResolvedValue(null);

		const event = createMockRequestEvent({
			method: 'PUT',
			params: { userId: 'target-user-1' },
			body: { verified: true }
		});

		const response = await AdminVerifyUser(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.error).toBe('Unauthorized');
		expect(setEmailVerified).not.toHaveBeenCalled();
	});

	it('should return 400 if verified field is missing', async () => {
		vi.mocked(getUser).mockReturnValue({
			userId: 'admin-1',
			email: 'admin@example.com',
			expiresAt: Date.now() + 1000000
		});
		vi.mocked(findUserById).mockResolvedValue({
			id: 'admin-1',
			email: 'admin@example.com',
			emailVerified: true,
			emailVerificationSecret: 'secret-123',
			name: 'Admin User',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			passwordHash: 'hash',
			is_admin: true,
			role: 'admin'
		});

		const event = createMockRequestEvent({
			method: 'PUT',
			params: { userId: 'target-user-1' },
			body: {} // Missing verified field
		});

		const response = await AdminVerifyUser(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toBe('Invalid request: verified must be a boolean');
		expect(setEmailVerified).not.toHaveBeenCalled();
	});

	it('should return 400 if verified is not a boolean', async () => {
		vi.mocked(getUser).mockReturnValue({
			userId: 'admin-1',
			email: 'admin@example.com',
			expiresAt: Date.now() + 1000000
		});
		vi.mocked(findUserById).mockResolvedValue({
			id: 'admin-1',
			email: 'admin@example.com',
			emailVerified: true,
			emailVerificationSecret: 'secret-123',
			name: 'Admin User',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			passwordHash: 'hash',
			is_admin: true,
			role: 'admin'
		});

		const event = createMockRequestEvent({
			method: 'PUT',
			params: { userId: 'target-user-1' },
			body: { verified: 'yes' } // String instead of boolean
		});

		const response = await AdminVerifyUser(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toBe('Invalid request: verified must be a boolean');
		expect(setEmailVerified).not.toHaveBeenCalled();
	});

	it('should verify user successfully when admin sets verified=true', async () => {
		vi.mocked(getUser).mockReturnValue({
			userId: 'admin-1',
			email: 'admin@example.com',
			expiresAt: Date.now() + 1000000
		});
		vi.mocked(findUserById).mockResolvedValue({
			id: 'admin-1',
			email: 'admin@example.com',
			emailVerified: true,
			emailVerificationSecret: 'secret-123',
			name: 'Admin User',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			passwordHash: 'hash',
			is_admin: true,
			role: 'admin'
		});
		vi.mocked(setEmailVerified).mockResolvedValue(undefined);

		const event = createMockRequestEvent({
			method: 'PUT',
			params: { userId: 'target-user-1' },
			body: { verified: true }
		});

		const response = await AdminVerifyUser(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.message).toBe('User email verification set to true');
		expect(setEmailVerified).toHaveBeenCalledWith('target-user-1', true);
	});

	it('should unverify user successfully when admin sets verified=false', async () => {
		vi.mocked(getUser).mockReturnValue({
			userId: 'admin-1',
			email: 'admin@example.com',
			expiresAt: Date.now() + 1000000
		});
		vi.mocked(findUserById).mockResolvedValue({
			id: 'admin-1',
			email: 'admin@example.com',
			emailVerified: true,
			emailVerificationSecret: 'secret-123',
			name: 'Admin User',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			passwordHash: 'hash',
			is_admin: true,
			role: 'admin'
		});
		vi.mocked(setEmailVerified).mockResolvedValue(undefined);

		const event = createMockRequestEvent({
			method: 'PUT',
			params: { userId: 'target-user-1' },
			body: { verified: false }
		});

		const response = await AdminVerifyUser(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.message).toBe('User email verification set to false');
		expect(setEmailVerified).toHaveBeenCalledWith('target-user-1', false);
	});

	it('should return 500 if database operation fails', async () => {
		vi.mocked(getUser).mockReturnValue({
			userId: 'admin-1',
			email: 'admin@example.com',
			expiresAt: Date.now() + 1000000
		});
		vi.mocked(findUserById).mockResolvedValue({
			id: 'admin-1',
			email: 'admin@example.com',
			emailVerified: true,
			emailVerificationSecret: 'secret-123',
			name: 'Admin User',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			passwordHash: 'hash',
			is_admin: true,
			role: 'admin'
		});
		vi.mocked(setEmailVerified).mockRejectedValue(new Error('Database error'));

		const event = createMockRequestEvent({
			method: 'PUT',
			params: { userId: 'target-user-1' },
			body: { verified: true }
		});

		const response = await AdminVerifyUser(event);
		const data = await response.json();

		expect(response.status).toBe(500);
		expect(data.error).toBe('Failed to update email verification');
	});

	it('should allow admin to verify themselves', async () => {
		vi.mocked(getUser).mockReturnValue({
			userId: 'admin-1',
			email: 'admin@example.com',
			expiresAt: Date.now() + 1000000
		});
		vi.mocked(findUserById).mockResolvedValue({
			id: 'admin-1',
			email: 'admin@example.com',
			emailVerified: false,
			emailVerificationSecret: 'secret-123',
			name: 'Admin User',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			passwordHash: 'hash',
			is_admin: true,
			role: 'admin'
		});
		vi.mocked(setEmailVerified).mockResolvedValue(undefined);

		const event = createMockRequestEvent({
			method: 'PUT',
			params: { userId: 'admin-1' }, // Same as logged-in user
			body: { verified: true }
		});

		const response = await AdminVerifyUser(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(setEmailVerified).toHaveBeenCalledWith('admin-1', true);
	});
});
