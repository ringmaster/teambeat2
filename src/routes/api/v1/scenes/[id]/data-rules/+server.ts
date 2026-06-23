import { json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireApiV1Auth } from "$lib/server/auth/index.js";
import { getUserRoleInSeries } from "$lib/server/repositories/board-series.js";
import { db } from "$lib/server/db/index.js";
import { scenes, boards } from "$lib/server/db/schema.js";
import { getDataSceneRules, replaceDataSceneRules } from "$lib/server/repositories/data-scene-rules.js";
import type { RequestHandler } from "./$types";

const ruleSchema = z.object({
	seq: z.number().int().optional(),
	section: z.string().default(""),
	label: z.string().default(""),
	query: z.string().default(""),
	panelSize: z.enum(["small", "medium", "full"]).default("medium"),
	titleTemplate: z.string().default(""),
	bodyTemplate: z.string().default(""),
	copyTemplate: z.string().nullable().optional(),
	emphasisPath: z.string().nullable().optional(),
	emphasisMap: z.string().nullable().optional(),
	builtinTemplate: z.string().nullable().optional(),
});

async function getSeriesForScene(sceneId: string) {
	const [row] = await db
		.select({ seriesId: boards.seriesId })
		.from(scenes)
		.innerJoin(boards, eq(scenes.boardId, boards.id))
		.where(eq(scenes.id, sceneId))
		.limit(1);
	return row?.seriesId ?? null;
}

export const GET: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const sceneId = event.params.id;
		const seriesId = await getSeriesForScene(sceneId);
		if (!seriesId) return json({ success: false, error: "Scene not found" }, { status: 404 });
		const role = await getUserRoleInSeries(user.userId, seriesId);
		if (!role) return json({ success: false, error: "Access denied" }, { status: 403 });
		const rules = await getDataSceneRules(sceneId);
		return json({ success: true, rules });
	} catch (err) {
		if (err instanceof Response) return err as Response;
		return json({ success: false, error: "Failed to fetch rules" }, { status: 500 });
	}
};

export const PUT: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const sceneId = event.params.id;
		const seriesId = await getSeriesForScene(sceneId);
		if (!seriesId) return json({ success: false, error: "Scene not found" }, { status: 404 });
		const role = await getUserRoleInSeries(user.userId, seriesId);
		if (!role || (role !== "admin" && role !== "facilitator")) {
			return json({ success: false, error: "Facilitator or admin required" }, { status: 403 });
		}
		const body = await event.request.json();
		const rules = z.array(ruleSchema).parse(body);
		const saved = await replaceDataSceneRules(sceneId, rules);
		return json({ success: true, rules: saved });
	} catch (err) {
		if (err instanceof Response) return err as Response;
		if (err instanceof z.ZodError) return json({ success: false, error: "Invalid input", details: err.errors }, { status: 400 });
		return json({ success: false, error: "Failed to save rules" }, { status: 500 });
	}
};
