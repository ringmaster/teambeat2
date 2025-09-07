import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { v4 as uuidv4 } from 'uuid';
import { sseManager } from '$lib/server/sse/manager.js';
import { getSession } from '$lib/server/auth/session.js';
import { broadcastUserJoined, broadcastUserLeft, broadcastPresenceUpdate } from '$lib/server/sse/broadcast.js';

export const GET: RequestHandler = async ({ url, request, cookies }) => {
	// Get session from cookies
	const sessionId = cookies.get('session');
	let userId: string | null = null;
	
	if (sessionId) {
		const session = getSession(sessionId);
		if (session) {
			userId = session.userId;
		}
	}
	
	const boardId = url.searchParams.get('boardId');
	const clientId = uuidv4();
	
	// Create readable stream for SSE
	const stream = new ReadableStream({
		start(controller) {
			// Send initial connection event
			controller.enqueue('event: connected\n');
			controller.enqueue(`data: ${JSON.stringify({ clientId, timestamp: Date.now() })}\n\n`);
			
			// Add client to manager
			const response = new Response();
			sseManager.addClient(clientId, response, controller, userId, boardId);
			
			// Join board if specified
			if (boardId && userId) {
				sseManager.updateClientBoard(clientId, boardId, userId);
				broadcastUserJoined(boardId, userId);
			}
		},
		
		cancel() {
			// Clean up when client disconnects
			const client = sseManager.getClient(clientId);
			if (client && client.boardId && client.userId) {
				broadcastUserLeft(client.boardId, client.userId);
			}
			sseManager.removeClient(clientId);
		}
	});
	
	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Headers': 'Cache-Control'
		}
	});
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	// Handle SSE control messages (join board, presence updates, etc.)
	try {
		const { action, clientId, boardId, userId, data } = await request.json();
		
		// Verify session
		const sessionId = cookies.get('session');
		if (!sessionId) {
			return json({ error: 'Not authenticated' }, { status: 401 });
		}
		
		const session = getSession(sessionId);
		if (!session) {
			return json({ error: 'Invalid session' }, { status: 401 });
		}
		
		const client = sseManager.getClient(clientId);
		if (!client) {
			return json({ error: 'Client not found' }, { status: 404 });
		}
		
		switch (action) {
			case 'join_board':
				if (boardId && userId) {
					sseManager.updateClientBoard(clientId, boardId, userId);
					broadcastUserJoined(boardId, userId);
				}
				break;
				
			case 'leave_board':
				if (client.boardId && client.userId) {
					broadcastUserLeft(client.boardId, client.userId);
				}
				break;
				
			case 'presence_update':
				if (client.boardId && client.userId) {
					broadcastPresenceUpdate(client.boardId, client.userId, data);
				}
				break;
				
			default:
				return json({ error: 'Unknown action' }, { status: 400 });
		}
		
		return json({ success: true });
		
	} catch (error) {
		console.error('SSE control message error:', error);
		return json({ error: 'Invalid request' }, { status: 400 });
	}
};