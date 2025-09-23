import { PRESENCE_PING_INTERVAL_MS, SSE_HEARTBEAT_INTERVAL_MS, SSE_STALE_CONNECTION_TIMEOUT_MS } from '../constants.js';
import { getUsersNearingTimeout } from '../repositories/presence.js';

export interface SSEMessage {
  type: string;
  board_id: string;
  [key: string]: any;
}

export interface ConnectedSSEClient {
  response: Response;
  controller: ReadableStreamDefaultController<string>;
  userId: string | null;
  boardId: string | null;
  lastSeen: number;
  lastPingSent?: number;
}

class SSEManager {
  private clients = new Map<string, ConnectedSSEClient>();
  private boardClients = new Map<string, Set<string>>();

  addClient(clientId: string, response: Response, controller: ReadableStreamDefaultController<string>, userId: string | null = null, boardId: string | null = null) {
    const client: ConnectedSSEClient = {
      response,
      controller,
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

    console.log(`SSE client ${clientId} connected, board: ${boardId}, user: ${userId}`);
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

    // Close the SSE stream
    if (client) {
      try {
        client.controller.close();
      } catch {
        // Controller may already be closed
      }
    }

    this.clients.delete(clientId);
    console.log(`SSE client ${clientId} disconnected`);
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

    console.log(`SSE client ${clientId} joined board ${boardId}`);
  }

  broadcastToBoard(boardId: string, message: SSEMessage, excludeUserId?: string) {
    const boardClients = this.boardClients.get(boardId);
    if (!boardClients) return;

    const messageString = `data: ${JSON.stringify(message)}\n\n`;

    for (const clientId of boardClients) {
      const client = this.clients.get(clientId);
      if (client) {
        // Skip this client if we're excluding their userId
        if (excludeUserId && client.userId === excludeUserId) continue;

        try {
          client.controller.enqueue(messageString);
          client.lastSeen = Date.now();
        } catch (error) {
          console.error('Failed to send SSE message to client', clientId, error);
          this.removeClient(clientId);
        }
      }
    }

    console.log(`SSE broadcast to board ${boardId}: ${message.type}, clients: ${boardClients.size}`);
  }

  broadcastToUser(boardId: string, userId: string, message: SSEMessage) {
    const boardClients = this.boardClients.get(boardId);
    if (!boardClients) return;

    const messageString = `data: ${JSON.stringify(message)}\n\n`;
    let sentCount = 0;

    for (const clientId of boardClients) {
      const client = this.clients.get(clientId);
      if (client && client.userId === userId) {
        try {
          client.controller.enqueue(messageString);
          client.lastSeen = Date.now();
          sentCount++;
        } catch (error) {
          console.error('Failed to send SSE message to client', clientId, error);
          this.removeClient(clientId);
        }
      }
    }

    console.log(`SSE message to user ${userId} on board ${boardId}: ${message.type}, clients: ${sentCount}`);
  }

  sendToClient(clientId: string, message: SSEMessage) {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        const messageString = `data: ${JSON.stringify(message)}\n\n`;
        client.controller.enqueue(messageString);
        client.lastSeen = Date.now();
      } catch (error) {
        console.error('Failed to send SSE message to client', clientId, error);
        this.removeClient(clientId);
      }
    }
  }

  getBoardClients(boardId: string): ConnectedSSEClient[] {
    const clientIds = this.boardClients.get(boardId);
    if (!clientIds) return [];

    return Array.from(clientIds)
      .map(id => this.clients.get(id))
      .filter((client): client is ConnectedSSEClient => client !== undefined);
  }

  getActiveUserCount(boardId: string): number {
    return this.getBoardClients(boardId)
      .filter(client => client.userId !== null).length;
  }

  getClient(clientId: string): ConnectedSSEClient | undefined {
    return this.clients.get(clientId);
  }

  getConnectedUsers(boardId: string): { userId: string; clientId: string }[] {
    const boardClients = this.boardClients.get(boardId);
    if (!boardClients) return [];

    const users: { userId: string; clientId: string }[] = [];
    for (const clientId of boardClients) {
      const client = this.clients.get(clientId);
      if (client && client.userId) {
        users.push({ userId: client.userId, clientId });
      }
    }
    return users;
  }

  sendHeartbeat(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.controller.enqueue(`: heartbeat\n\n`);
        client.lastSeen = Date.now();
      } catch (error) {
        console.error('Failed to send heartbeat to client', clientId, error);
        this.removeClient(clientId);
      }
    }
  }

  cleanupStaleConnections() {
    const staleThreshold = Date.now() - SSE_STALE_CONNECTION_TIMEOUT_MS;

    for (const [clientId, client] of this.clients.entries()) {
      if (client.lastSeen < staleThreshold) {
        this.removeClient(clientId);
      }
    }
  }

  async sendPresencePings() {
    const now = Date.now();
    const boardIds = Array.from(this.boardClients.keys());

    for (const boardId of boardIds) {
      try {
        // Get users who are nearing timeout
        const nearTimeoutUsers = await getUsersNearingTimeout(boardId);
        const nearTimeoutUserIds = new Set(nearTimeoutUsers.map(u => u.userId));

        // Find clients for these users and send ping
        const boardClients = this.boardClients.get(boardId);
        if (!boardClients) continue;

        for (const clientId of boardClients) {
          const client = this.clients.get(clientId);
          if (!client || !client.userId) continue;

          // Only send ping if user is nearing timeout and we haven't sent a ping recently
          if (nearTimeoutUserIds.has(client.userId)) {
            const timeSinceLastPing = client.lastPingSent ? now - client.lastPingSent : Infinity;

            if (timeSinceLastPing > PRESENCE_PING_INTERVAL_MS) {
              const pingMessage: SSEMessage = {
                type: 'presence_ping',
                board_id: boardId,
                timestamp: now
              };

              this.sendToClient(clientId, pingMessage);
              client.lastPingSent = now;
            }
          }
        }
      } catch (err) {
        console.error(`Failed to send presence pings for board ${boardId}:`, err);
      }
    }
  }
}

export const sseManager = new SSEManager();

// Cleanup stale connections every 5 minutes
setInterval(() => {
  sseManager.cleanupStaleConnections();
}, SSE_STALE_CONNECTION_TIMEOUT_MS);

// Send heartbeat every 30 seconds to keep connections alive
setInterval(() => {
  for (const [clientId] of sseManager['clients']) {
    sseManager.sendHeartbeat(clientId);
  }
}, SSE_HEARTBEAT_INTERVAL_MS);

// Send presence pings to users nearing timeout
setInterval(() => {
  sseManager.sendPresencePings();
}, PRESENCE_PING_INTERVAL_MS);
