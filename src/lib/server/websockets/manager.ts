import type { WebSocket } from 'ws';

export interface WebSocketMessage {
	type: string;
	board_id: string;
	[key: string]: any;
}

export interface ConnectedClient {
	ws: WebSocket;
	userId: string | null;
	boardId: string | null;
	lastSeen: number;
}

class WebSocketManager {
	private clients = new Map<string, ConnectedClient>();
	private boardClients = new Map<string, Set<string>>();
	
	addClient(clientId: string, ws: WebSocket, userId: string | null = null, boardId: string | null = null) {
		const client: ConnectedClient = {
			ws,
			userId,
			boardId,
			lastSeen: Date.now()
		};
		
		this.clients.set(clientId, client);
		
		if (boardId) {
			if (!this.boardClients.has(boardId)) {
				this.boardClients.set(boardId, new Set());
			}
			this.boardClients.get(boardId)!.add(clientId);
		}
		
		ws.on('close', () => {
			this.removeClient(clientId);
		});
		
		ws.on('error', (error) => {
			console.error('WebSocket error for client', clientId, error);
			this.removeClient(clientId);
		});
	}
	
	removeClient(clientId: string) {
		const client = this.clients.get(clientId);
		if (client && client.boardId) {
			const boardClients = this.boardClients.get(client.boardId);
			if (boardClients) {
				boardClients.delete(clientId);
				if (boardClients.size === 0) {
					this.boardClients.delete(client.boardId);
				}
			}
		}
		this.clients.delete(clientId);
	}
	
	updateClientBoard(clientId: string, boardId: string, userId?: string) {
		const client = this.clients.get(clientId);
		if (!client) return;
		
		// Remove from old board if exists
		if (client.boardId) {
			const oldBoardClients = this.boardClients.get(client.boardId);
			if (oldBoardClients) {
				oldBoardClients.delete(clientId);
				if (oldBoardClients.size === 0) {
					this.boardClients.delete(client.boardId);
				}
			}
		}
		
		// Add to new board
		client.boardId = boardId;
		if (userId) client.userId = userId;
		client.lastSeen = Date.now();
		
		if (!this.boardClients.has(boardId)) {
			this.boardClients.set(boardId, new Set());
		}
		this.boardClients.get(boardId)!.add(clientId);
	}
	
	broadcastToBoard(boardId: string, message: WebSocketMessage, excludeClientId?: string) {
		const boardClients = this.boardClients.get(boardId);
		if (!boardClients) return;
		
		const messageString = JSON.stringify(message);
		
		for (const clientId of boardClients) {
			if (excludeClientId && clientId === excludeClientId) continue;
			
			const client = this.clients.get(clientId);
			if (client && client.ws.readyState === client.ws.OPEN) {
				try {
					client.ws.send(messageString);
				} catch (error) {
					console.error('Failed to send message to client', clientId, error);
					this.removeClient(clientId);
				}
			}
		}
	}
	
	sendToClient(clientId: string, message: WebSocketMessage) {
		const client = this.clients.get(clientId);
		if (client && client.ws.readyState === client.ws.OPEN) {
			try {
				client.ws.send(JSON.stringify(message));
			} catch (error) {
				console.error('Failed to send message to client', clientId, error);
				this.removeClient(clientId);
			}
		}
	}
	
	getBoardClients(boardId: string): ConnectedClient[] {
		const clientIds = this.boardClients.get(boardId);
		if (!clientIds) return [];
		
		return Array.from(clientIds)
			.map(id => this.clients.get(id))
			.filter((client): client is ConnectedClient => client !== undefined);
	}
	
	getActiveUserCount(boardId: string): number {
		return this.getBoardClients(boardId)
			.filter(client => client.userId !== null).length;
	}
	
	getClient(clientId: string): ConnectedClient | undefined {
		return this.clients.get(clientId);
	}
	
	cleanupStaleConnections() {
		const staleThreshold = Date.now() - (5 * 60 * 1000); // 5 minutes
		
		for (const [clientId, client] of this.clients.entries()) {
			if (client.lastSeen < staleThreshold || client.ws.readyState !== client.ws.OPEN) {
				this.removeClient(clientId);
			}
		}
	}
}

export const wsManager = new WebSocketManager();

// Cleanup stale connections every 5 minutes
setInterval(() => {
	wsManager.cleanupStaleConnections();
}, 5 * 60 * 1000);