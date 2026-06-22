import { json } from "@sveltejs/kit";
import { z } from "zod";
import { requireApiV1Auth } from "$lib/server/auth/index.js";
import { requireSeriesMember } from "$lib/server/api/v1-access.js";
import { getBoardWithDetails, updateBoardScene } from "$lib/server/repositories/board.js";
import { broadcastSceneChanged } from "$lib/server/sse/broadcast.js";
import type { RequestHandler } from "./$types";

const changeSceneSchema = z.object({
	sceneId: z.string().uuid(),
});

export const PATCH: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const boardId = event.params.id;

		const body = await event.request.json();
		const { sceneId } = changeSceneSchema.parse(body);

		const board = await getBoardWithDetails(boardId);
		if (!board) return json({ success: false, error: "Board not found" }, { status: 404 });

		const member = await requireSeriesMember(user.userId, board.seriesId);
		if (!member || (member.role !== "admin" && member.role !== "facilitator"))
			return json({ success: false, error: "Only facilitators and admins can change the active scene" }, { status: 403 });

		const scene = board.scenes.find((s) => s.id === sceneId);
		if (!scene) return json({ success: false, error: "Scene not found on this board" }, { status: 404 });

		await updateBoardScene(boardId, sceneId);
		await broadcastSceneChanged(boardId, scene, { forceReturn: true });

		return json({ success: true, scene: { id: scene.id, title: scene.title, mode: scene.mode } });
	} catch (err) {
		if (err instanceof Response) throw err;
		if (err instanceof z.ZodError)
			return json({ success: false, error: "Invalid input", details: err.errors }, { status: 400 });
		return json({ success: false, error: "Failed to change scene" }, { status: 500 });
	}
};
