import { json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { getUserRoleInSeries } from "$lib/server/repositories/board-series.js";
import { db } from "$lib/server/db/index.js";
import { boards } from "$lib/server/db/schema.js";
import {
  getBoardDataset,
  upsertBoardDataset,
} from "$lib/server/repositories/board-dataset.js";
import { broadcastDataSourceUpdated } from "$lib/server/sse/broadcast.js";
import type { RequestHandler } from "./$types";

async function resolveBoard(boardId: string) {
  const [board] = await db
    .select({ id: boards.id, seriesId: boards.seriesId, status: boards.status })
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);
  return board ?? null;
}

export const GET: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const boardId = event.params.id;
    const board = await resolveBoard(boardId);
    if (!board) return json({ success: false, error: "Board not found" }, { status: 404 });
    const role = await getUserRoleInSeries(user.userId, board.seriesId);
    if (!role) return json({ success: false, error: "Access denied" }, { status: 403 });
    const dataset = await getBoardDataset(boardId);
    return json({
      success: true,
      data: dataset?.data ? JSON.parse(dataset.data) : null,
      updatedAt: dataset?.updatedAt ?? null,
    });
  } catch (err) {
    if (err instanceof Response) return err as Response;
    return json({ success: false, error: "Failed to fetch dataset" }, { status: 500 });
  }
};

export const PUT: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const boardId = event.params.id;
    const board = await resolveBoard(boardId);
    if (!board) return json({ success: false, error: "Board not found" }, { status: 404 });
    const role = await getUserRoleInSeries(user.userId, board.seriesId);
    if (!role || (role !== "admin" && role !== "facilitator"))
      return json({ success: false, error: "Only admins and facilitators can update dataset" }, { status: 403 });
    const body = await event.request.json();
    const updatedAt = new Date().toISOString();
    await upsertBoardDataset(boardId, JSON.stringify(body), user.userId);
    broadcastDataSourceUpdated(boardId);
    return json({ success: true, updatedAt });
  } catch (err) {
    if (err instanceof Response) return err as Response;
    return json({ success: false, error: "Failed to update dataset" }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const boardId = event.params.id;
    const board = await resolveBoard(boardId);
    if (!board) return json({ success: false, error: "Board not found" }, { status: 404 });
    const role = await getUserRoleInSeries(user.userId, board.seriesId);
    if (!role || (role !== "admin" && role !== "facilitator"))
      return json({ success: false, error: "Only admins and facilitators can clear dataset" }, { status: 403 });
    await upsertBoardDataset(boardId, "null", user.userId);
    broadcastDataSourceUpdated(boardId);
    return json({ success: true });
  } catch (err) {
    if (err instanceof Response) return err as Response;
    return json({ success: false, error: "Failed to clear dataset" }, { status: 500 });
  }
};
