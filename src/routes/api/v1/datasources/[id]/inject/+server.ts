import { json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { requireApiV1Auth } from "$lib/server/auth/index.js";
import { requireSeriesMember } from "$lib/server/api/v1-access.js";
import { db } from "$lib/server/db/index.js";
import {
	scorecardDatasources,
	scorecards,
	sceneScorecards,
	sceneScorecardResults,
} from "$lib/server/db/schema.js";
import type { RequestHandler } from "./$types";

const injectSchema = z.object({
	data: z
		.array(
			z.object({
				section: z.string().min(1).max(100),
				title: z.string().min(1).max(200),
				primaryValue: z.string().max(200).optional().nullable(),
				secondaryValues: z.record(z.string()).optional().nullable(),
				severity: z.enum(["info", "warning", "critical"]).optional().default("info"),
				sourceData: z.any().optional().nullable(),
			}),
		)
		.min(1)
		.max(500),
});

export const POST: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const datasourceId = event.params.id;

		// Load datasource + its scorecard + series for access check
		const [datasource] = await db
			.select({
				id: scorecardDatasources.id,
				sourceType: scorecardDatasources.sourceType,
				scorecardId: scorecardDatasources.scorecardId,
				seriesId: scorecards.seriesId,
			})
			.from(scorecardDatasources)
			.innerJoin(scorecards, eq(scorecards.id, scorecardDatasources.scorecardId))
			.where(eq(scorecardDatasources.id, datasourceId))
			.limit(1);

		if (!datasource)
			return json({ success: false, error: "Datasource not found" }, { status: 404 });

		if (datasource.sourceType !== "ai")
			return json(
				{ success: false, error: "Access denied: datasource is not of type 'ai'" },
				{ status: 403 },
			);

		const member = await requireSeriesMember(user.userId, datasource.seriesId);
		if (!member)
			return json({ success: false, error: "Access denied" }, { status: 403 });

		const body = await event.request.json();
		const { data } = injectSchema.parse(body);

		// Store as pending injection on the datasource's apiConfig field.
		// The next scorecard collection pass will pick this up.
		await db
			.update(scorecardDatasources)
			.set({
				apiConfig: JSON.stringify({ injected: data, injectedAt: new Date().toISOString() }),
				updatedAt: new Date().toISOString(),
			})
			.where(eq(scorecardDatasources.id, datasourceId));

		// Also immediately write results into any active scene_scorecards for this datasource
		// so facilitators see them without re-running collection.
		const activeScorecards = await db
			.select({ id: sceneScorecards.id })
			.from(sceneScorecards)
			.where(eq(sceneScorecards.scorecardId, datasource.scorecardId));

		for (const sc of activeScorecards) {
			// Remove prior AI-injected results for this datasource+sceneScorecard
			await db
				.delete(sceneScorecardResults)
				.where(
					and(
						eq(sceneScorecardResults.sceneScorecardId, sc.id),
						eq(sceneScorecardResults.datasourceId, datasourceId),
					),
				);

			// Insert fresh results
			for (let i = 0; i < data.length; i++) {
				const item = data[i];
				await db.insert(sceneScorecardResults).values({
					id: uuidv4(),
					sceneScorecardId: sc.id,
					datasourceId,
					section: item.section,
					title: item.title,
					primaryValue: item.primaryValue ?? null,
					secondaryValues: item.secondaryValues ? JSON.stringify(item.secondaryValues) : null,
					severity: item.severity ?? "info",
					sourceData: item.sourceData ? JSON.stringify(item.sourceData) : null,
					seq: i + 1,
				});
			}
		}

		return json({ success: true, injected: data.length });
	} catch (err) {
		if (err instanceof Response) throw err;
		if (err instanceof z.ZodError) {
			return json(
				{ success: false, error: "Invalid input", details: err.errors },
				{ status: 400 },
			);
		}
		console.error("[v1 datasource inject]", err);
		return json({ success: false, error: "Failed to inject data" }, { status: 500 });
	}
};
