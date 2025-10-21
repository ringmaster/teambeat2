import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../../src/routes/api/cards/[id]/vote/+server';
import { createMockRequestEvent } from '../helpers/mock-request';

// Mock auth modules
vi.mock('../../../src/lib/server/auth/index', () => ({
	requireUser: vi.fn()
}));

// Mock repositories
vi.mock('../../../src/lib/server/repositories/card', () => ({
	findCardById: vi.fn()
}));

vi.mock('../../../src/lib/server/repositories/vote', () => ({
	castVote: vi.fn(),
	getVoteContext: vi.fn(),
	getVoteCountsByCard: vi.fn()
}));

vi.mock('../../../src/lib/server/repositories/presence', () => ({
	updatePresence: vi.fn()
}));

vi.mock('../../../src/lib/server/utils/voting-data', () => ({
	buildComprehensiveVotingData: vi.fn()
}));

vi.mock('../../../src/lib/server/utils/cards-data', () => ({
	enrichCardWithCounts: vi.fn()
}));

vi.mock('../../../src/lib/server/sse/broadcast', () => ({
	broadcastVoteChanged: vi.fn(),
	broadcastVoteChangedToUser: vi.fn(),
	broadcastVoteUpdatesBasedOnScene: vi.fn()
}));

// Import mocked modules
import { requireUser } from '../../../src/lib/server/auth/index';
import { findCardById } from '../../../src/lib/server/repositories/card';
import { castVote, getVoteContext, getVoteCountsByCard } from '../../../src/lib/server/repositories/vote';
import { updatePresence } from '../../../src/lib/server/repositories/presence';
import { buildComprehensiveVotingData } from '../../../src/lib/server/utils/voting-data';
import { enrichCardWithCounts } from '../../../src/lib/server/utils/cards-data';
import { broadcastVoteChanged, broadcastVoteChangedToUser, broadcastVoteUpdatesBasedOnScene } from '../../../src/lib/server/sse/broadcast';

describe('POST /api/cards/[id]/vote', () => {
	const mockUser = { userId: 'user-1', email: 'user@example.com', name: 'Test User' };
	const mockCard = {
		id: 'card-1',
		columnId: 'column-1',
		groupId: null,
		isGroupLead: false,
		title: 'Test Card',
		description: 'Test description',
		order: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
		createdBy: 'user-1'
	};
	const mockBoard = {
		id: 'board-1',
		seriesId: 'series-1',
		currentSceneId: 'scene-1',
		votingAllocation: 5,
		status: 'active',
		currentScene: {
			id: 'scene-1',
			flags: ['allow_voting', 'show_votes']
		}
	};

	const createMockVoteContext = (overrides: any = {}) => ({
		card: mockCard,
		board: mockBoard,
		userRole: 'member',
		currentVoteCount: 0,
		...overrides
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should successfully add a vote when all conditions are met', async () => {
		const mockEnrichedCard = { ...mockCard, voteCount: 3, commentCount: 0 };
		const mockVotingData = {
			user_voting_data: {
				user_votes: ['card-1'],
				voting_allocation: { currentVotes: 1, maxVotes: 5, remainingVotes: 4, canVote: true }
			},
			voting_stats: {
				totalUsers: 3,
				activeUsers: 3,
				usersWhoVoted: 1,
				usersWhoHaventVoted: 2,
				totalVotesCast: 1,
				maxPossibleVotes: 15,
				remainingVotes: 14,
				maxVotesPerUser: 5
			}
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getVoteContext).mockResolvedValue(createMockVoteContext());
		vi.mocked(castVote).mockResolvedValue({ action: 'added', voteId: 'vote-1' });
		vi.mocked(findCardById).mockResolvedValue(mockCard as any);
		vi.mocked(enrichCardWithCounts).mockResolvedValue(mockEnrichedCard as any);
		vi.mocked(buildComprehensiveVotingData).mockResolvedValue(mockVotingData as any);
		vi.mocked(getVoteCountsByCard).mockResolvedValue({ 'card-1': 1 });

		const event = createMockRequestEvent({
			method: 'POST',
			params: { id: 'card-1' },
			body: { delta: 1 }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.card).toMatchObject({
			id: mockCard.id,
			voteCount: 3,
			commentCount: 0
		});
		expect(data.voteResult).toEqual({ action: 'added', voteId: 'vote-1' });
		expect(getVoteContext).toHaveBeenCalledWith('card-1', 'user-1');
		expect(castVote).toHaveBeenCalledWith('card-1', 'user-1', 1);
		expect(updatePresence).toHaveBeenCalledWith('user-1', 'board-1');
		expect(broadcastVoteChanged).toHaveBeenCalledWith('board-1', 'card-1', 3, 'user-1');
		expect(broadcastVoteUpdatesBasedOnScene).toHaveBeenCalled();
	});

	it('should successfully remove a vote when delta is -1', async () => {
		const mockEnrichedCard = { ...mockCard, voteCount: 2, commentCount: 0 };
		const mockVotingData = {
			user_voting_data: {
				user_votes: [],
				voting_allocation: { currentVotes: 0, maxVotes: 5, remainingVotes: 5, canVote: true }
			},
			voting_stats: {
				totalUsers: 3,
				activeUsers: 3,
				usersWhoVoted: 0,
				usersWhoHaventVoted: 3,
				totalVotesCast: 0,
				maxPossibleVotes: 15,
				remainingVotes: 15,
				maxVotesPerUser: 5
			}
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getVoteContext).mockResolvedValue(createMockVoteContext({ currentVoteCount: 1 }));
		vi.mocked(castVote).mockResolvedValue({ action: 'removed', voteId: 'vote-1' });
		vi.mocked(findCardById).mockResolvedValue(mockCard as any);
		vi.mocked(enrichCardWithCounts).mockResolvedValue(mockEnrichedCard as any);
		vi.mocked(buildComprehensiveVotingData).mockResolvedValue(mockVotingData as any);
		vi.mocked(getVoteCountsByCard).mockResolvedValue({});

		const event = createMockRequestEvent({
			method: 'POST',
			params: { id: 'card-1' },
			body: { delta: -1 }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(castVote).toHaveBeenCalledWith('card-1', 'user-1', -1);
	});

	it('should return 400 when request body is invalid JSON', async () => {
		vi.mocked(requireUser).mockReturnValue(mockUser);

		const event = createMockRequestEvent({
			method: 'POST',
			params: { id: 'card-1' }
		});

		// Override the request.json() to throw an error
		event.request.json = vi.fn().mockRejectedValue(new Error('Invalid JSON'));

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Invalid JSON in request body');
	});

	it('should return 400 when delta is not 1 or -1', async () => {
		vi.mocked(requireUser).mockReturnValue(mockUser);

		const event = createMockRequestEvent({
			method: 'POST',
			params: { id: 'card-1' },
			body: { delta: 5 }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Invalid delta value. Must be 1 or -1');
	});

	it('should return 404 when card is not found', async () => {
		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getVoteContext).mockResolvedValue(null);

		const event = createMockRequestEvent({
			method: 'POST',
			params: { id: 'card-1' },
			body: { delta: 1 }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(404);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Card not found');
	});

	it('should return 403 when trying to vote on a subordinate card', async () => {
		const subordinateCard = {
			...mockCard,
			groupId: 'group-1',
			isGroupLead: false
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getVoteContext).mockResolvedValue(createMockVoteContext({ card: subordinateCard }));

		const event = createMockRequestEvent({
			method: 'POST',
			params: { id: 'card-1' },
			body: { delta: 1 }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Cannot vote on subordinate cards. Vote on the group lead card instead.');
	});

	it('should return 403 when user does not have access to series', async () => {
		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getVoteContext).mockResolvedValue(createMockVoteContext({ userRole: null }));

		const event = createMockRequestEvent({
			method: 'POST',
			params: { id: 'card-1' },
			body: { delta: 1 }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Access denied');
	});

	it('should return 403 when voting is not allowed in current scene', async () => {
		const boardWithoutVoting = {
			...mockBoard,
			currentScene: {
				id: 'scene-1',
				flags: []
			}
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getVoteContext).mockResolvedValue(createMockVoteContext({ board: boardWithoutVoting }));

		const event = createMockRequestEvent({
			method: 'POST',
			params: { id: 'card-1' },
			body: { delta: 1 }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Voting not allowed in current scene');
	});

	it('should return 400 when user has no votes remaining', async () => {
		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getVoteContext).mockResolvedValue(createMockVoteContext({ currentVoteCount: 5 }));

		const event = createMockRequestEvent({
			method: 'POST',
			params: { id: 'card-1' },
			body: { delta: 1 }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe('No votes remaining');
	});

	it('should return 400 when trying to remove votes but user has none', async () => {
		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getVoteContext).mockResolvedValue(createMockVoteContext({ currentVoteCount: 0 }));

		const event = createMockRequestEvent({
			method: 'POST',
			params: { id: 'card-1' },
			body: { delta: -1 }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe('No votes to remove');
	});

	it('should include all_votes_by_card when showVotes is true', async () => {
		const mockEnrichedCard = { ...mockCard, voteCount: 3, commentCount: 0 };
		const mockVotingData = {
			user_voting_data: {
				user_votes: ['card-1'],
				voting_allocation: { currentVotes: 1, maxVotes: 5, remainingVotes: 4, canVote: true }
			},
			voting_stats: {
				totalUsers: 3,
				activeUsers: 3,
				usersWhoVoted: 1,
				usersWhoHaventVoted: 2,
				totalVotesCast: 1,
				maxPossibleVotes: 15,
				remainingVotes: 14,
				maxVotesPerUser: 5
			}
		};
		const mockVoteCountsByCard = {
			'card-1': 2,
			'card-2': 1
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getVoteContext).mockResolvedValue(createMockVoteContext());
		vi.mocked(castVote).mockResolvedValue({ action: 'added', voteId: 'vote-1' });
		vi.mocked(findCardById).mockResolvedValue(mockCard as any);
		vi.mocked(enrichCardWithCounts).mockResolvedValue(mockEnrichedCard as any);
		vi.mocked(buildComprehensiveVotingData).mockResolvedValue(mockVotingData as any);
		vi.mocked(getVoteCountsByCard).mockResolvedValue(mockVoteCountsByCard);

		const event = createMockRequestEvent({
			method: 'POST',
			params: { id: 'card-1' },
			body: { delta: 1 }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(data.all_votes_by_card).toEqual({
			'card-1': 2,
			'card-2': 1
		});
		expect(getVoteCountsByCard).toHaveBeenCalledWith('board-1');
		expect(broadcastVoteChanged).toHaveBeenCalled();
	});

	it('should broadcast to user only when votes are hidden but voting is allowed', async () => {
		const boardWithHiddenVotes = {
			...mockBoard,
			currentScene: {
				id: 'scene-1',
				flags: ['allow_voting']
			}
		};
		const mockEnrichedCard = { ...mockCard, voteCount: 3, commentCount: 0 };
		const mockVotingData = {
			user_voting_data: {
				user_votes: ['card-1'],
				voting_allocation: { currentVotes: 1, maxVotes: 5, remainingVotes: 4, canVote: true }
			},
			voting_stats: {
				totalUsers: 3,
				activeUsers: 3,
				usersWhoVoted: 1,
				usersWhoHaventVoted: 2,
				totalVotesCast: 1,
				maxPossibleVotes: 15,
				remainingVotes: 14,
				maxVotesPerUser: 5
			}
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getVoteContext).mockResolvedValue(createMockVoteContext({ board: boardWithHiddenVotes }));
		vi.mocked(castVote).mockResolvedValue({ action: 'added', voteId: 'vote-1' });
		vi.mocked(findCardById).mockResolvedValue(mockCard as any);
		vi.mocked(enrichCardWithCounts).mockResolvedValue(mockEnrichedCard as any);
		vi.mocked(buildComprehensiveVotingData).mockResolvedValue(mockVotingData as any);

		const event = createMockRequestEvent({
			method: 'POST',
			params: { id: 'card-1' },
			body: { delta: 1 }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(broadcastVoteChangedToUser).toHaveBeenCalledWith('board-1', 'card-1', 3, 'user-1');
		expect(broadcastVoteChanged).not.toHaveBeenCalled();
		expect(data.all_votes_by_card).toBeUndefined();
	});

	it('should return 404 when card is not found after vote update', async () => {
		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getVoteContext).mockResolvedValue(createMockVoteContext());
		vi.mocked(castVote).mockResolvedValue({ action: 'added', voteId: 'vote-1' });
		vi.mocked(findCardById).mockResolvedValue(null); // Card not found after vote

		const event = createMockRequestEvent({
			method: 'POST',
			params: { id: 'card-1' },
			body: { delta: 1 }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(404);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Card not found after vote update');
	});

	it('should handle authentication errors by rethrowing Response', async () => {
		const authError = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
		vi.mocked(requireUser).mockImplementation(() => {
			throw authError;
		});

		const event = createMockRequestEvent({
			method: 'POST',
			params: { id: 'card-1' },
			body: { delta: 1 }
		});

		await expect(POST(event)).rejects.toThrow(Response);
	});

	it('should return 500 on general failure', async () => {
		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getVoteContext).mockRejectedValue(new Error('Database error'));

		const event = createMockRequestEvent({
			method: 'POST',
			params: { id: 'card-1' },
			body: { delta: 1 }
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(500);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Failed to cast vote');
		expect(data.details).toBe('Database error');
	});

	it('should update presence when casting a vote', async () => {
		const mockEnrichedCard = { ...mockCard, voteCount: 1, commentCount: 0 };
		const mockVotingData = {
			user_voting_data: {
				user_votes: ['card-1'],
				voting_allocation: { currentVotes: 1, maxVotes: 5, remainingVotes: 4, canVote: true }
			},
			voting_stats: {
				totalUsers: 1,
				activeUsers: 1,
				usersWhoVoted: 1,
				usersWhoHaventVoted: 0,
				totalVotesCast: 1,
				maxPossibleVotes: 5,
				remainingVotes: 4,
				maxVotesPerUser: 5
			}
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getVoteContext).mockResolvedValue(createMockVoteContext());
		vi.mocked(castVote).mockResolvedValue({ action: 'added', voteId: 'vote-1' });
		vi.mocked(findCardById).mockResolvedValue(mockCard as any);
		vi.mocked(enrichCardWithCounts).mockResolvedValue(mockEnrichedCard as any);
		vi.mocked(buildComprehensiveVotingData).mockResolvedValue(mockVotingData as any);
		vi.mocked(getVoteCountsByCard).mockResolvedValue({ 'card-1': 1 });

		const event = createMockRequestEvent({
			method: 'POST',
			params: { id: 'card-1' },
			body: { delta: 1 }
		});

		await POST(event);

		expect(updatePresence).toHaveBeenCalledWith('user-1', 'board-1');
	});
});
