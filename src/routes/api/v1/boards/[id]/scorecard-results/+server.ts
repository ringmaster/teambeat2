import { json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { requireApiV1Auth } from "$lib/server/auth/index.js";
import { getBoardSeriesForUser } from "$lib/server/api/v1-access.js";
import { db } from "$lib/server/db/index.js";
import {
	sceneScorecardResults,
	sceneScorecards,
	scorecardDatasources,
	scorecards,
	scenes,
} from "$lib/server/db/schema.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const boardId = event.params.id;

		const access = await getBoardSeriesForUser(user.userId, boardId);
		if (access === "not_found")
			return json({ success: false, error: "Board not found" }, { status: 404 });
		if (access === "forbidden")
			return json({ success: false, error: "Access denied" }, { status: 403 });

		const results = await db
			.select({
				sceneScorecardId: sceneScorecardResults.sceneScorecardId,
				sceneId: scenes.id,
				sceneTitle: scenes.title,
				scorecardName: scorecards.name,
				datasourceName: scorecardDatasources.name,
				section: sceneScorecardResults.section,
				title: sceneScorecardResults.title,
				primaryValue: sceneScorecardResults.primaryValue,
				secondaryValues: sceneScorecardResults.secondaryValues,
				severity: sceneScorecardResults.severity,
				seq: sceneScorecardResults.seq,
			})
			.from(sceneScorecardResults)
			.innerJoin(
				sceneScorecards,
				eq(sceneScorecards.id, sceneScorecardResults.sceneScorecardId),
			)
			.innerJoin(scenes, eq(scenes.id, sceneScorecards.sceneId))
			.innerJoin(scorecards, eq(scorecards.id, sceneScorecards.scorecardId))
			.innerJoin(
				scorecardDatasources,
				eq(scorecardDatasources.id, sceneScorecardResults.datasourceId),
			)
			.where(eq(scenes.boardId, boardId))
			.orderBy(scenes.seq, sceneScorecardResults.seq);

		// Parse secondaryValues JSON
		const parsedResults = results.map((r) => ({
			...r,
			secondaryValues: r.secondaryValues ? JSON.parse(r.secondaryValues) : null,
		}));

		return json({ success: true, results: parsedResults });
	} catch (err) {
		if (err instanceof Response) throw err;
		return json({ success: false, error: "Failed to fetch scorecard results" }, { status: 500 });
	}
};
