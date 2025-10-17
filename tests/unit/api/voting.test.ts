import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as VoteOnCard } from '../../../src/routes/api/cards/[id]/vote/+server';
import { DELETE as ClearVotes } from '../../../src/routes/api/boards/[id]/votes/clear/+server';
import { POST as IncreaseAllocation } from '../../../src/routes/api/boards/[id]/votes/increase-allocation/+server';
import { createMockRequestEvent } from '../helpers/mock-request';
import { SCENE_FLAGS } from '../../../src/lib/scene-flags';

// Mock auth modules
vi.mock('../../../src/lib/server/auth/index', () => ({
	requireUser: vi.fn()
}));

// Mock repositories
vi.mock('../../../src/lib/server/repositories/card', () => ({
	findCardById: vi.fn(),
	findBoardByColumnId: vi.fn(),
	getCardsForBoard: vi.fn(),
	enrichCardWithCounts: vi.fn()
}));

vi.mock('../../../src/lib/server/repositories/board', () => ({
	getBoardWithDetails: vi.fn(),
	updateBoardSettings: vi.fn(),
	findBoardByColumnId: vi.fn()
}));

vi.mock('../../../src/lib/server/repositories/board-series', () => ({
	getUserRoleInSeries: vi.fn()
}));

vi.mock('../../../src/lib/server/repositories/vote', () => ({
	castVote: vi.fn(),
	getUserVoteCount: vi.fn(),
	getAllUsersVotesForBoard: vi.fn(),
	clearBoardVotes: vi.fn()
}));

vi.mock('../../../src/lib/server/repositories/presence', () => ({
	updatePresence: vi.fn()
}));

vi.mock('../../../src/lib/server/sse/broadcast', () => ({
	broadcastVoteChanged: vi.fn(),
	broadcastVoteChangedToUser: vi.fn(),
	broadcastVoteUpdatesBasedOnScene: vi.fn(),
	broadcastBoardUpdated: vi.fn()
}));

// Mock voting data builder
vi.mock('../../../src/lib/server/utils/voting-data', () => ({
	buildComprehensiveVotingData: vi.fn()
}));

// Mock cards data utilities
vi.mock('../../../src/lib/server/utils/cards-data', () => ({
	enrichCardWithCounts: vi.fn()
}));

// Import mocked modules
import { requireUser } from '../../../src/lib/server/auth/index';
import {
	findCardById,
	getCardsForBoard
} from '../../../src/lib/server/repositories/card';
import { getBoardWithDetails, updateBoardSettings, findBoardByColumnId } from '../../../src/lib/server/repositories/board';
import { getUserRoleInSeries } from '../../../src/lib/server/repositories/board-series';
import {
	castVote,
	getUserVoteCount,
	getAllUsersVotesForBoard,
	clearBoardVotes
} from '../../../src/lib/server/repositories/vote';
import { updatePresence } from '../../../src/lib/server/repositories/presence';
import {
	broadcastVoteChanged,
	broadcastVoteChangedToUser,
	broadcastVoteUpdatesBasedOnScene,
	broadcastBoardUpdated
} from '../../../src/lib/server/sse/broadcast';
import { buildComprehensiveVotingData } from '../../../src/lib/server/utils/voting-data';
import { enrichCardWithCounts } from '../../../src/lib/server/utils/cards-data';

describe('POST /api/cards/[id]/vote', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should successfully vote on a card', async () => {
		const mockUser = { userId: 'user-1', email: 'member@example.com', name: 'Member' };
		const mockCard = {
			id: 'card-1',
			columnId: 'column-1',
			content: 'Test card',
			groupId: null,
			isGroupLead: false
		};
		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1',
			status: 'active',
			currentSceneId: 'scene-1',
			votingAllocation: 5,
			scenes: [
				{
					id: 'scene-1',
					flags: [SCENE_FLAGS.ALLOW_VOTING]
				}
			]
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findCardById).mockResolvedValue(mockCard);
		vi.mocked(findBoardByColumnId).mockResolvedValue('board-1');
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('member');
		vi.mocked(getUserVoteCount).mockResolvedValue(2);
		vi.mocked(castVote).mockResolvedValue({ success: true });
		vi.mocked(getCardsForBoard).mockResolvedValue([{ ...mockCard, id: 'card-1' }]);
		vi.mocked(enrichCardWithCounts).mockResolvedValue({
			...mockCard,
			voteCount: 3,
			commentCount: 0,
			reactionCount: 0
		});
		vi.mocked(buildComprehensiveVotingData).mockResolvedValue({
			user_voting_data: {
				remaining: 2,
				allocated: 3,
				max: 5,
				votes: [{ cardId: 'card-1', voteCount: 1 }]
			},
			voting_stats: {
				total_votes_cast: 10,
				unique_voters: 3
			}
		});

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/cards/card-1/vote',
			params: { id: 'card-1' },
			body: { delta: 1 }
		});

		const response = await VoteOnCard(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(data.card.voteCount).toBe(3);
		expect(castVote).toHaveBeenCalledWith('card-1', 'user-1', 1);
		expect(updatePresence).toHaveBeenCalledWith('user-1', 'board-1');
	});

	it('should fail when voting on subordinate card', async () => {
		const mockUser = { userId: 'user-1', email: 'member@example.com', name: 'Member' };
		const mockCard = {
			id: 'card-1',
			columnId: 'column-1',
			content: 'Subordinate card',
			groupId: 'group-1',
			isGroupLead: false
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findCardById).mockResolvedValue(mockCard);

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/cards/card-1/vote',
			params: { id: 'card-1' },
			body: { delta: 1 }
		});

		const response = await VoteOnCard(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Cannot vote on subordinate cards. Vote on the group lead card instead.');
	});

	it('should fail when voting not allowed in current scene', async () => {
		const mockUser = { userId: 'user-1', email: 'member@example.com', name: 'Member' };
		const mockCard = {
			id: 'card-1',
			columnId: 'column-1',
			content: 'Test card',
			groupId: null,
			isGroupLead: false
		};
		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1',
			status: 'active',
			currentSceneId: 'scene-1',
			votingAllocation: 5,
			scenes: [
				{
					id: 'scene-1',
					flags: [] // No voting flag
				}
			]
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findCardById).mockResolvedValue(mockCard);
		vi.mocked(findBoardByColumnId).mockResolvedValue('board-1');
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('member');

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/cards/card-1/vote',
			params: { id: 'card-1' },
			body: { delta: 1 }
		});

		const response = await VoteOnCard(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Voting not allowed in current scene');
	});

	it('should fail when no votes remaining', async () => {
		const mockUser = { userId: 'user-1', email: 'member@example.com', name: 'Member' };
		const mockCard = {
			id: 'card-1',
			columnId: 'column-1',
			content: 'Test card',
			groupId: null,
			isGroupLead: false
		};
		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1',
			status: 'active',
			currentSceneId: 'scene-1',
			votingAllocation: 5,
			scenes: [
				{
					id: 'scene-1',
					flags: [SCENE_FLAGS.ALLOW_VOTING]
				}
			]
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(findCardById).mockResolvedValue(mockCard);
		vi.mocked(findBoardByColumnId).mockResolvedValue('board-1');
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('member');
		vi.mocked(getUserVoteCount).mockResolvedValue(5); // Already used all votes

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/cards/card-1/vote',
			params: { id: 'card-1' },
			body: { delta: 1 }
		});

		const response = await VoteOnCard(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe('No votes remaining');
	});

	it('should validate delta parameter', async () => {
		const mockUser = { userId: 'user-1', email: 'member@example.com', name: 'Member' };

		vi.mocked(requireUser).mockReturnValue(mockUser);

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/cards/card-1/vote',
			params: { id: 'card-1' },
			body: { delta: 5 } // Invalid delta
		});

		const response = await VoteOnCard(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Invalid delta value. Must be 1 or -1');
	});
});

describe('DELETE /api/boards/[id]/votes/clear', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should clear all votes as facilitator', async () => {
		const mockUser = { userId: 'user-1', email: 'facilitator@example.com', name: 'Facilitator' };
		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1',
			status: 'active',
			currentSceneId: 'scene-1',
			votingAllocation: 5,
			scenes: [
				{
					id: 'scene-1',
					flags: [SCENE_FLAGS.ALLOW_VOTING]
				}
			]
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('facilitator');
		vi.mocked(clearBoardVotes).mockResolvedValue({ deletedCount: 25 });

		const event = createMockRequestEvent({
			method: 'DELETE',
			url: 'http://localhost:5173/api/boards/board-1/votes/clear',
			params: { id: 'board-1' }
		});

		const response = await ClearVotes(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(data.deletedVotes).toBe(25);
		expect(clearBoardVotes).toHaveBeenCalledWith('board-1');
		expect(updateBoardSettings).toHaveBeenCalledWith('board-1', { votingAllocation: 0 });
		expect(broadcastBoardUpdated).toHaveBeenCalled();
	});

	it('should fail when user is not facilitator', async () => {
		const mockUser = { userId: 'user-1', email: 'member@example.com', name: 'Member' };
		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1',
			status: 'active'
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('member');

		const event = createMockRequestEvent({
			method: 'DELETE',
			url: 'http://localhost:5173/api/boards/board-1/votes/clear',
			params: { id: 'board-1' }
		});

		const response = await ClearVotes(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Access denied');
	});

	it('should fail when board not found', async () => {
		const mockUser = { userId: 'user-1', email: 'facilitator@example.com', name: 'Facilitator' };

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(null);

		const event = createMockRequestEvent({
			method: 'DELETE',
			url: 'http://localhost:5173/api/boards/board-1/votes/clear',
			params: { id: 'board-1' }
		});

		const response = await ClearVotes(event);
		const data = await response.json();

		expect(response.status).toBe(404);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Board not found');
	});
});

describe('POST /api/boards/[id]/votes/increase-allocation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should increase voting allocation as facilitator', async () => {
		const mockUser = { userId: 'user-1', email: 'facilitator@example.com', name: 'Facilitator' };
		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1',
			status: 'active',
			currentSceneId: 'scene-1',
			votingAllocation: 5,
			scenes: [
				{
					id: 'scene-1',
					flags: [SCENE_FLAGS.ALLOW_VOTING]
				}
			]
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails)
			.mockResolvedValueOnce(mockBoard)
			.mockResolvedValueOnce({ ...mockBoard, votingAllocation: 6 });
		vi.mocked(getUserRoleInSeries).mockResolvedValue('facilitator');

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/boards/board-1/votes/increase-allocation',
			params: { id: 'board-1' }
		});

		const response = await IncreaseAllocation(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(data.newAllocation).toBe(6);
		expect(data.previousAllocation).toBe(5);
		expect(updateBoardSettings).toHaveBeenCalledWith('board-1', { votingAllocation: 6 });
		expect(broadcastBoardUpdated).toHaveBeenCalled();
	});

	it('should fail when maximum allocation reached', async () => {
		const mockUser = { userId: 'user-1', email: 'facilitator@example.com', name: 'Facilitator' };
		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1',
			status: 'active',
			votingAllocation: 50 // Already at max
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('facilitator');

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/boards/board-1/votes/increase-allocation',
			params: { id: 'board-1' }
		});

		const response = await IncreaseAllocation(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Maximum voting allocation reached');
	});

	it('should fail when user is not facilitator', async () => {
		const mockUser = { userId: 'user-1', email: 'member@example.com', name: 'Member' };
		const mockBoard = {
			id: 'board-1',
			seriesId: 'series-1',
			status: 'active',
			votingAllocation: 5
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue('member');

		const event = createMockRequestEvent({
			method: 'POST',
			url: 'http://localhost:5173/api/boards/board-1/votes/increase-allocation',
			params: { id: 'board-1' }
		});

		const response = await IncreaseAllocation(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Access denied');
	});
});
