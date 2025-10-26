// Repository for quadrant position database operations

import { and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "$lib/server/db";
import { quadrantPositions } from "$lib/server/db/schema";
import { withTransaction } from "$lib/server/db/transaction";

export interface QuadrantPosition {
	id: string;
	cardId: string;
	userId: string;
	sceneId: string;
	xValue: number;
	yValue: number;
	createdAt: string;
	updatedAt: string;
}

/**
 * Create or update a quadrant position for a user and card
 * Uses upsert logic based on unique constraint (card_id, user_id, scene_id)
 */
export async function createOrUpdateQuadrantPosition(
	cardId: string,
	userId: string,
	sceneId: string,
	xValue: number,
	yValue: number,
): Promise<QuadrantPosition> {
	return await withTransaction(async (tx) => {
		const now = new Date().toISOString();

		// Try to find existing position
		const existing = await tx
			.select()
			.from(quadrantPositions)
			.where(
				and(
					eq(quadrantPositions.cardId, cardId),
					eq(quadrantPositions.userId, userId),
					eq(quadrantPositions.sceneId, sceneId),
				),
			)
			.limit(1);

		if (existing.length > 0) {
			// Update existing position
			const [updated] = await tx
				.update(quadrantPositions)
				.set({
					xValue,
					yValue,
					updatedAt: now,
				})
				.where(eq(quadrantPositions.id, existing[0].id))
				.returning();
			return updated;
		}

		// Create new position
		const [created] = await tx
			.insert(quadrantPositions)
			.values({
				id: uuidv4(),
				cardId,
				userId,
				sceneId,
				xValue,
				yValue,
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		return created;
	});
}

/**
 * Get all quadrant positions for a scene
 * Optionally filter by userId
 */
export async function getQuadrantPositionsForScene(
	sceneId: string,
	userId?: string,
): Promise<QuadrantPosition[]> {
	if (userId) {
		return await db
			.select()
			.from(quadrantPositions)
			.where(
				and(
					eq(quadrantPositions.sceneId, sceneId),
					eq(quadrantPositions.userId, userId),
				),
			);
	}

	return await db
		.select()
		.from(quadrantPositions)
		.where(eq(quadrantPositions.sceneId, sceneId));
}

/**
 * Get all positions for a specific card in a scene
 * Used for calculating consensus and showing heatmap
 */
export async function getQuadrantPositionsForCard(
	cardId: string,
	sceneId: string,
): Promise<QuadrantPosition[]> {
	return await db
		.select()
		.from(quadrantPositions)
		.where(
			and(
				eq(quadrantPositions.cardId, cardId),
				eq(quadrantPositions.sceneId, sceneId),
			),
		);
}

/**
 * Delete a quadrant position
 */
export async function deleteQuadrantPosition(
	cardId: string,
	userId: string,
	sceneId: string,
): Promise<void> {
	await db
		.delete(quadrantPositions)
		.where(
			and(
				eq(quadrantPositions.cardId, cardId),
				eq(quadrantPositions.userId, userId),
				eq(quadrantPositions.sceneId, sceneId),
			),
		);
}

/**
 * Get all card IDs that have at least one position in a scene
 * Used for filtering placed vs unplaced cards
 */
export async function getPlacedCardIds(sceneId: string): Promise<string[]> {
	const positions = await db
		.selectDistinct({ cardId: quadrantPositions.cardId })
		.from(quadrantPositions)
		.where(eq(quadrantPositions.sceneId, sceneId));

	return positions.map((p) => p.cardId);
}

/**
 * Delete all positions for a scene
 * Used when resetting a quadrant scene
 */
export async function deleteAllPositionsForScene(
	sceneId: string,
): Promise<void> {
	await db
		.delete(quadrantPositions)
		.where(eq(quadrantPositions.sceneId, sceneId));
}
