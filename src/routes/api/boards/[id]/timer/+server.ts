import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth';
import { findBoardById, startBoardTimer, stopBoardTimer, getBoardTimer, updateBoardTimer } from '$lib/server/repositories/board';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series';
import { broadcastToBoardUsers } from '$lib/server/sse/broadcast';

export const POST: RequestHandler = async (event) => {
  const user = await requireUser(event);
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

    const { duration } = await event.request.json();
    if (typeof duration !== 'number' || duration <= 0) {
      return json({ success: false, error: 'Invalid duration' }, { status: 400 });
    }

    // Start the timer
    const updatedBoard = await startBoardTimer(boardId, duration);

    // Broadcast to all users
    const timerData = {
      timer_passed: 0,
      timer_remaining: duration,
      active: true
    };

    broadcastToBoardUsers(boardId, {
      type: 'timer_update',
      data: timerData
    });

    return json({ success: true, timer: timerData });
  } catch (error) {
    console.error('Failed to start timer:', error);
    return json({ success: false, error: 'Failed to start timer' }, { status: 500 });
  }
};

export const PUT: RequestHandler = async (event) => {
  const user = await requireUser(event);
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
    const updatedBoard = await updateBoardTimer(boardId, addSeconds);

    // Get updated timer state
    const timerData = await getBoardTimer(boardId);

    // Broadcast to all users
    broadcastToBoardUsers(boardId, {
      type: 'timer_update',
      data: timerData
    });

    return json({ success: true, timer: timerData });
  } catch (error) {
    console.error('Failed to update timer:', error);
    return json({ success: false, error: 'Failed to update timer' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async (event) => {
  const user = await requireUser(event);
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
    await stopBoardTimer(boardId);

    // Broadcast to all users
    const timerData = {
      timer_passed: 0,
      timer_remaining: 0,
      active: false
    };

    broadcastToBoardUsers(boardId, {
      type: 'timer_update',
      data: timerData
    });

    return json({ success: true });
  } catch (error) {
    console.error('Failed to stop timer:', error);
    return json({ success: false, error: 'Failed to stop timer' }, { status: 500 });
  }
};

// GET endpoint removed - timer data is hydrated from board data during SSR
// and updated via SSE broadcasts
