import { json } from "@sveltejs/kit";
import { getUser } from "$lib/server/auth";
import {
	broadcastTimerUpdate,
	getPollConfig,
	recordPollVote,
	recordTimerVote,
} from "$lib/server/repositories/board";
import { featureTracker } from "$lib/server/analytics/feature-tracker.js";

export async function POST(event: any) {
	const { request } = event;
	const user = getUser(event);

	if (!user) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
		});
	}

	const data = await request.json();
	const { boardId, timerId, choice } = data;

	if (!boardId || !choice) {
		return new Response(JSON.stringify({ error: "Missing required fields" }), {
			status: 400,
		});
	}

	const userId = user.userId;

	// Check poll type to determine how to record the vote
	const pollConfig = getPollConfig(boardId);

	if (pollConfig?.pollType === "timer") {
		// Legacy timer mode with A/B voting
		if (!timerId || !["A", "B"].includes(choice)) {
			return new Response(
				JSON.stringify({ error: "Invalid timer vote choice" }),
				{ status: 400 },
			);
		}
		recordTimerVote(timerId, userId, choice as "A" | "B");
	} else {
		// Poll mode with flexible choice strings
		recordPollVote(boardId, userId, choice);
	}

	// Track feature usage
	featureTracker.trackFeature('timer', 'vote_cast', userId, {
		boardId,
		metadata: { pollType: pollConfig?.pollType || 'poll', choice }
	});

	const message = await broadcastTimerUpdate(boardId);

	return json({ success: true, message });
}
