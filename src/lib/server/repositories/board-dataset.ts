import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "$lib/server/db/index.js";
import { boardDatasets, boards } from "$lib/server/db/schema.js";

export async function getBoardDataset(boardId: string) {
  const [row] = await db.select().from(boardDatasets).where(eq(boardDatasets.boardId, boardId)).limit(1);
  return row ?? null;
}

export async function upsertBoardDataset(boardId: string, data: string, updatedBy: string) {
  const existing = await getBoardDataset(boardId);
  const now = new Date().toISOString();
  if (existing) {
    await db.update(boardDatasets).set({ data, updatedAt: now, updatedBy }).where(eq(boardDatasets.boardId, boardId));
  } else {
    await db.insert(boardDatasets).values({ id: uuidv4(), boardId, data, updatedAt: now, updatedBy });
  }
  return getBoardDataset(boardId);
}

// Apply a merge operation (shallow merge, $set, $unset, or full replace via PUT)
export function applyMerge(existing: string | null, body: unknown, fullReplace = false): string {
  if (fullReplace) return JSON.stringify(body);
  const doc = existing ? JSON.parse(existing) : {};
  if (typeof body !== "object" || body === null) return JSON.stringify(body);
  const b = body as Record<string, unknown>;

  if ("$set" in b) {
    const paths = b["$set"] as Record<string, unknown>;
    for (const [path, value] of Object.entries(paths)) {
      setPath(doc, path, value);
    }
    return JSON.stringify(doc);
  }
  if ("$unset" in b) {
    const paths = b["$unset"] as string[];
    for (const path of paths) deletePath(doc, path);
    return JSON.stringify(doc);
  }
  // Shallow merge
  return JSON.stringify({ ...doc, ...b });
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

function deletePath(obj: Record<string, unknown>, path: string) {
  const parts = path.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object") return;
    cur = cur[parts[i]] as Record<string, unknown>;
  }
  delete cur[parts[parts.length - 1]];
}

// Fan out a write to all draft+active boards in a series
export async function fanOutToSeries(seriesId: string, body: unknown, fullReplace = false, updatedBy: string) {
  const boardRows = await db
    .select({ id: boards.id, status: boards.status })
    .from(boards)
    .where(eq(boards.seriesId, seriesId));

  const draftActive = boardRows.filter(b => b.status === "draft" || b.status === "active");

  for (const board of draftActive) {
    const existing = await getBoardDataset(board.id);
    const newData = applyMerge(existing?.data ?? null, body, fullReplace);
    await upsertBoardDataset(board.id, newData, updatedBy);
  }
  return draftActive.length;
}
