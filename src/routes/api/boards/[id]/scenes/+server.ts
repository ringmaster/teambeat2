import { json } from "@sveltejs/kit";
import { asc, desc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { db } from "$lib/server/db/index.js";
import type { SceneFlag } from "$lib/server/db/scene-flags.js";
import { boards, scenes } from "$lib/server/db/schema.js";
import { findBoardById } from "$lib/server/repositories/board.js";
import { getUserRoleInSeries } from "$lib/server/repositories/board-series.js";
import {
  getSceneFlags,
  setSceneFlags,
} from "$lib/server/repositories/scene.js";
import {
  broadcastSceneChanged,
  broadcastSceneCreated,
} from "$lib/server/sse/broadcast.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const boardId = event.params.id;

    const board = await findBoardById(boardId);
    if (!board) {
      return json(
        { success: false, error: "Board not found" },
        { status: 404 },
      );
    }

    // Check if user has access to the board
    const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
    if (!userRole) {
      return json({ success: false, error: "Access denied" }, { status: 403 });
    }

    // Get all scenes for the board, ordered by sequence
    const boardScenes = await db
      .select()
      .from(scenes)
      .where(eq(scenes.boardId, boardId))
      .orderBy(asc(scenes.seq));

    // Fetch flags for all scenes
    const scenesWithFlags = await Promise.all(
      boardScenes.map(async (scene) => {
        const flags = await getSceneFlags(scene.id);
        return {
          ...scene,
          flags,
        };
      }),
    );

    return json({
      success: true,
      scenes: scenesWithFlags,
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error("Failed to fetch scenes:", error);
    return json(
      { success: false, error: "Failed to fetch scenes" },
      { status: 500 },
    );
  }
};

export const POST: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const boardId = event.params.id;
    const body = await event.request.json();

    // Validate input
    const { title, description, mode, flags } = body;

    if (!title?.trim()) {
      return json(
        { success: false, error: "Scene title is required" },
        { status: 400 },
      );
    }

    if (
      !mode ||
      ![
        "columns",
        "present",
        "review",
        "agreements",
        "scorecard",
        "static",
        "survey",
        "quadrant",
      ].includes(mode)
    ) {
      return json(
        {
          success: false,
          error:
            "Valid scene mode is required (columns, present, review, agreements, scorecard, static, survey, or quadrant)",
        },
        { status: 400 },
      );
    }

    const board = await findBoardById(boardId);
    if (!board) {
      return json(
        { success: false, error: "Board not found" },
        { status: 404 },
      );
    }

    // Check if user has permission to create scenes (admin or facilitator)
    const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
    if (!["admin", "facilitator"].includes(userRole)) {
      return json(
        {
          success: false,
          error: "Only administrators and facilitators can create scenes",
        },
        { status: 403 },
      );
    }

    // Get the next sequence number
    const existingScenes = await db
      .select({ seq: scenes.seq })
      .from(scenes)
      .where(eq(scenes.boardId, boardId))
      .orderBy(desc(scenes.seq))
      .limit(1);

    const nextSeq = existingScenes.length > 0 ? existingScenes[0].seq + 1 : 1;

    // Create the scene
    const sceneId = uuidv4();
    await db.insert(scenes).values({
      id: sceneId,
      boardId: boardId,
      title: title.trim(),
      description: description?.trim() || null,
      mode: mode,
      seq: nextSeq,
      createdAt: new Date().toISOString(),
    });

    // Set flags if provided
    if (flags && Array.isArray(flags) && flags.length > 0) {
      await setSceneFlags(sceneId, flags as SceneFlag[]);
    }

    // Get the created scene with all its details
    const [newScene] = await db
      .select()
      .from(scenes)
      .where(eq(scenes.id, sceneId))
      .limit(1);

    // Add flags to the response
    const sceneFlags = await getSceneFlags(sceneId);
    const newSceneWithFlags = {
      ...newScene,
      flags: sceneFlags,
    };

    // If this is the first scene and board doesn't have a current scene, make it current
    const boardWithCurrentScene = await findBoardById(boardId);
    if (!boardWithCurrentScene.currentSceneId) {
      await db
        .update(boards)
        .set({ currentSceneId: sceneId })
        .where(eq(boards.id, boardId));

      // Broadcast the scene change
      await broadcastSceneChanged(boardId, newSceneWithFlags);
    }

    // Broadcast scene creation to all connected clients
    broadcastSceneCreated(boardId, newSceneWithFlags);

    return json({
      success: true,
      scene: newSceneWithFlags,
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error("Failed to create scene:", error);
    return json(
      { success: false, error: "Failed to create scene" },
      { status: 500 },
    );
  }
};
