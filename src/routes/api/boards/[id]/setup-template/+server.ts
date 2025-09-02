import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { findBoardById } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { db } from '$lib/server/db/index.js';
import { columns, scenes, boards } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export const POST: RequestHandler = async (event) => {
	try {
		const user = requireUser(event);
		const boardId = event.params.id;
		const body = await event.request.json();
		
		const board = await findBoardById(boardId);
		if (!board) {
			return json(
				{ success: false, error: 'Board not found' },
				{ status: 404 }
			);
		}
		
		// Check if user has access to this board
		const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
		if (!userRole) {
			return json(
				{ success: false, error: 'Access denied' },
				{ status: 403 }
			);
		}
		
		// Check if board already has scenes/columns configured
		const existingColumns = await db
			.select()
			.from(columns)
			.where(eq(columns.boardId, boardId));
			
		const existingScenes = await db
			.select()
			.from(scenes)
			.where(eq(scenes.boardId, boardId));
			
		if (existingColumns.length > 0 || existingScenes.length > 0) {
			return json(
				{ success: false, error: 'Board already has configuration' },
				{ status: 400 }
			);
		}
		
		// Define available templates
		const templates = {
			basic: {
				name: "Basic Retrospective",
				columns: [
					{ title: 'What went well?', seq: 1 },
					{ title: 'What could be improved?', seq: 2 },
					{ title: 'Action items', seq: 3 }
				],
				scenes: [
					{
						title: 'Add Cards',
						mode: 'columns' as const,
						seq: 1,
						allowAddCards: true,
						allowEditCards: true,
						allowComments: false,
						allowVoting: false
					},
					{
						title: 'Discuss & Vote',
						mode: 'present' as const,
						seq: 2,
						allowAddCards: false,
						allowEditCards: false,
						allowComments: true,
						allowVoting: true
					},
					{
						title: 'Review Results',
						mode: 'review' as const,
						seq: 3,
						allowAddCards: false,
						allowEditCards: false,
						allowComments: true,
						allowVoting: false
					}
				]
			},
			kafe: {
				name: "KAFE (Keep, Add, Fix, Explore)",
				columns: [
					{ title: 'Keep (What should we continue doing?)', seq: 1 },
					{ title: 'Add (What should we start doing?)', seq: 2 },
					{ title: 'Fix (What should we stop or change?)', seq: 3 },
					{ title: 'Explore (What should we investigate?)', seq: 4 }
				],
				scenes: [
					{
						title: 'Brainstorm',
						mode: 'columns' as const,
						seq: 1,
						allowAddCards: true,
						allowEditCards: true,
						allowComments: false,
						allowVoting: false
					},
					{
						title: 'Group & Discuss',
						mode: 'present' as const,
						seq: 2,
						allowAddCards: false,
						allowEditCards: true,
						allowComments: true,
						allowVoting: false
					},
					{
						title: 'Prioritize',
						mode: 'present' as const,
						seq: 3,
						allowAddCards: false,
						allowEditCards: false,
						allowComments: true,
						allowVoting: true
					},
					{
						title: 'Action Planning',
						mode: 'review' as const,
						seq: 4,
						allowAddCards: false,
						allowEditCards: false,
						allowComments: true,
						allowVoting: false
					}
				]
			},
			startstop: {
				name: "Start, Stop, Continue",
				columns: [
					{ title: 'Start (What should we begin doing?)', seq: 1 },
					{ title: 'Stop (What should we cease doing?)', seq: 2 },
					{ title: 'Continue (What should we keep doing?)', seq: 3 }
				],
				scenes: [
					{
						title: 'Brainstorm',
						mode: 'columns' as const,
						seq: 1,
						allowAddCards: true,
						allowEditCards: true,
						allowComments: false,
						allowVoting: false
					},
					{
						title: 'Discuss',
						mode: 'present' as const,
						seq: 2,
						allowAddCards: false,
						allowEditCards: false,
						allowComments: true,
						allowVoting: true
					},
					{
						title: 'Plan Actions',
						mode: 'review' as const,
						seq: 3,
						allowAddCards: false,
						allowEditCards: false,
						allowComments: true,
						allowVoting: false
					}
				]
			},
			madsadglad: {
				name: "Mad, Sad, Glad",
				columns: [
					{ title: 'Mad (What frustrated us?)', seq: 1 },
					{ title: 'Sad (What disappointed us?)', seq: 2 },
					{ title: 'Glad (What made us happy?)', seq: 3 }
				],
				scenes: [
					{
						title: 'Share Feelings',
						mode: 'columns' as const,
						seq: 1,
						allowAddCards: true,
						allowEditCards: true,
						allowComments: false,
						allowVoting: false
					},
					{
						title: 'Explore Together',
						mode: 'present' as const,
						seq: 2,
						allowAddCards: false,
						allowEditCards: false,
						allowComments: true,
						allowVoting: false
					},
					{
						title: 'Find Solutions',
						mode: 'review' as const,
						seq: 3,
						allowAddCards: true,
						allowEditCards: true,
						allowComments: true,
						allowVoting: true
					}
				]
			},
			fourls: {
				name: "4 L's (Liked, Learned, Lacked, Longed for)",
				columns: [
					{ title: 'Liked (What did we enjoy?)', seq: 1 },
					{ title: 'Learned (What did we discover?)', seq: 2 },
					{ title: 'Lacked (What was missing?)', seq: 3 },
					{ title: 'Longed for (What did we wish for?)', seq: 4 }
				],
				scenes: [
					{
						title: 'Reflect',
						mode: 'columns' as const,
						seq: 1,
						allowAddCards: true,
						allowEditCards: true,
						allowComments: false,
						allowVoting: false
					},
					{
						title: 'Share Insights',
						mode: 'present' as const,
						seq: 2,
						allowAddCards: false,
						allowEditCards: false,
						allowComments: true,
						allowVoting: false
					},
					{
						title: 'Prioritize Improvements',
						mode: 'present' as const,
						seq: 3,
						allowAddCards: false,
						allowEditCards: false,
						allowComments: true,
						allowVoting: true
					},
					{
						title: 'Create Action Plan',
						mode: 'review' as const,
						seq: 4,
						allowAddCards: true,
						allowEditCards: true,
						allowComments: true,
						allowVoting: false
					}
				]
			},
			leancoffee: {
				name: "Lean Coffee",
				columns: [
					{ title: 'Topics to Discuss', seq: 1 },
					{ title: 'Currently Discussing', seq: 2 },
					{ title: 'Discussed', seq: 3 }
				],
				scenes: [
					{
						title: 'Propose Topics',
						mode: 'columns' as const,
						seq: 1,
						allowAddCards: true,
						allowEditCards: true,
						allowComments: false,
						allowVoting: false
					},
					{
						title: 'Vote on Topics',
						mode: 'present' as const,
						seq: 2,
						allowAddCards: false,
						allowEditCards: false,
						allowComments: false,
						allowVoting: true
					},
					{
						title: 'Discuss Topics',
						mode: 'present' as const,
						seq: 3,
						allowAddCards: false,
						allowEditCards: true,
						allowComments: true,
						allowVoting: false
					}
				]
			}
		};
		
		// Determine which template to use
		const templateType = body.template || 'basic';
		const selectedTemplate = templates[templateType] || templates.basic;
		
		const templateColumns = selectedTemplate.columns;
		const templateScenes = selectedTemplate.scenes;
		
		// Create template in a transaction
		await db.transaction((tx) => {
			// Create columns from template
			for (const col of templateColumns) {
				tx
					.insert(columns)
					.values({
						id: uuidv4(),
						boardId: board.id,
						title: col.title,
						seq: col.seq
					})
					.run();
			}
			
			// Create scenes from template
			let currentSceneId: string | null = null;
			for (const scene of templateScenes) {
				const sceneId = uuidv4();
				if (!currentSceneId) currentSceneId = sceneId;
				
				tx
					.insert(scenes)
					.values({
						id: sceneId,
						boardId: board.id,
						...scene
					})
					.run();
			}
			
			// Set current scene to first scene
			if (currentSceneId) {
				tx
					.update(boards)
					.set({ currentSceneId })
					.where(eq(boards.id, board.id))
					.run();
			}
		});
		
		return json({ success: true });
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}
		
		return json(
			{ success: false, error: 'Failed to setup board template' },
			{ status: 500 }
		);
	}
};