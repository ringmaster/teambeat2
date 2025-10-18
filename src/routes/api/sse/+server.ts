import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { v4 as uuidv4 } from 'uuid';
import { sseManager } from '$lib/server/sse/manager.js';
import { getSession } from '$lib/server/auth/session.js';
import { broadcastUserJoined, broadcastUserLeft, broadcastPresenceUpdate } from '$lib/server/sse/broadcast.js';
import { updatePresence, removePresence } from '$lib/server/repositories/presence.js';
import { MAX_CONNECTIONS_PER_USER } from '$lib/server/constants.js';

// Shared function to create SSE connection for both GET and POST
const createSSEConnection = async (cookies: any, boardId: string | null) => {
  // Get session from cookies
  const sessionId = cookies.get('session');
  let userId: string | null = null;

  if (sessionId) {
    const session = getSession(sessionId);
    if (session) {
      userId = session.userId;
    }
  }

  const clientId = uuidv4();

  // Check connection limit before creating stream
  if (userId) {
    const userConns = sseManager['userConnections'].get(userId) || new Set();
    if (userConns.size >= MAX_CONNECTIONS_PER_USER) {
      console.log('SSE connection rejected - limit exceeded for user:', userId);
      // Return HTTP 429 Too Many Requests with JSON error
      return json(
        { error: 'Connection limit exceeded', message: 'Too many SSE connections for this user' },
        {
          status: 429,
          headers: {
            'Retry-After': '60'
          }
        }
      );
    }
  }

  // Create readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Add client to manager
      const response = new Response();
      const added = sseManager.addClient(clientId, response, controller, userId, boardId);

      if (!added) {
        // This shouldn't happen since we checked above, but handle it anyway
        console.log('SSE connection rejected unexpectedly');
        controller.enqueue('event: error\n');
        controller.enqueue(`data: ${JSON.stringify({ error: 'Connection limit exceeded', timestamp: Date.now() })}\n\n`);
        controller.close();
        return;
      }

      // Send initial connection event
      controller.enqueue('event: connected\n');
      controller.enqueue(`data: ${JSON.stringify({ clientId, timestamp: Date.now() })}\n\n`);

      // Join board if specified
      if (boardId && userId) {
        sseManager.updateClientBoard(clientId, boardId, userId);
        updatePresence(userId, boardId);
        broadcastUserJoined(boardId, userId);
      }
    },

    cancel() {
      // Clean up when client disconnects
      const client = sseManager.getClient(clientId);
      if (client && client.boardId && client.userId) {
        removePresence(client.userId, client.boardId);
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

export const GET: RequestHandler = async ({ url, cookies }) => {
  const boardId = url.searchParams.get('boardId');
  return createSSEConnection(cookies, boardId);
};

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const requestBody = await request.json();

    // Check if this is an SSE connection request or a control message
    if (requestBody.type === 'sse_connect') {
      // Handle SSE connection establishment via POST
      const { boardId } = requestBody;
      return createSSEConnection(cookies, boardId);
    }

    // Handle SSE control messages (join board, presence updates, etc.)
    const { action, clientId, boardId, userId, data } = requestBody;

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
          updatePresence(userId, boardId);
          await broadcastUserJoined(boardId, userId);
        }
        break;

      case 'leave_board':
        if (client.boardId && client.userId) {
          removePresence(client.userId, client.boardId);
          await broadcastUserLeft(client.boardId, client.userId);
        }
        break;

      case 'presence_update':
        if (client.boardId && client.userId) {
          updatePresence(client.userId, client.boardId, data);
          await broadcastPresenceUpdate(client.boardId, client.userId, data);
        }
        break;

      default:
        return json({ error: 'Unknown action' }, { status: 400 });
    }

    return json({ success: true });

  } catch (error) {
    console.error('SSE POST request error:', error);
    return json({ error: 'Invalid request' }, { status: 400 });
  }
};
