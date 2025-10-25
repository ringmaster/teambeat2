import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../../../src/routes/api/series/+server';
import { createMockRequestEvent } from '../helpers/mock-request';

// Mock the auth module
vi.mock('../../../src/lib/server/auth/index', () => ({
	requireUserForApi: vi.fn()
}));

// Mock the repository functions
vi.mock('../../../src/lib/server/repositories/board-series', () => ({
	createBoardSeries: vi.fn(),
	findSeriesWithBoardsByUser: vi.fn()
}));

vi.mock('../../../src/lib/server/repositories/user', () => ({
	findUserById: vi.fn(),
	canCreateResources: vi.fn()
}));

// Import mocked modules
import { requireUserForApi } from '../../../src/lib/server/auth/index';
import { createBoardSeries, findSeriesWithBoardsByUser } from '../../../src/lib/server/repositories/board-series';
import { findUserById, canCreateResources } from '../../../src/lib/server/repositories/user';

describe('GET /api/series', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Mock console methods to prevent output during tests
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(console, 'log').mockImplementation(() => {});
	});

	it('returns series for authenticated user', async () => {
		const mockUser = { userId: 'user-1', email: 'test@example.com', name: 'Test User' };
		const mockSeries = [
			{ id: '1', name: 'Series 1', role: 'admin', boards: [] },
			{ id: '2', name: 'Series 2', role: 'member', boards: [] }
		];

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(findSeriesWithBoardsByUser).mockResolvedValue(mockSeries);

		const event = createMockRequestEvent({ url: 'http://localhost:5173/api/series' });

		const response = await GET(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(data.series).toEqual(mockSeries);
		expect(findSeriesWithBoardsByUser).toHaveBeenCalledWith('user-1');
	});

	it('throws 401 when user is not authenticated', async () => {
		vi.mocked(requireUserForApi).mockImplementation(() => {
			throw new Response('Unauthorized', { status: 401 });
		});

		const event = createMockRequestEvent({ url: 'http://localhost:5173/api/series' });

		await expect(GET(event)).rejects.toThrow();
	});

	it('returns 500 on repository error', async () => {
		const mockUser = { userId: 'user-1', email: 'test@example.com', name: 'Test User' };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(findSeriesWithBoardsByUser).mockRejectedValue(new Error('Database error'));

		const event = createMockRequestEvent({ url: 'http://localhost:5173/api/series' });

		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(500);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Failed to fetch series');
	});
});

describe('POST /api/series', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Mock console methods to prevent output during tests
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(console, 'log').mockImplementation(() => {});
	});

	it('creates series when user email is verified', async () => {
		const mockUser = { userId: 'user-1', email: 'test@example.com', name: 'Test User' };
		const mockSeries = {
			id: 'series-1',
			name: 'New Series',
			slug: 'new-series',
			description: 'Test series',
			creatorId: 'user-1'
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(findUserById).mockResolvedValue({
			id: 'user-1',
			email: 'test@example.com',
			emailVerified: true,
			name: 'Test User',
			role: 'user',
			is_admin: false,
			passwordHash: 'hash',
			emailVerificationSecret: 'secret',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		});
		vi.mocked(canCreateResources).mockReturnValue(true);
		vi.mocked(createBoardSeries).mockResolvedValue(mockSeries);

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/series',
			body: {
				name: 'New Series',
				slug: 'new-series',
				description: 'Test series'
			}
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.series).toEqual({
			...mockSeries,
			role: 'admin',
			boards: []
		});
		expect(createBoardSeries).toHaveBeenCalledWith({
			name: 'New Series',
			slug: 'new-series',
			description: 'Test series',
			creatorId: 'user-1'
		});
	});

	it('returns 403 when user email is not verified', async () => {
		const mockUser = { userId: 'user-1', email: 'test@example.com', name: 'Test User' };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(findUserById).mockResolvedValue({
			id: 'user-1',
			email: 'test@example.com',
			emailVerified: false, // NOT verified
			name: 'Test User',
			role: 'user',
			is_admin: false,
			passwordHash: 'hash',
			emailVerificationSecret: 'secret',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		});
		vi.mocked(canCreateResources).mockReturnValue(false);

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/series',
			body: {
				name: 'New Series',
				slug: 'new-series',
				description: 'Test series'
			}
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Email verification required. Please check your email for a verification link.');
		expect(createBoardSeries).not.toHaveBeenCalled();
	});

	it('returns 404 when user is not found', async () => {
		const mockUser = { userId: 'user-1', email: 'test@example.com', name: 'Test User' };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(findUserById).mockResolvedValue(null);

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/series',
			body: {
				name: 'New Series',
				slug: 'new-series'
			}
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(404);
		expect(data.success).toBe(false);
		expect(data.error).toBe('User not found');
		expect(createBoardSeries).not.toHaveBeenCalled();
	});

	it('returns 400 for invalid input', async () => {
		const mockUser = { userId: 'user-1', email: 'test@example.com', name: 'Test User' };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(findUserById).mockResolvedValue({
			id: 'user-1',
			email: 'test@example.com',
			emailVerified: true,
			name: 'Test User',
			role: 'user',
			is_admin: false,
			passwordHash: 'hash',
			emailVerificationSecret: 'secret',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		});
		vi.mocked(canCreateResources).mockReturnValue(true);

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/series',
			body: { name: '' } // Invalid: empty name
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Invalid input');
		expect(createBoardSeries).not.toHaveBeenCalled();
	});

	it('throws 401 when user is not authenticated', async () => {
		vi.mocked(requireUserForApi).mockImplementation(() => {
			throw new Response('Unauthorized', { status: 401 });
		});

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/series',
			body: { name: 'New Series' }
		});

		await expect(POST(event)).rejects.toThrow();
	});

	it('returns 500 on repository error', async () => {
		const mockUser = { userId: 'user-1', email: 'test@example.com', name: 'Test User' };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(findUserById).mockResolvedValue({
			id: 'user-1',
			email: 'test@example.com',
			emailVerified: true,
			name: 'Test User',
			role: 'user',
			is_admin: false,
			passwordHash: 'hash',
			emailVerificationSecret: 'secret',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		});
		vi.mocked(canCreateResources).mockReturnValue(true);
		vi.mocked(createBoardSeries).mockRejectedValue(new Error('Database error'));

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/series',
			body: { name: 'New Series' }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(500);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Failed to create series');
	});
});
