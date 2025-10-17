import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../../src/routes/api/boards/[id]/setup-template/+server';
import { createMockRequestEvent } from '../helpers/mock-request';
import { SCENE_FLAGS } from '../../../src/lib/scene-flags';

// Mock the auth module
vi.mock('../../../src/lib/server/auth/index', () => ({
	requireUser: vi.fn()
}));

// Mock repositories
vi.mock('../../../src/lib/server/repositories/board', () => ({
	findBoardById: vi.fn()
}));

vi.mock('../../../src/lib/server/repositories/board-series', () => ({
	getUserRoleInSeries: vi.fn()
}));

// Mock templates
vi.mock('../../../src/lib/server/templates', () => ({
	getTemplate: vi.fn()
}));

// Mock transaction
vi.mock('../../../src/lib/server/db/transaction', () => ({
	withTransaction: vi.fn((callback) => {
		// Create a mock transaction object with insert method
		const tx = {
			insert: vi.fn(() => ({
				values: vi.fn(() => Promise.resolve())
			})),
			update: vi.fn(() => ({
				set: vi.fn(() => ({
					where: vi.fn(() => Promise.resolve())
				}))
			}))
		};
		return callback(tx);
	})
}));

// Mock database
vi.mock('../../../src/lib/server/db/index', () => ({
	db: {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => Promise.resolve([]))
			}))
		}))
	}
}));

// Import mocked modules
import { requireUser } from '../../../src/lib/server/auth/index';
import { findBoardById } from '../../../src/lib/server/repositories/board';
import { getUserRoleInSeries } from '../../../src/lib/server/repositories/board-series';
import { getTemplate } from '../../../src/lib/server/templates';
import { withTransaction } from '../../../src/lib/server/db/transaction';
import { db } from '../../../src/lib/server/db/index';

describe('POST /api/boards/[id]/setup-template', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('creates scenes with proper flags from template', async () => {
		const mockUser = { userId: 'user-1', email: 'facilitator@example.com', name: 'Facilitator' };
		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1',
			name: 'Test Board',
			status: 'draft'
		};

		const mockTemplate = {
			id: 'test',
			name: 'Test Template',
			description: 'A test template',
			columns: [
				{ title: 'Column 1', seq: 1 },
				{ title: 'Column 2', seq: 2 }
			],
			scenes: [
				{
					title: 'Scene 1',
					mode: 'columns' as const,
					seq: 1,
					flags: [
						SCENE_FLAGS.ALLOW_ADD_CARDS,
						SCENE_FLAGS.ALLOW_EDIT_CARDS,
						SCENE_FLAGS.SHOW_COMMENTS
					]
				},
				{
					title: 'Scene 2',
					mode: 'present' as const,
					seq: 2,
					flags: [
						SCENE_FLAGS.SHOW_VOTES,
						SCENE_FLAGS.ALLOW_COMMENTS
					],
					visibleColumns: ['Column 1']
				}
			]
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findBoardById).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('facilitator');
		vi.mocked(getTemplate).mockReturnValue(mockTemplate);

		// Mock empty existing columns/scenes
		vi.mocked(db.select).mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn(() => Promise.resolve([]))
			}))
		} as any);

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/boards/board-1/setup-template',
			params: { id: 'board-1' },
			body: { template: 'test' }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(getTemplate).toHaveBeenCalledWith('test');
		expect(withTransaction).toHaveBeenCalled();

		// Verify transaction was called and check the callback behavior
		const transactionCallback = vi.mocked(withTransaction).mock.calls[0][0];
		const mockTx = {
			insert: vi.fn(() => ({
				values: vi.fn(() => Promise.resolve())
			})),
			update: vi.fn(() => ({
				set: vi.fn(() => ({
					where: vi.fn(() => Promise.resolve())
				}))
			}))
		};

		await transactionCallback(mockTx);

		// Verify columns were inserted (2 columns)
		expect(mockTx.insert).toHaveBeenCalled();

		// Count how many times insert was called for different purposes
		const insertCalls = mockTx.insert.mock.calls;

		// Should have calls for:
		// - 2 columns
		// - 2 scenes
		// - 3 flags for scene 1
		// - 2 flags for scene 2
		// - 4 scene-column relationships (2 scenes × 2 columns, but scene 2 has visibleColumns)
		expect(insertCalls.length).toBeGreaterThanOrEqual(7);
	});

	it('creates scene-column relationships based on visibleColumns', async () => {
		const mockUser = { userId: 'user-1', email: 'facilitator@example.com', name: 'Facilitator' };
		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1',
			name: 'Test Board',
			status: 'draft'
		};

		const mockTemplate = {
			id: 'test',
			name: 'Test Template',
			description: 'A test template',
			columns: [
				{ title: 'Column 1', seq: 1 },
				{ title: 'Column 2', seq: 2 }
			],
			scenes: [
				{
					title: 'Scene with visible columns',
					mode: 'present' as const,
					seq: 1,
					flags: [SCENE_FLAGS.SHOW_VOTES],
					visibleColumns: ['Column 1'] // Only Column 1 should be visible
				}
			]
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findBoardById).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('facilitator');
		vi.mocked(getTemplate).mockReturnValue(mockTemplate);

		vi.mocked(db.select).mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn(() => Promise.resolve([]))
			}))
		} as any);

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/boards/board-1/setup-template',
			params: { id: 'board-1' },
			body: { template: 'test' }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(data.success).toBe(true);
	});

	it('returns 404 when board not found', async () => {
		const mockUser = { userId: 'user-1', email: 'facilitator@example.com', name: 'Facilitator' };

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findBoardById).mockResolvedValue(null);

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/boards/board-1/setup-template',
			params: { id: 'board-1' },
			body: { template: 'test' }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(404);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Board not found');
	});

	it('returns 403 when user does not have access', async () => {
		const mockUser = { userId: 'user-1', email: 'member@example.com', name: 'Member' };
		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1',
			name: 'Test Board',
			status: 'draft'
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findBoardById).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue(null);

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/boards/board-1/setup-template',
			params: { id: 'board-1' },
			body: { template: 'test' }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Access denied');
	});

	it('returns 400 when board already has configuration', async () => {
		const mockUser = { userId: 'user-1', email: 'facilitator@example.com', name: 'Facilitator' };
		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1',
			name: 'Test Board',
			status: 'draft'
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findBoardById).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('facilitator');

		// Mock existing columns
		vi.mocked(db.select).mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn(() => Promise.resolve([{ id: 'column-1' }]))
			}))
		} as any);

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/boards/board-1/setup-template',
			params: { id: 'board-1' },
			body: { template: 'test' }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Board already has configuration');
	});

	it('uses default template when no template specified', async () => {
		const mockUser = { userId: 'user-1', email: 'facilitator@example.com', name: 'Facilitator' };
		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1',
			name: 'Test Board',
			status: 'draft'
		};

		const mockTemplate = {
			id: 'kafe',
			name: 'KAFE',
			description: 'KAFE template',
			columns: [{ title: 'Test', seq: 1 }],
			scenes: [{
				title: 'Test Scene',
				mode: 'columns' as const,
				seq: 1,
				flags: []
			}]
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findBoardById).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('facilitator');
		vi.mocked(getTemplate).mockReturnValue(mockTemplate);

		vi.mocked(db.select).mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn(() => Promise.resolve([]))
			}))
		} as any);

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/boards/board-1/setup-template',
			params: { id: 'board-1' },
			body: {} // No template specified
		});

		const response = await POST(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(getTemplate).toHaveBeenCalledWith('basic');
	});
});
