import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as Login } from '../../../src/routes/api/auth/login/+server';
import { POST as Register } from '../../../src/routes/api/auth/register/+server';
import { POST as Logout } from '../../../src/routes/api/auth/logout/+server';
import { POST as ChangePassword } from '../../../src/routes/api/auth/change-password/+server';
import { createMockRequestEvent } from '../helpers/mock-request';

// Mock auth modules
vi.mock('../../../src/lib/server/repositories/user', () => ({
	findUserByEmail: vi.fn(),
	createUser: vi.fn(),
	updateUserPassword: vi.fn()
}));

vi.mock('../../../src/lib/server/auth/password', () => ({
	verifyPassword: vi.fn(),
	hashPassword: vi.fn()
}));

vi.mock('../../../src/lib/server/auth/session', () => ({
	createSession: vi.fn(),
	deleteSession: vi.fn(),
	getSession: vi.fn()
}));

vi.mock('../../../src/lib/server/repositories/session', () => ({
	getSessionFromCookie: vi.fn()
}));

vi.mock('../../../src/lib/server/auth/index', () => ({
	setSessionCookie: vi.fn(),
	clearSessionCookie: vi.fn(),
	requireUser: vi.fn()
}));

vi.mock('bcryptjs', () => ({
	default: {
		compare: vi.fn(),
		hash: vi.fn()
	}
}));

vi.mock('../../../src/lib/server/db', () => ({
	db: {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: vi.fn(() => Promise.resolve([]))
				}))
			}))
		})),
		update: vi.fn(() => ({
			set: vi.fn(() => ({
				where: vi.fn(() => Promise.resolve())
			}))
		}))
	}
}));

// Import mocked modules
import { findUserByEmail, createUser, updateUserPassword } from '../../../src/lib/server/repositories/user';
import { verifyPassword, hashPassword } from '../../../src/lib/server/auth/password';
import { createSession, deleteSession, getSession } from '../../../src/lib/server/auth/session';
import { getSessionFromCookie } from '../../../src/lib/server/repositories/session';
import { setSessionCookie, clearSessionCookie, requireUser } from '../../../src/lib/server/auth/index';
import { db } from '../../../src/lib/server/db';
import bcrypt from 'bcryptjs';

describe('POST /api/auth/login', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should login successfully with valid credentials', async () => {
		const mockUser = {
			id: 'user-1',
			email: 'test@example.com',
			name: 'Test User',
			passwordHash: 'hashed-password'
		};

		vi.mocked(findUserByEmail).mockResolvedValue(mockUser);
		vi.mocked(verifyPassword).mockReturnValue(true);
		vi.mocked(createSession).mockReturnValue('session-123');

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/auth/login',
			body: {
				email: 'test@example.com',
				password: 'password123'
			}
		});

		const response = await Login(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(data.user).toEqual({
			id: 'user-1',
			email: 'test@example.com',
			name: 'Test User'
		});
		expect(setSessionCookie).toHaveBeenCalledWith(event, 'session-123');
	});

	it('should fail with invalid email', async () => {
		vi.mocked(findUserByEmail).mockResolvedValue(null);

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/auth/login',
			body: {
				email: 'wrong@example.com',
				password: 'password123'
			}
		});

		const response = await Login(event);
		const data = await response.json();

		expect(response.status).toBe(401);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Invalid email or password');
	});

	it('should fail with invalid password', async () => {
		const mockUser = {
			id: 'user-1',
			email: 'test@example.com',
			name: 'Test User',
			passwordHash: 'hashed-password'
		};

		vi.mocked(findUserByEmail).mockResolvedValue(mockUser);
		vi.mocked(verifyPassword).mockReturnValue(false);

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/auth/login',
			body: {
				email: 'test@example.com',
				password: 'wrong-password'
			}
		});

		const response = await Login(event);
		const data = await response.json();

		expect(response.status).toBe(401);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Invalid email or password');
	});

	it('should validate email format', async () => {
		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/auth/login',
			body: {
				email: 'not-an-email',
				password: 'password123'
			}
		});

		const response = await Login(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Invalid input');
	});
});

describe('POST /api/auth/register', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should register new user successfully', async () => {
		const mockUser = {
			id: 'user-1',
			email: 'newuser@example.com',
			name: 'New User',
			passwordHash: 'hashed-password',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		vi.mocked(createUser).mockResolvedValue(mockUser);
		vi.mocked(createSession).mockReturnValue('session-123');

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/auth/register',
			body: {
				email: 'newuser@example.com',
				name: 'New User',
				password: 'password123'
			}
		});

		const response = await Register(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(data.user).toEqual({
			id: 'user-1',
			email: 'newuser@example.com',
			name: 'New User'
		});
		expect(setSessionCookie).toHaveBeenCalledWith(event, 'session-123');
	});

	it('should require minimum password length', async () => {
		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/auth/register',
			body: {
				email: 'test@example.com',
				password: '12345' // Too short
			}
		});

		const response = await Register(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Invalid input');
	});

	it('should validate email format', async () => {
		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/auth/register',
			body: {
				email: 'invalid-email',
				password: 'password123'
			}
		});

		const response = await Register(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Invalid input');
	});

	it('should handle duplicate email error', async () => {
		vi.mocked(createUser).mockRejectedValue(new Error('Email already exists'));

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/auth/register',
			body: {
				email: 'existing@example.com',
				password: 'password123'
			}
		});

		const response = await Register(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Registration failed');
	});
});

describe('POST /api/auth/logout', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should logout successfully', async () => {
		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/auth/logout'
		});

		event.cookies.get = vi.fn(() => 'session-123');
		event.cookies.delete = vi.fn();

		const response = await Logout(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(deleteSession).toHaveBeenCalledWith('session-123');
		expect(event.cookies.delete).toHaveBeenCalledWith('session', { path: '/' });
	});

	it('should handle logout without session', async () => {
		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/auth/logout'
		});

		event.cookies.get = vi.fn(() => undefined);
		event.cookies.delete = vi.fn();

		const response = await Logout(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(event.cookies.delete).toHaveBeenCalledWith('session', { path: '/' });
	});
});

describe('POST /api/auth/change-password', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should change password successfully', async () => {
		const mockSession = {
			userId: 'user-1',
			email: 'test@example.com',
			expiresAt: Date.now() + 100000
		};

		const mockUser = {
			id: 'user-1',
			email: 'test@example.com',
			name: 'Test User',
			passwordHash: 'old-hashed-password'
		};

		vi.mocked(getSessionFromCookie).mockResolvedValue(mockSession);
		vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
		vi.mocked(bcrypt.hash).mockResolvedValue('new-hashed-password' as never);

		// Mock the select chain
		vi.mocked(db.select).mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: vi.fn(() => Promise.resolve([mockUser]))
				}))
			}))
		} as any);

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/auth/change-password',
			body: {
				currentPassword: 'oldpassword',
				newPassword: 'newpassword123'
			}
		});

		event.cookies.get = vi.fn(() => 'session-123');

		const response = await ChangePassword(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(bcrypt.compare).toHaveBeenCalledWith('oldpassword', 'old-hashed-password');
		expect(db.update).toHaveBeenCalled();
	});

	it('should fail with incorrect current password', async () => {
		const mockSession = {
			userId: 'user-1',
			email: 'test@example.com',
			expiresAt: Date.now() + 100000
		};

		const mockUser = {
			id: 'user-1',
			email: 'test@example.com',
			name: 'Test User',
			passwordHash: 'hashed-password'
		};

		vi.mocked(getSessionFromCookie).mockResolvedValue(mockSession);
		vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

		vi.mocked(db.select).mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: vi.fn(() => Promise.resolve([mockUser]))
				}))
			}))
		} as any);

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/auth/change-password',
			body: {
				currentPassword: 'wrongpassword',
				newPassword: 'newpassword123'
			}
		});

		event.cookies.get = vi.fn(() => 'session-123');

		const response = await ChangePassword(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toBe('Current password is incorrect');
	});

	it('should require minimum password length for new password', async () => {
		const mockSession = {
			userId: 'user-1',
			email: 'test@example.com',
			expiresAt: Date.now() + 100000
		};

		vi.mocked(getSessionFromCookie).mockResolvedValue(mockSession);

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/auth/change-password',
			body: {
				currentPassword: 'oldpassword',
				newPassword: '123' // Too short
			}
		});

		event.cookies.get = vi.fn(() => 'session-123');

		const response = await ChangePassword(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toBe('Invalid input');
	});
});
