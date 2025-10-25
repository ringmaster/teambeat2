import { getBoardPresence } from "../repositories/presence.js";
import { buildVotingStats } from "./voting-data.js";

export interface PresenceUser {
	userId: string;
	lastSeen: number;
	currentActivity?: string | null;
}

export interface PresenceData {
	presence: PresenceUser[];
	connected_users_count: number;
	voting_stats: any; // Use the VotingStats type from voting-data.ts
}

/**
 * Builds complete presence data including connected users and voting stats
 * This function is used by both API endpoints and SSE broadcasts
 */
export async function buildPresenceData(
	boardId: string,
): Promise<PresenceData> {
	const presence = await getBoardPresence(boardId);
	const votingStats = await buildVotingStats(boardId);

	return {
		presence,
		connected_users_count: presence.length,
		voting_stats: votingStats,
	};
}
