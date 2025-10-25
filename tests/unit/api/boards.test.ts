import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../../../src/routes/api/boards/+server';
import { createMockRequestEvent, withAuthenticatedUser } from '../helpers/mock-request';

// Mock the auth module
vi.mock('../../../src/lib/server/auth/index', () => ({
	requireUserForApi: vi.fn()
}));

// Mock the repository functions
vi.mock('../../../src/lib/server/repositories/board', () => ({
	createBoard: vi.fn(),
	findBoardsByUser: vi.fn()
}));

vi.mock('../../../src/lib/server/repositories/board-series', () => ({
	getUserRoleInSeries: vi.fn(),
	addUserToSeries: vi.fn()
}));

vi.mock('../../../src/lib/server/repositories/user', () => ({
	findUserById: vi.fn(),
	canCreateResources: vi.fn()
}));

// Import mocked modules
import { requireUserForApi } from '../../../src/lib/server/auth/index';
import { createBoard, findBoardsByUser } from '../../../src/lib/server/repositories/board';
import { getUserRoleInSeries, addUserToSeries } from '../../../src/lib/server/repositories/board-series';
import { findUserById, canCreateResources } from '../../../src/lib/server/repositories/user';

describe('GET /api/boards', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns boards for authenticated user', async () => {
		const mockUser = { userId: 'user-1', email: 'test@example.com', name: 'Test User' };
		const mockBoards = [
			{ id: '1', name: 'Board 1', seriesId: 'series-1' },
			{ id: '2', name: 'Board 2', seriesId: 'series-1' }
		];

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(findBoardsByUser).mockResolvedValue(mockBoards);

		const event = createMockRequestEvent({ url: 'http://localhost:5173/api/boards' });

		const response = await GET(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(data.boards).toEqual(mockBoards);
		expect(findBoardsByUser).toHaveBeenCalledWith('user-1');
	});

	it('throws 401 when user is not authenticated', async () => {
		vi.mocked(requireUserForApi).mockImplementation(() => {
			throw new Response('Unauthorized', { status: 401 });
		});

		const event = createMockRequestEvent({ url: 'http://localhost:5173/api/boards' });

		await expect(GET(event)).rejects.toThrow();
	});

	it('returns 500 on repository error', async () => {
		const mockUser = { userId: 'user-1', email: 'test@example.com', name: 'Test User' };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(findBoardsByUser).mockRejectedValue(new Error('Database error'));

		const event = createMockRequestEvent({ url: 'http://localhost:5173/api/boards' });

		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(500);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Failed to fetch boards');
	});
});

describe('POST /api/boards', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('creates board when user has series access', async () => {
		const mockUser = { userId: 'user-1', email: 'test@example.com', name: 'Test User' };
		const seriesId = '123e4567-e89b-12d3-a456-426614174000';
		const mockBoard = {
			id: 'board-1',
			name: 'New Board',
			seriesId,
			meetingDate: '2025-01-01',
			blameFreeMode: false,
			votingAllocation: 5
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
		vi.mocked(getUserRoleInSeries).mockResolvedValue('member');
		vi.mocked(createBoard).mockResolvedValue(mockBoard);

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/boards',
			body: {
				name: 'New Board',
				seriesId,
				meetingDate: '2025-01-01',
				blameFreeMode: false,
				votingAllocation: 5
			}
		});

		const response = await POST(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(data.board).toEqual(mockBoard);
		expect(createBoard).toHaveBeenCalledWith({
			name: 'New Board',
			seriesId,
			meetingDate: '2025-01-01',
			blameFreeMode: false,
			votingAllocation: 5
		});
	});

	it('auto-adds user to series when creating board', async () => {
		const mockUser = { userId: 'user-1', email: 'test@example.com', name: 'Test User' };
		const seriesId = '123e4567-e89b-12d3-a456-426614174001';
		const mockBoard = {
			id: 'board-1',
			name: 'New Board',
			seriesId
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
		vi.mocked(getUserRoleInSeries).mockResolvedValue(null);
		vi.mocked(addUserToSeries).mockResolvedValue(undefined);
		vi.mocked(createBoard).mockResolvedValue(mockBoard);

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/boards',
			body: { name: 'New Board', seriesId }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(addUserToSeries).toHaveBeenCalledWith(seriesId, 'user-1', 'member');
		expect(createBoard).toHaveBeenCalled();
	});

	it('returns 403 when user email is not verified', async () => {
		const mockUser = { userId: 'user-1', email: 'test@example.com', name: 'Test User' };
		const seriesId = '123e4567-e89b-12d3-a456-426614174000';

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
			url: 'http://localhost:5173/api/boards',
			body: {
				name: 'New Board',
				seriesId,
				meetingDate: '2025-01-01',
				blameFreeMode: false,
				votingAllocation: 5
			}
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Email verification required. Please check your email for a verification link.');
		expect(createBoard).not.toHaveBeenCalled();
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
			url: 'http://localhost:5173/api/boards',
			body: { name: '', seriesId: 'invalid-uuid' }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Invalid input');
	});

	it('throws 401 when user is not authenticated', async () => {
		vi.mocked(requireUserForApi).mockImplementation(() => {
			throw new Response('Unauthorized', { status: 401 });
		});

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/boards',
			body: { name: 'New Board', seriesId: 'series-1' }
		});

		await expect(POST(event)).rejects.toThrow();
	});
});
