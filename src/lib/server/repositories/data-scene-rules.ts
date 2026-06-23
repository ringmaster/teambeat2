import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "$lib/server/db/index.js";
import { dataSceneRules } from "$lib/server/db/schema.js";

export async function getDataSceneRules(sceneId: string) {
  return db.select().from(dataSceneRules).where(eq(dataSceneRules.sceneId, sceneId)).orderBy(dataSceneRules.seq);
}

export async function replaceDataSceneRules(sceneId: string, rules: Omit<typeof dataSceneRules.$inferInsert, "id" | "sceneId">[]) {
  await db.delete(dataSceneRules).where(eq(dataSceneRules.sceneId, sceneId));
  if (rules.length === 0) return [];
  const rows = rules.map((r, i) => ({ ...r, id: uuidv4(), sceneId, seq: r.seq ?? i }));
  await db.insert(dataSceneRules).values(rows);
  return getDataSceneRules(sceneId);
}

export async function copyDataSceneRules(sourceSceneId: string, targetSceneId: string) {
  const existing = await getDataSceneRules(sourceSceneId);
  if (existing.length === 0) return;
  await db.insert(dataSceneRules).values(
    existing.map(r => ({ ...r, id: uuidv4(), sceneId: targetSceneId }))
  );
}
