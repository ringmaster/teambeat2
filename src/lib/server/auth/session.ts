import { v4 as uuidv4 } from 'uuid';

export interface SessionData {
	userId: string;
	email: string;
	expiresAt: number;
}

const sessions = new Map<string, SessionData>();

// Clear existing sessions on startup since we changed the session structure
sessions.clear();
console.info('[Session] Server started - all sessions cleared (users will need to log in again)');

export function createSession(userId: string, email: string): string {
	const sessionId = uuidv4();
	const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days

	sessions.set(sessionId, {
		userId,
		email,
		expiresAt
	});

	console.info('[Session] Created session for user:', email, '(expires in 7 days)');

	return sessionId;
}

export function getSession(sessionId: string): SessionData | null {
	const session = sessions.get(sessionId);
	
	if (!session) {
		return null;
	}
	
	if (session.expiresAt < Date.now()) {
		sessions.delete(sessionId);
		return null;
	}
	
	return session;
}

export function deleteSession(sessionId: string): void {
	const session = sessions.get(sessionId);
	if (session) {
		console.info('[Session] Deleted session for user:', session.email);
	}
	sessions.delete(sessionId);
}

export function cleanupExpiredSessions(): void {
	const now = Date.now();
	for (const [sessionId, session] of sessions.entries()) {
		if (session.expiresAt < now) {
			sessions.delete(sessionId);
		}
	}
}

setInterval(cleanupExpiredSessions, 60 * 60 * 1000);