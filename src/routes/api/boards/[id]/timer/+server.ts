import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserForApi } from '$lib/server/auth';
import { findBoardById, startBoardTimer, stopBoardTimer, getBoardTimer, updateBoardTimer, clearTimerVotes, broadcastTimerUpdate } from '$lib/server/repositories/board';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series';

export const POST: RequestHandler = async (event) => {
  const user = requireUserForApi(event);
  const boardId = event.params.id;

  try {
    const board = await findBoardById(boardId);
    if (!board) {
      return json({ success: false, error: 'Board not found' }, { status: 404 });
    }

    // Check if user is admin or facilitator
    const role = await getUserRoleInSeries(user.userId, board.seriesId);
    if (!role || (role !== 'admin' && role !== 'facilitator')) {
      return json({ success: false, error: 'Only admins and facilitators can manage timers' }, { status: 403 });
    }

    const { duration, pollType, question, choices } = await event.request.json();
    if (typeof duration !== 'number' || duration <= 0) {
      return json({ success: false, error: 'Invalid duration' }, { status: 400 });
    }

    // Start the timer with poll configuration
    const updatedBoard = await startBoardTimer(
      boardId,
      duration,
      pollType || 'timer',
      question,
      choices
    );

    // Clear any previous votes for this new timer session
    if (updatedBoard.timerStart) {
      clearTimerVotes(updatedBoard.timerStart);
    }

    // Broadcast to all users
    await broadcastTimerUpdate(boardId);

    const timerData = await getBoardTimer(boardId);

    return json({ success: true, timer: timerData });
  } catch (error) {
    console.error('Failed to start timer:', error);
    return json({ success: false, error: 'Failed to start timer' }, { status: 500 });
  }
};

export const PUT: RequestHandler = async (event) => {
  const user = requireUserForApi(event);
  const boardId = event.params.id;

  try {
    const board = await findBoardById(boardId);
    if (!board) {
      return json({ success: false, error: 'Board not found' }, { status: 404 });
    }

    // Check if user is admin or facilitator
    const role = await getUserRoleInSeries(user.userId, board.seriesId);
    if (!role || (role !== 'admin' && role !== 'facilitator')) {
      return json({ success: false, error: 'Only admins and facilitators can manage timers' }, { status: 403 });
    }

    const { addSeconds } = await event.request.json();
    if (typeof addSeconds !== 'number') {
      return json({ success: false, error: 'Invalid time to add' }, { status: 400 });
    }

    // Update the timer (handles both creating new and updating existing)
    await updateBoardTimer(boardId, addSeconds);

    // Broadcast to all users
    await broadcastTimerUpdate(boardId);

    const timerData = await getBoardTimer(boardId);

    return json({ success: true, timer: timerData });
  } catch (error) {
    console.error('Failed to update timer:', error);
    return json({ success: false, error: 'Failed to update timer' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async (event) => {
  const user = requireUserForApi(event);
  const boardId = event.params.id;

  try {
    const board = await findBoardById(boardId);
    if (!board) {
      return json({ success: false, error: 'Board not found' }, { status: 404 });
    }

    // Check if user is admin or facilitator
    const role = await getUserRoleInSeries(user.userId, board.seriesId);
    if (!role || (role !== 'admin' && role !== 'facilitator')) {
      return json({ success: false, error: 'Only admins and facilitators can manage timers' }, { status: 403 });
    }

    // Stop the timer
    const updatedBoard = await stopBoardTimer(boardId);

    // Clear votes when timer stops
    if (board.timerStart) {
      clearTimerVotes(board.timerStart);
    }

    // Broadcast to all users
    await broadcastTimerUpdate(boardId);

    return json({ success: true });
  } catch (error) {
    console.error('Failed to stop timer:', error);
    return json({ success: false, error: 'Failed to stop timer' }, { status: 500 });
  }
};

// GET endpoint removed - timer data is hydrated from board data during SSR
// and updated via SSE broadcasts
