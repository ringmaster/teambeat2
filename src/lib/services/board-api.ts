/**
 * Board API Service
 * Centralized API calls for board-related operations
 */

export interface BoardData {
	board: any;
	userRole: string;
}

export interface CardsData {
	cards: any[];
}

export interface AgreementsData {
	agreements: any[];
}

export interface ScenesData {
	scenes: any[];
}

export interface PresentModeData {
	cards: any[];
	comments: any[];
	agreements: any[];
	notesLockStatus: any;
}

export interface VotingStatsData {
	totalUsers: number;
	activeUsers: number;
	usersWhoVoted: number;
	usersWhoHaventVoted: number;
	totalVotesCast: number;
	maxPossibleVotes: number;
	remainingVotes: number;
	maxVotesPerUser: number;
}

export interface PresenceData {
	connectedUsers: number;
}

export interface VotingData {
	votes_by_card?: Record<string, number>;
	all_votes_by_card?: Record<string, number>;
	voting_stats?: VotingStatsData;
}

/**
 * Board Operations
 */

export async function fetchBoard(boardId: string): Promise<BoardData> {
	const response = await fetch(`/api/boards/${boardId}`);
	if (!response.ok) {
		throw new Error(`Failed to fetch board: ${response.statusText}`);
	}
	return await response.json();
}

export async function updateBoard(boardId: string, updates: any): Promise<any> {
	const response = await fetch(`/api/boards/${boardId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(updates),
	});
	if (!response.ok) {
		throw new Error(`Failed to update board: ${response.statusText}`);
	}
	return await response.json();
}

export async function cloneBoard(
	boardId: string,
	name: string,
): Promise<{ boardId: string }> {
	const response = await fetch(`/api/boards/${boardId}/clone`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name }),
	});
	if (!response.ok) {
		throw new Error(`Failed to clone board: ${response.statusText}`);
	}
	return await response.json();
}

export async function deleteBoard(boardId: string): Promise<void> {
	const response = await fetch(`/api/boards/${boardId}`, {
		method: "DELETE",
	});
	if (!response.ok) {
		throw new Error(`Failed to delete board: ${response.statusText}`);
	}
}

/**
 * Card Operations
 */

export async function fetchCards(boardId: string): Promise<CardsData> {
	const response = await fetch(`/api/boards/${boardId}/cards`);
	if (!response.ok) {
		throw new Error(`Failed to fetch cards: ${response.statusText}`);
	}
	return await response.json();
}

export async function createCard(
	boardId: string,
	columnId: string,
	content: string,
): Promise<any> {
	const response = await fetch(`/api/boards/${boardId}/cards`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ columnId, content }),
	});
	if (!response.ok) {
		throw new Error(`Failed to create card: ${response.statusText}`);
	}
	return await response.json();
}

export async function updateCard(cardId: string, updates: any): Promise<void> {
	const response = await fetch(`/api/cards/${cardId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(updates),
	});
	if (!response.ok) {
		throw new Error(`Failed to update card: ${response.statusText}`);
	}
}

export async function deleteCard(cardId: string): Promise<void> {
	const response = await fetch(`/api/cards/${cardId}`, {
		method: "DELETE",
	});
	if (!response.ok) {
		throw new Error(`Failed to delete card: ${response.statusText}`);
	}
}

export async function moveCard(
	cardId: string,
	columnId: string,
	sequence: number,
): Promise<void> {
	const response = await fetch(`/api/cards/${cardId}/move`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ columnId, sequence }),
	});
	if (!response.ok) {
		throw new Error(`Failed to move card: ${response.statusText}`);
	}
}

export async function groupCardOnto(
	cardId: string,
	targetCardId: string,
): Promise<void> {
	const response = await fetch(`/api/cards/${cardId}/group-onto`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ targetCardId }),
	});
	if (!response.ok) {
		throw new Error(`Failed to group cards: ${response.statusText}`);
	}
}

export async function groupCards(
	boardId: string,
	cardIds: string[],
	name: string,
): Promise<void> {
	const response = await fetch(`/api/boards/${boardId}/cards/group`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ cardIds, name }),
	});
	if (!response.ok) {
		throw new Error(`Failed to group cards: ${response.statusText}`);
	}
}

/**
 * Voting Operations
 */

export async function voteCard(
	cardId: string,
	increment: number,
): Promise<VotingData> {
	const response = await fetch(`/api/cards/${cardId}/vote`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ increment }),
	});
	if (!response.ok) {
		throw new Error(`Failed to vote on card: ${response.statusText}`);
	}
	return await response.json();
}

export async function clearBoardVotes(boardId: string): Promise<void> {
	const response = await fetch(`/api/boards/${boardId}/votes/clear`, {
		method: "POST",
	});
	if (!response.ok) {
		throw new Error(`Failed to clear votes: ${response.statusText}`);
	}
}

export async function fetchVotingStats(
	boardId: string,
): Promise<VotingStatsData> {
	const response = await fetch(`/api/boards/${boardId}/voting-stats`);
	if (!response.ok) {
		throw new Error(`Failed to fetch voting stats: ${response.statusText}`);
	}
	const data = await response.json();
	return data.voting_stats;
}

export async function fetchUserVotingData(boardId: string): Promise<any> {
	const response = await fetch(`/api/boards/${boardId}/user-votes`);
	if (!response.ok) {
		throw new Error(`Failed to fetch user voting data: ${response.statusText}`);
	}
	return await response.json();
}

/**
 * Scene Operations
 */

export async function fetchScenes(boardId: string): Promise<ScenesData> {
	const response = await fetch(`/api/boards/${boardId}/scenes`);
	if (!response.ok) {
		throw new Error(`Failed to fetch scenes: ${response.statusText}`);
	}
	return await response.json();
}

export async function changeScene(
	boardId: string,
	sceneId: string,
): Promise<any> {
	const response = await fetch(`/api/boards/${boardId}/scene`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ sceneId }),
	});
	if (!response.ok) {
		throw new Error(`Failed to change scene: ${response.statusText}`);
	}
	return await response.json();
}

/**
 * Column Operations
 */

export async function createColumn(
	boardId: string,
	name: string,
): Promise<any> {
	const response = await fetch(`/api/boards/${boardId}/columns`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name }),
	});
	if (!response.ok) {
		throw new Error(`Failed to create column: ${response.statusText}`);
	}
	return await response.json();
}

export async function fetchColumnPresets(
	boardId: string,
): Promise<{ presets: any[] }> {
	const response = await fetch(`/api/boards/${boardId}/column-presets`);
	if (!response.ok) {
		throw new Error(`Failed to fetch column presets: ${response.statusText}`);
	}
	return await response.json();
}

export async function updateColumnDisplay(
	boardId: string,
	sceneId: string,
	columnId: string,
	state: "visible" | "hidden",
): Promise<void> {
	const response = await fetch(
		`/api/boards/${boardId}/scenes/${sceneId}/columns`,
		{
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ columnId, state }),
		},
	);
	if (!response.ok) {
		throw new Error(`Failed to update column display: ${response.statusText}`);
	}
}

/**
 * Scene Management
 */

export async function createScene(
	boardId: string,
	name: string,
	mode: string,
): Promise<any> {
	const response = await fetch(`/api/boards/${boardId}/scenes`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name, mode }),
	});
	if (!response.ok) {
		throw new Error(`Failed to create scene: ${response.statusText}`);
	}
	return await response.json();
}

/**
 * Timer Operations
 */

export async function voteTimer(vote: "up" | "down"): Promise<void> {
	const response = await fetch(`/api/timer/vote`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ vote }),
	});
	if (!response.ok) {
		throw new Error(`Failed to vote on timer: ${response.statusText}`);
	}
}

export async function startTimer(
	boardId: string,
	duration: number,
): Promise<void> {
	const response = await fetch(`/api/boards/${boardId}/timer`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ duration }),
	});
	if (!response.ok) {
		throw new Error(`Failed to start timer: ${response.statusText}`);
	}
}

export async function addTimerTime(
	boardId: string,
	additionalSeconds: number,
): Promise<void> {
	const response = await fetch(`/api/boards/${boardId}/timer`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ additionalSeconds }),
	});
	if (!response.ok) {
		throw new Error(`Failed to add timer time: ${response.statusText}`);
	}
}

export async function stopTimer(boardId: string): Promise<void> {
	const response = await fetch(`/api/boards/${boardId}/timer`, {
		method: "DELETE",
	});
	if (!response.ok) {
		throw new Error(`Failed to stop timer: ${response.statusText}`);
	}
}

/**
 * Presence Operations
 */

export async function updatePresence(
	boardId: string,
	activity: string,
): Promise<void> {
	const response = await fetch(`/api/boards/${boardId}/presence`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ activity }),
	});
	if (!response.ok) {
		throw new Error(`Failed to update presence: ${response.statusText}`);
	}
}

export async function fetchPresence(boardId: string): Promise<PresenceData> {
	const response = await fetch(`/api/boards/${boardId}/presence`);
	if (!response.ok) {
		throw new Error(`Failed to fetch presence: ${response.statusText}`);
	}
	return await response.json();
}

/**
 * Comment Operations
 */

export async function createComment(
	cardId: string,
	content: string,
): Promise<any> {
	const response = await fetch(`/api/comments`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ cardId, content }),
	});
	if (!response.ok) {
		throw new Error(`Failed to create comment: ${response.statusText}`);
	}
	return await response.json();
}

/**
 * Agreement Operations
 */

export async function fetchAgreements(
	boardId: string,
): Promise<AgreementsData> {
	const response = await fetch(`/api/boards/${boardId}/agreements`);
	if (!response.ok) {
		throw new Error(`Failed to fetch agreements: ${response.statusText}`);
	}
	return await response.json();
}

/**
 * Present Mode Data
 */

export async function fetchPresentModeData(
	boardId: string,
): Promise<PresentModeData> {
	const response = await fetch(`/api/boards/${boardId}/present-data`);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch present mode data: ${response.statusText}`,
		);
	}
	return await response.json();
}

/**
 * Template Operations
 */

export async function fetchTemplates(): Promise<{ templates: any[] }> {
	const response = await fetch(`/api/templates`);
	if (!response.ok) {
		throw new Error(`Failed to fetch templates: ${response.statusText}`);
	}
	return await response.json();
}
