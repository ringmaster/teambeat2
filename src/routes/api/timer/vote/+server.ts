import { json } from "@sveltejs/kit";
import { getUser } from "$lib/server/auth";
import { recordTimerVote, broadcastTimerUpdate } from "$lib/server/repositories/board";

export async function POST(event: any) {
  const { request } = event;
  const user = getUser(event);

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const data = await request.json();
  const { boardId, timerId, choice } = data;

  if (!boardId || !timerId || !choice || !['A', 'B'].includes(choice)) {
    return new Response(JSON.stringify({ error: "Missing or invalid required fields" }), { status: 400 });
  }

  const userId = user.userId;

  // User board repository to update vote information
  recordTimerVote(timerId, userId, choice);

  const message = await broadcastTimerUpdate(boardId);

  return json({ success: true, message });
}
