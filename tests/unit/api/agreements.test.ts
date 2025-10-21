import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../../../src/routes/api/boards/[id]/agreements/+server';
import { createMockRequestEvent } from '../helpers/mock-request';

// Mock auth modules
vi.mock('../../../src/lib/server/auth/index', () => ({
	requireUser: vi.fn()
}));

// Mock repositories
vi.mock('../../../src/lib/server/repositories/board', () => ({
	getBoardWithDetails: vi.fn()
}));

vi.mock('../../../src/lib/server/repositories/board-series', () => ({
	getUserRoleInSeries: vi.fn()
}));

vi.mock('../../../src/lib/server/repositories/agreement', () => ({
	createAgreement: vi.fn(),
	findAgreementsByBoardId: vi.fn(),
	findCommentAgreementsByColumns: vi.fn()
}));

vi.mock('../../../src/lib/server/utils/agreements-data', () => ({
	buildEnrichedAgreementsData: vi.fn()
}));

vi.mock('../../../src/lib/server/sse/broadcast', () => ({
	broadcastAgreementsUpdated: vi.fn()
}));

vi.mock('../../../src/lib/server/middleware/presence', () => ({
	refreshPresenceOnBoardAction: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../../src/lib/server/db/index', () => ({
	db: {}
}));

// Import mocked modules
import { requireUser } from '../../../src/lib/server/auth/index';
import { getBoardWithDetails } from '../../../src/lib/server/repositories/board';
import { getUserRoleInSeries } from '../../../src/lib/server/repositories/board-series';
import { createAgreement } from '../../../src/lib/server/repositories/agreement';
import { buildEnrichedAgreementsData } from '../../../src/lib/server/utils/agreements-data';
import { broadcastAgreementsUpdated } from '../../../src/lib/server/sse/broadcast';

describe('GET /api/boards/[id]/agreements', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should return enriched agreements when user has access', async () => {
		const mockUser = { userId: 'user-1', email: 'user@example.com', name: 'Test User' };
		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1',
			currentSceneId: 'scene-1',
			blameFreeMode: false
		};
		const mockAgreements = [
			{
				id: 'agreement-1',
				boardId: 'board-1',
				content: 'Test agreement',
				completed: false,
				createdAt: new Date().toISOString(),
				type: 'agreement'
			}
		];

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard as any);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('member');
		vi.mocked(buildEnrichedAgreementsData).mockResolvedValue(mockAgreements as any);

		const event = createMockRequestEvent({ params: { id: 'board-1' } });
		const response = await GET(event);
		const data = await response.json();

		expect(requireUser).toHaveBeenCalledWith(event);
		expect(getBoardWithDetails).toHaveBeenCalledWith('board-1');
		expect(getUserRoleInSeries).toHaveBeenCalledWith('user-1', 'series-1');
		expect(buildEnrichedAgreementsData).toHaveBeenCalledWith('board-1', mockBoard);
		expect(data).toEqual({
			success: true,
			agreements: mockAgreements
		});
	});

	it('should return 404 when board is not found', async () => {
		const mockUser = { userId: 'user-1', email: 'user@example.com', name: 'Test User' };

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(null);

		const event = createMockRequestEvent({ params: { id: 'board-1' } });
		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(404);
		expect(data).toEqual({
			success: false,
			error: 'Board not found'
		});
		expect(getUserRoleInSeries).not.toHaveBeenCalled();
	});

	it('should return 403 when user does not have access', async () => {
		const mockUser = { userId: 'user-1', email: 'user@example.com', name: 'Test User' };
		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1'
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard as any);
		vi.mocked(getUserRoleInSeries).mockResolvedValue(null);

		const event = createMockRequestEvent({ params: { id: 'board-1' } });
		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data).toEqual({
			success: false,
			error: 'Access denied'
		});
		expect(buildEnrichedAgreementsData).not.toHaveBeenCalled();
	});

	it('should handle authentication errors by rethrowing Response', async () => {
		const authError = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
		vi.mocked(requireUser).mockImplementation(() => {
			throw authError;
		});

		const event = createMockRequestEvent({ params: { id: 'board-1' } });

		await expect(GET(event)).rejects.toThrow(Response);
	});

	it('should return 500 on general failure', async () => {
		const mockUser = { userId: 'user-1', email: 'user@example.com', name: 'Test User' };

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockRejectedValue(new Error('Database error'));

		const event = createMockRequestEvent({ params: { id: 'board-1' } });
		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(500);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Failed to fetch agreements');
	});
});

describe('POST /api/boards/[id]/agreements', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should create agreement when facilitator posts valid data', async () => {
		const mockUser = { userId: 'user-1', email: 'user@example.com', name: 'Test User' };
		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1',
			currentSceneId: 'scene-1',
			blameFreeMode: false
		};
		const mockAgreement = {
			id: 'agreement-1',
			boardId: 'board-1',
			userId: 'user-1',
			content: 'New agreement',
			completed: false,
			createdAt: new Date().toISOString()
		};
		const mockAgreements = [mockAgreement];

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard as any);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('facilitator');
		vi.mocked(createAgreement).mockResolvedValue(mockAgreement as any);
		vi.mocked(buildEnrichedAgreementsData).mockResolvedValue(mockAgreements as any);

		const event = createMockRequestEvent({
			method: 'POST',
			params: { id: 'board-1' },
			body: { content: 'New agreement' }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(createAgreement).toHaveBeenCalledWith({
			boardId: 'board-1',
			userId: 'user-1',
			content: 'New agreement'
		});
		expect(buildEnrichedAgreementsData).toHaveBeenCalledWith('board-1', mockBoard);
		expect(broadcastAgreementsUpdated).toHaveBeenCalledWith('board-1', mockAgreements);
		expect(data).toEqual({
			success: true,
			agreement: mockAgreement
		});
	});

	it('should allow admin to create agreements', async () => {
		const mockUser = { userId: 'user-1', email: 'user@example.com', name: 'Test User' };
		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1'
		};
		const mockAgreement = {
			id: 'agreement-1',
			boardId: 'board-1',
			userId: 'user-1',
			content: 'Admin agreement'
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard as any);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('admin');
		vi.mocked(createAgreement).mockResolvedValue(mockAgreement as any);
		vi.mocked(buildEnrichedAgreementsData).mockResolvedValue([mockAgreement] as any);

		const event = createMockRequestEvent({
			method: 'POST',
			params: { id: 'board-1' },
			body: { content: 'Admin agreement' }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(createAgreement).toHaveBeenCalled();
	});

	it('should return 403 when member tries to create agreement', async () => {
		const mockUser = { userId: 'user-1', email: 'user@example.com', name: 'Test User' };
		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1'
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard as any);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('member');

		const event = createMockRequestEvent({
			method: 'POST',
			params: { id: 'board-1' },
			body: { content: 'Member agreement' }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data).toEqual({
			success: false,
			error: 'Only facilitators and admins can create agreements'
		});
		expect(createAgreement).not.toHaveBeenCalled();
	});

	it('should return 400 for invalid request body', async () => {
		const mockUser = { userId: 'user-1', email: 'user@example.com', name: 'Test User' };
		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1'
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard as any);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('facilitator');

		const event = createMockRequestEvent({
			method: 'POST',
			params: { id: 'board-1' },
			body: { content: '' } // Empty content should fail validation
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(400); // Zod validation errors return 400
		expect(data.success).toBe(false);
		expect(data.error).toBe('Invalid input');
	});

	it('should return 404 when board is not found', async () => {
		const mockUser = { userId: 'user-1', email: 'user@example.com', name: 'Test User' };

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(null);

		const event = createMockRequestEvent({
			method: 'POST',
			params: { id: 'board-1' },
			body: { content: 'Test' }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(404);
		expect(data).toEqual({
			success: false,
			error: 'Board not found'
		});
	});

	it('should return 403 when user has no access to series', async () => {
		const mockUser = { userId: 'user-1', email: 'user@example.com', name: 'Test User' };
		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1'
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard as any);
		vi.mocked(getUserRoleInSeries).mockResolvedValue(null);

		const event = createMockRequestEvent({
			method: 'POST',
			params: { id: 'board-1' },
			body: { content: 'Test' }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data).toEqual({
			success: false,
			error: 'Only facilitators and admins can create agreements'
		});
	});
});
