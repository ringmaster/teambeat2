/**
 * Board State Store
 * Centralized state management for board data using Svelte 5 runes
 */

import { SvelteMap, SvelteSet } from "svelte/reactivity";

export interface VotingAllocation {
	currentVotes: number;
	maxVotes: number;
	remainingVotes: number;
	canVote: boolean;
}

export interface VotingStats {
	totalUsers: number;
	usersWhoVoted: number;
	usersWhoHaventVoted: number;
	totalVotesCast: number;
	maxPossibleVotes: number;
	remainingVotes: number;
	maxVotesPerUser: number;
	activeUsers: number;
}

export interface BoardState {
	board: any | null;
	cards: any[];
	user: any | null;
	userRole: string;
	currentScene: any | null;
	comments: any[];
	agreements: any[];
	notesLockStatus: any | null;
	connectedUsers: number;
	votingAllocation: VotingAllocation | null;
	votingStats: VotingStats | null;
	templates: any[];
	lastHealthCheckDate: string | null;
	scorecardCountsByScene: Record<string, number>;
	pollVotes: Record<string, number>;
	timerTotalVotes: number;
}

export function createBoardStore() {
	// Core board data
	let board = $state<any | null>(null);
	let cards = $state<any[]>([]);
	let user = $state<any | null>(null);
	let userRole = $state("");
	let currentScene = $state<any | null>(null);

	// Comments and agreements
	let comments = $state<any[]>([]);
	let agreements = $state<any[]>([]);
	let notesLockStatus = $state<any | null>(null);

	// Presence and connection
	let connectedUsers = $state(0);

	// Voting state
	let votingAllocation = $state<VotingAllocation | null>(null);
	let votingStats = $state<VotingStats | null>(null);
	const userVotesByCard = new SvelteMap<string, number>();
	const allVotesByCard = new SvelteMap<string, number>();

	// Grouping state
	let groupingMode = $state(false);
	const selectedCards = new SvelteSet<string>();

	// Templates and metadata
	let templates = $state<any[]>([]);
	let lastHealthCheckDate = $state<string | null>(null);
	let scorecardCountsByScene = $state<Record<string, number>>({});

	// Poll/Timer state
	let pollVotes = $state<Record<string, number>>({});
	let timerTotalVotes = $state(0);

	// Computed values
	const hasVotes = $derived(votingAllocation?.canVote ?? false);
	const hasActiveTimer = $derived(
		board?.timerStart && board?.timerDuration ? true : false,
	);
	const blameFreeMode = $derived(board?.blameFree ?? false);
	const displayBoard = $derived(board != null);

	// Visible columns based on current scene
	const visibleColumns = $derived.by(() => {
		if (!currentScene || !board?.columns) return board?.columns || [];

		if (!currentScene.columnVisibility) return board.columns;

		const visibilityMap = currentScene.columnVisibility as Record<
			string,
			boolean
		>;
		return board.columns.filter((col: any) => visibilityMap[col.id] !== false);
	});

	return {
		// Getters for state
		get board() {
			return board;
		},
		get cards() {
			return cards;
		},
		get user() {
			return user;
		},
		get userRole() {
			return userRole;
		},
		get currentScene() {
			return currentScene;
		},
		get comments() {
			return comments;
		},
		get agreements() {
			return agreements;
		},
		get notesLockStatus() {
			return notesLockStatus;
		},
		get connectedUsers() {
			return connectedUsers;
		},
		get votingAllocation() {
			return votingAllocation;
		},
		get votingStats() {
			return votingStats;
		},
		get userVotesByCard() {
			return userVotesByCard;
		},
		get allVotesByCard() {
			return allVotesByCard;
		},
		get groupingMode() {
			return groupingMode;
		},
		get selectedCards() {
			return selectedCards;
		},
		get templates() {
			return templates;
		},
		get lastHealthCheckDate() {
			return lastHealthCheckDate;
		},
		get scorecardCountsByScene() {
			return scorecardCountsByScene;
		},
		get pollVotes() {
			return pollVotes;
		},
		get timerTotalVotes() {
			return timerTotalVotes;
		},

		// Computed getters
		get hasVotes() {
			return hasVotes;
		},
		get hasActiveTimer() {
			return hasActiveTimer;
		},
		get blameFreeMode() {
			return blameFreeMode;
		},
		get displayBoard() {
			return displayBoard;
		},
		get visibleColumns() {
			return visibleColumns;
		},

		// Setters for simple updates
		setBoard(value: any) {
			board = value;
		},

		setCards(value: any[]) {
			cards = value;
		},

		setUser(value: any) {
			user = value;
		},

		setUserRole(value: string) {
			userRole = value;
		},

		setCurrentScene(value: any) {
			currentScene = value;
		},

		setComments(value: any[]) {
			comments = value;
		},

		setAgreements(value: any[]) {
			agreements = value;
		},

		setNotesLockStatus(value: any) {
			notesLockStatus = value;
		},

		setConnectedUsers(value: number) {
			connectedUsers = value;
		},

		setVotingAllocation(value: VotingAllocation | null) {
			votingAllocation = value;
		},

		setVotingStats(value: VotingStats | null) {
			votingStats = value;
		},

		setTemplates(value: any[]) {
			templates = value;
		},

		setLastHealthCheckDate(value: string | null) {
			lastHealthCheckDate = value;
		},

		setScorecardCountsByScene(value: Record<string, number>) {
			scorecardCountsByScene = value;
		},

		setPollVotes(value: Record<string, number>) {
			pollVotes = value;
		},

		setTimerTotalVotes(value: number) {
			timerTotalVotes = value;
		},

		setGroupingMode(value: boolean) {
			groupingMode = value;
		},

		// Card operations
		addCard(card: any) {
			cards = [...cards, card];
		},

		updateCard(cardId: string, updates: Partial<any>) {
			cards = cards.map((c) => (c.id === cardId ? { ...c, ...updates } : c));
		},

		removeCard(cardId: string) {
			cards = cards.filter((c) => c.id !== cardId);
		},

		replaceCard(cardId: string, newCard: any) {
			cards = cards.map((c) => (c.id === cardId ? newCard : c));
		},

		// Comment operations
		addComment(comment: any) {
			comments = [...comments, comment];
		},

		updateComment(commentId: string, updates: Partial<any>) {
			comments = comments.map((c) =>
				c.id === commentId ? { ...c, ...updates } : c,
			);
		},

		removeComment(commentId: string) {
			comments = comments.filter((c) => c.id !== commentId);
		},

		// Agreement operations
		addAgreement(agreement: any) {
			agreements = [...agreements, agreement];
		},

		updateAgreement(agreementId: string, updates: Partial<any>) {
			agreements = agreements.map((a) =>
				a.id === agreementId ? { ...a, ...updates } : a,
			);
		},

		removeAgreement(agreementId: string) {
			agreements = agreements.filter((a) => a.id !== agreementId);
		},

		// Board operations
		updateBoard(updates: Partial<any>) {
			if (board) {
				board = { ...board, ...updates };
			}
		},

		// Voting operations
		updateUserVote(cardId: string, count: number) {
			userVotesByCard.set(cardId, count);
		},

		updateAllVotes(cardId: string, count: number) {
			allVotesByCard.set(cardId, count);
		},

		clearUserVotes() {
			userVotesByCard.clear();
		},

		clearAllVotes() {
			allVotesByCard.clear();
		},

		processVotingData(data: {
			votes_by_card?: Record<string, number>;
			all_votes_by_card?: Record<string, number>;
			voting_stats?: VotingStats;
		}) {
			// Update user votes by card map if provided
			if (data.votes_by_card) {
				userVotesByCard.clear();
				Object.entries(data.votes_by_card).forEach(([cardId, count]) => {
					userVotesByCard.set(cardId, count as number);
				});
			}

			// Update all users' votes by card map if provided
			if (data.all_votes_by_card) {
				allVotesByCard.clear();
				Object.entries(data.all_votes_by_card).forEach(([cardId, count]) => {
					allVotesByCard.set(cardId, count as number);
				});

				// Also update the cards array with the new vote counts
				cards = cards.map((card) => ({
					...card,
					voteCount: data.all_votes_by_card![card.id] || 0,
				}));
			}

			// Update voting stats if provided
			if (data.voting_stats) {
				votingStats = data.voting_stats;
			}
		},

		// Grouping operations
		toggleCardSelection(cardId: string) {
			if (selectedCards.has(cardId)) {
				selectedCards.delete(cardId);
			} else {
				selectedCards.add(cardId);
			}
		},

		clearCardSelection() {
			selectedCards.clear();
		},

		// Scene operations
		updateSceneInBoard(sceneId: string, updates: Partial<any>) {
			if (board?.scenes) {
				board = {
					...board,
					scenes: board.scenes.map((s: any) =>
						s.id === sceneId ? { ...s, ...updates } : s,
					),
				};
			}
		},

		// Column operations
		addColumn(column: any) {
			if (board) {
				board = {
					...board,
					columns: [...(board.columns || []), column],
				};
			}
		},

		updateColumn(columnId: string, updates: Partial<any>) {
			if (board?.columns) {
				board = {
					...board,
					columns: board.columns.map((c: any) =>
						c.id === columnId ? { ...c, ...updates } : c,
					),
				};
			}
		},

		removeColumn(columnId: string) {
			if (board?.columns) {
				board = {
					...board,
					columns: board.columns.filter((c: any) => c.id !== columnId),
				};
			}
		},

		reorderColumns(newOrder: any[]) {
			if (board) {
				board = {
					...board,
					columns: newOrder,
				};
			}
		},

		// Scene operations
		addScene(scene: any) {
			if (board) {
				board = {
					...board,
					scenes: [...(board.scenes || []), scene],
				};
			}
		},

		updateScene(sceneId: string, updates: Partial<any>) {
			if (board?.scenes) {
				board = {
					...board,
					scenes: board.scenes.map((s: any) =>
						s.id === sceneId ? { ...s, ...updates } : s,
					),
				};
			}
		},

		removeScene(sceneId: string) {
			if (board?.scenes) {
				board = {
					...board,
					scenes: board.scenes.filter((s: any) => s.id !== sceneId),
				};
			}
		},

		reorderScenes(newOrder: any[]) {
			if (board) {
				board = {
					...board,
					scenes: newOrder,
				};
			}
		},
	};
}

export type BoardStore = ReturnType<typeof createBoardStore>;
