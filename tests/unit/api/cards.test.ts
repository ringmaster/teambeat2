import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUT, DELETE } from '../../../src/routes/api/cards/[id]/+server';
import { createMockRequestEvent } from '../helpers/mock-request';
import { SCENE_FLAGS } from '../../../src/lib/scene-flags';

// Mock the auth module
vi.mock('../../../src/lib/server/auth/index', () => ({
	requireUser: vi.fn()
}));

// Mock all dependencies
vi.mock('../../../src/lib/server/repositories/card', () => ({
	findCardById: vi.fn(),
	updateCard: vi.fn(),
	deleteCard: vi.fn()
}));

vi.mock('../../../src/lib/server/repositories/board', () => ({
	getBoardWithDetails: vi.fn(),
	findBoardByColumnId: vi.fn()
}));

vi.mock('../../../src/lib/server/repositories/board-series', () => ({
	getUserRoleInSeries: vi.fn()
}));

vi.mock('../../../src/lib/server/sse/broadcast', () => ({
	broadcastCardUpdated: vi.fn(),
	broadcastCardDeleted: vi.fn()
}));

vi.mock('../../../src/lib/server/utils/cards-data', () => ({
	enrichCardWithCounts: vi.fn()
}));

// Import mocked modules
import { requireUser } from '../../../src/lib/server/auth/index';
import { findCardById, updateCard, deleteCard } from '../../../src/lib/server/repositories/card';
import { getBoardWithDetails, findBoardByColumnId } from '../../../src/lib/server/repositories/board';
import { getUserRoleInSeries } from '../../../src/lib/server/repositories/board-series';
import { broadcastCardUpdated, broadcastCardDeleted } from '../../../src/lib/server/sse/broadcast';
import { enrichCardWithCounts } from '../../../src/lib/server/utils/cards-data';

describe('PUT /api/cards/[id]', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('updates card when user is owner', async () => {
		const mockUser = { userId: 'user-1', email: 'test@example.com', name: 'Test User' };
		const mockCard = {
			id: 'card-1',
			content: 'Old content',
			userId: 'user-1',
			columnId: 'col-1'
		};

		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1',
			status: 'active',
			currentSceneId: 'scene-1',
			scenes: [{ id: 'scene-1', flags: [SCENE_FLAGS.ALLOW_EDIT_CARDS] }]
		};

		const updatedCard = { ...mockCard, content: 'New content' };
		const enrichedCard = { ...updatedCard, reactionCount: 0, commentCount: 0 };

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findCardById).mockResolvedValue(mockCard);
		vi.mocked(findBoardByColumnId).mockResolvedValue('board-1');
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('member');
		vi.mocked(updateCard).mockResolvedValue(updatedCard);
		vi.mocked(enrichCardWithCounts).mockResolvedValue(enrichedCard);

		const event = createMockRequestEvent({
			method: 'PUT',
			url: 'http://localhost:5173/api/cards/card-1',
			params: { id: 'card-1' },
			body: { content: 'New content' }
		});

		const response = await PUT(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(data.card).toEqual(enrichedCard);
		expect(updateCard).toHaveBeenCalledWith('card-1', { content: 'New content' });
		expect(broadcastCardUpdated).toHaveBeenCalledWith('board-1', enrichedCard);
	});

	it('updates card when user is facilitator', async () => {
		const mockUser = { userId: 'user-1', email: 'test@example.com', name: 'Test User' };
		const mockCard = {
			id: 'card-1',
			content: 'Old content',
			userId: 'other-user',
			columnId: 'col-1'
		};

		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1',
			status: 'active',
			currentSceneId: 'scene-1',
			scenes: [{ id: 'scene-1', flags: [SCENE_FLAGS.ALLOW_EDIT_CARDS] }]
		};

		const updatedCard = { ...mockCard, content: 'New content' };
		const enrichedCard = { ...updatedCard, reactionCount: 0, commentCount: 0 };

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findCardById).mockResolvedValue(mockCard);
		vi.mocked(findBoardByColumnId).mockResolvedValue('board-1');
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('facilitator');
		vi.mocked(updateCard).mockResolvedValue(updatedCard);
		vi.mocked(enrichCardWithCounts).mockResolvedValue(enrichedCard);

		const event = createMockRequestEvent({
			method: 'PUT',
			url: 'http://localhost:5173/api/cards/card-1',
			params: { id: 'card-1' },
			body: { content: 'New content' }
		});

		const response = await PUT(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(updateCard).toHaveBeenCalled();
	});

	it('returns 404 when card not found', async () => {
		const mockUser = { userId: 'user-1', email: 'test@example.com', name: 'Test User' };

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findCardById).mockResolvedValue(null);

		const event = createMockRequestEvent({
			method: 'PUT',
			url: 'http://localhost:5173/api/cards/card-1',
			params: { id: 'card-1' },
			body: { content: 'New content' }
		});

		const response = await PUT(event);
		const data = await response.json();

		expect(response.status).toBe(404);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Card not found');
	});

	it('returns 403 when user has no series access', async () => {
		const mockUser = { userId: 'user-1', email: 'test@example.com', name: 'Test User' };
		const mockCard = {
			id: 'card-1',
			content: 'Old content',
			userId: 'user-1',
			columnId: 'col-1'
		};

		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1',
			status: 'active',
			currentSceneId: 'scene-1',
			scenes: [{ id: 'scene-1', flags: [SCENE_FLAGS.ALLOW_EDIT_CARDS] }]
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findCardById).mockResolvedValue(mockCard);
		vi.mocked(findBoardByColumnId).mockResolvedValue('board-1');
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue(null);

		const event = createMockRequestEvent({
			method: 'PUT',
			url: 'http://localhost:5173/api/cards/card-1',
			params: { id: 'card-1' },
			body: { content: 'New content' }
		});

		const response = await PUT(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Access denied');
	});

	it('returns 403 when scene does not allow editing', async () => {
		const mockUser = { userId: 'user-1', email: 'test@example.com', name: 'Test User' };
		const mockCard = {
			id: 'card-1',
			content: 'Old content',
			userId: 'user-1',
			columnId: 'col-1'
		};

		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1',
			status: 'active',
			currentSceneId: 'scene-1',
			scenes: [{ id: 'scene-1', flags: [] }] // No ALLOW_EDIT_CARDS flag
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findCardById).mockResolvedValue(mockCard);
		vi.mocked(findBoardByColumnId).mockResolvedValue('board-1');
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('member');

		const event = createMockRequestEvent({
			method: 'PUT',
			url: 'http://localhost:5173/api/cards/card-1',
			params: { id: 'card-1' },
			body: { content: 'New content' }
		});

		const response = await PUT(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Editing cards not allowed in current scene');
	});

	it('returns 403 when user is not owner and not facilitator', async () => {
		const mockUser = { userId: 'user-1', email: 'test@example.com', name: 'Test User' };
		const mockCard = {
			id: 'card-1',
			content: 'Old content',
			userId: 'other-user',
			columnId: 'col-1'
		};

		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1',
			status: 'active',
			currentSceneId: 'scene-1',
			scenes: [{ id: 'scene-1', flags: [SCENE_FLAGS.ALLOW_EDIT_CARDS] }]
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findCardById).mockResolvedValue(mockCard);
		vi.mocked(findBoardByColumnId).mockResolvedValue('board-1');
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('member');

		const event = createMockRequestEvent({
			method: 'PUT',
			url: 'http://localhost:5173/api/cards/card-1',
			params: { id: 'card-1' },
			body: { content: 'New content' }
		});

		const response = await PUT(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Access denied'); // Correctly fails at ownership check, not scene check
	});

	it('returns 400 for invalid input', async () => {
		const mockUser = { userId: 'user-1', email: 'test@example.com', name: 'Test User' };

		vi.mocked(requireUser).mockReturnValue(mockUser);

		const event = createMockRequestEvent({
			method: 'PUT',
			url: 'http://localhost:5173/api/cards/card-1',
			params: { id: 'card-1' },
			body: { content: '' }
		});

		const response = await PUT(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Invalid input');
	});
});

describe('DELETE /api/cards/[id]', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('deletes card when user is owner', async () => {
		const mockUser = { userId: 'user-1', email: 'test@example.com', name: 'Test User' };
		const mockCard = {
			id: 'card-1',
			content: 'Content',
			userId: 'user-1',
			columnId: 'col-1'
		};

		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1',
			status: 'active',
			currentSceneId: 'scene-1',
			scenes: [{ id: 'scene-1', flags: [SCENE_FLAGS.ALLOW_EDIT_CARDS] }]
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findCardById).mockResolvedValue(mockCard);
		vi.mocked(findBoardByColumnId).mockResolvedValue('board-1');
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('member');
		vi.mocked(deleteCard).mockResolvedValue(undefined);

		const event = createMockRequestEvent({
			method: 'DELETE',
			url: 'http://localhost:5173/api/cards/card-1',
			params: { id: 'card-1' }
		});

		const response = await DELETE(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(deleteCard).toHaveBeenCalledWith('card-1');
		expect(broadcastCardDeleted).toHaveBeenCalledWith('board-1', 'card-1');
	});

	it('deletes card when user is admin', async () => {
		const mockUser = { userId: 'user-1', email: 'test@example.com', name: 'Test User' };
		const mockCard = {
			id: 'card-1',
			content: 'Content',
			userId: 'other-user',
			columnId: 'col-1'
		};

		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1',
			status: 'active',
			currentSceneId: 'scene-1',
			scenes: [{ id: 'scene-1', flags: [SCENE_FLAGS.ALLOW_EDIT_CARDS] }]
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findCardById).mockResolvedValue(mockCard);
		vi.mocked(findBoardByColumnId).mockResolvedValue('board-1');
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('admin');
		vi.mocked(deleteCard).mockResolvedValue(undefined);

		const event = createMockRequestEvent({
			method: 'DELETE',
			url: 'http://localhost:5173/api/cards/card-1',
			params: { id: 'card-1' }
		});

		const response = await DELETE(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(deleteCard).toHaveBeenCalled();
	});

	it('returns 403 when user is not owner and not admin/facilitator', async () => {
		const mockUser = { userId: 'user-1', email: 'test@example.com', name: 'Test User' };
		const mockCard = {
			id: 'card-1',
			content: 'Content',
			userId: 'other-user',
			columnId: 'col-1'
		};

		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1',
			status: 'active',
			currentSceneId: 'scene-1',
			scenes: [{ id: 'scene-1', flags: [SCENE_FLAGS.ALLOW_EDIT_CARDS] }]
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findCardById).mockResolvedValue(mockCard);
		vi.mocked(findBoardByColumnId).mockResolvedValue('board-1');
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('member');

		const event = createMockRequestEvent({
			method: 'DELETE',
			url: 'http://localhost:5173/api/cards/card-1',
			params: { id: 'card-1' }
		});

		const response = await DELETE(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Access denied'); // Correctly fails at ownership check, not scene check
	});
});
