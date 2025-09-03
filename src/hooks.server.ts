import type { Handle } from '@sveltejs/kit';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { wsManager } from '$lib/server/websockets/manager.js';
import { getSession } from '$lib/server/auth/session.js';

let wss: WebSocketServer | null = null;

export const handle: Handle = async ({ event, resolve }) => {
	// Initialize WebSocket server on first request
	if (!wss) {
		wss = new WebSocketServer({ port: 8080 });
		
		wss.on('connection', (ws, request) => {
			const clientId = uuidv4();
			const url = new URL(request.url || '', `http://${request.headers.host}`);
			const sessionId = url.searchParams.get('session');
			
			let userId: string | null = null;
			if (sessionId) {
				const session = getSession(sessionId);
				if (session) {
					userId = session.userId;
				}
			}
			
			wsManager.addClient(clientId, ws, userId);
			
			ws.on('message', (data) => {
				try {
					const message = JSON.parse(data.toString());
					handleWebSocketMessage(clientId, message);
				} catch (error) {
					console.error('Invalid WebSocket message from client', clientId, error);
				}
			});
		});
		
		console.log('WebSocket server started on port 8080');
	}
	
	const response = await resolve(event);
	return response;
};

function handleWebSocketMessage(clientId: string, message: any) {
	switch (message.type) {
		case 'join_board':
			if (message.board_id && message.user_id) {
				wsManager.updateClientBoard(clientId, message.board_id, message.user_id);
				
				// Broadcast user joined
				wsManager.broadcastToBoard(message.board_id, {
					type: 'user_joined',
					board_id: message.board_id,
					user_id: message.user_id,
					timestamp: Date.now()
				}, clientId);
			}
			break;
			
		case 'leave_board':
			if (message.board_id && message.user_id) {
				// Broadcast user left
				wsManager.broadcastToBoard(message.board_id, {
					type: 'user_left',
					board_id: message.board_id,
					user_id: message.user_id,
					timestamp: Date.now()
				}, clientId);
			}
			break;
			
		case 'presence_update':
			if (message.board_id && message.user_id) {
				wsManager.broadcastToBoard(message.board_id, {
					type: 'presence_update',
					board_id: message.board_id,
					user_id: message.user_id,
					activity: message.activity,
					timestamp: Date.now()
				}, clientId);
			}
			break;
			
		case 'ping':
			// Respond to ping with pong
			const client = wsManager.getClient(clientId);
			if (client && client.ws.readyState === client.ws.OPEN) {
				client.ws.send(JSON.stringify({
					type: 'pong',
					timestamp: Date.now()
				}));
			}
			break;
			
		default:
			console.log('Unknown WebSocket message type:', message.type);
	}
}