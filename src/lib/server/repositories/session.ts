import type { SessionData } from "../auth/session.js";
import { getSession } from "../auth/session.js";

export async function getSessionFromCookie(
	sessionCookie: string,
): Promise<SessionData | null> {
	return getSession(sessionCookie);
}
