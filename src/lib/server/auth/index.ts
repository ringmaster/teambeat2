import { getSession } from './session.js';
import type { SessionData } from './session.js';
import type { RequestEvent } from '@sveltejs/kit';

export function getUser(event: RequestEvent): SessionData | null {
	const sessionId = event.cookies.get('session');
	if (!sessionId) {
		return null;
	}
	
	return getSession(sessionId);
}

export function requireUser(event: RequestEvent): SessionData {
	const user = getUser(event);
	if (!user) {
		throw new Response('Unauthorized', { status: 401 });
	}
	return user;
}

export function setSessionCookie(event: RequestEvent, sessionId: string): void {
	event.cookies.set('session', sessionId, {
		path: '/',
		httpOnly: true,
		secure: false, // Set to true in production with HTTPS
		sameSite: 'strict',
		maxAge: 7 * 24 * 60 * 60 // 7 days
	});
}

export function clearSessionCookie(event: RequestEvent): void {
	event.cookies.delete('session', { path: '/' });
}