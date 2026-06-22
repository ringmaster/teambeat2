import { json } from "@sveltejs/kit";
import { z } from "zod";
import { requireApiV1Auth } from "$lib/server/auth/index.js";
import { requireSeriesMember } from "$lib/server/api/v1-access.js";
import { findCardById } from "$lib/server/repositories/card.js";
import {
	castVote,
	getVoteContext,
	getVoteCountsByCard,
} from "$lib/server/repositories/vote.js";
import {
	broadcastVoteChanged,
	broadcastVoteChangedToUser,
	broadcastVoteUpdatesBasedOnScene,
} from "$lib/server/sse/broadcast.js";
import { enrichCardWithCounts } from "$lib/server/utils/cards-data.js";
import { buildComprehensiveVotingData } from "$lib/server/utils/voting-data.js";
import { getSceneCapability } from "$lib/utils/scene-capability.js";
import type { RequestHandler } from "./$types";

const voteSchema = z.object({
	delta: z.union([z.literal(1), z.literal(-1)]),
});

export const POST: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const cardId = event.params.id;

		const body = await event.request.json();
		const { delta } = voteSchema.parse(body);

		const context = await getVoteContext(cardId, user.userId);
		if (!context) return json({ success: false, error: "Card not found" }, { status: 404 });

		const { card, board, currentVoteCount } = context;

		if (card.groupId && !card.isGroupLead) {
			return json(
				{ success: false, error: "Cannot vote on subordinate cards. Vote on the group lead card instead." },
				{ status: 403 },
			);
		}

		// Check series membership
		const member = await requireSeriesMember(user.userId, board.seriesId);
		if (!member) return json({ success: false, error: "Access denied" }, { status: 403 });

		if (!getSceneCapability(board.currentScene, board.status, "allow_voting")) {
			return json({ success: false, error: "Voting not allowed in current scene" }, { status: 403 });
		}

		if (delta > 0 && currentVoteCount >= board.votingAllocation) {
			return json({ success: false, error: "No votes remaining" }, { status: 400 });
		}
		if (delta < 0 && currentVoteCount <= 0) {
			return json({ success: false, error: "No votes to remove" }, { status: 400 });
		}

		const voteResult = await castVote(cardId, user.userId, delta);

		const updatedCard = await findCardById(cardId);
		if (!updatedCard) return json({ success: false, error: "Card not found" }, { status: 404 });

		const enrichedCard = await enrichCardWithCounts(updatedCard);
		const voteCount = enrichedCard.voteCount;

		const comprehensiveVotingData = await buildComprehensiveVotingData(
			board.id,
			user.userId,
			board.seriesId,
			board.votingAllocation,
		);

		const canShowVotes = getSceneCapability(board.currentScene, board.status, "show_votes");
		const canAllowVoting = getSceneCapability(board.currentScene, board.status, "allow_voting");

		const response: Record<string, unknown> = {
			success: true,
			card: enrichedCard,
			voteResult,
			user_voting_data: comprehensiveVotingData.user_voting_data,
			voting_stats: comprehensiveVotingData.voting_stats,
		};

		const voteCountsByCard = canShowVotes ? await getVoteCountsByCard(board.id) : undefined;
		if (canShowVotes) response.all_votes_by_card = voteCountsByCard;

		if (canShowVotes) {
			await broadcastVoteChanged(board.id, cardId, voteCount, user.userId);
		} else if (canAllowVoting) {
			await broadcastVoteChangedToUser(board.id, cardId, voteCount, user.userId);
		}

		await broadcastVoteUpdatesBasedOnScene(
			board.id,
			{ showVotes: canShowVotes || undefined, allowVoting: canAllowVoting || undefined },
			user.userId,
			false,
			voteCountsByCard,
			comprehensiveVotingData.voting_stats,
		);

		return json(response);
	} catch (err) {
		if (err instanceof Response) throw err;
		return json({ success: false, error: "Failed to cast vote" }, { status: 500 });
	}
};
