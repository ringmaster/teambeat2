import { getSession } from './session.js';
import type { SessionData } from './session.js';
import type { RequestEvent } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

export function getUser(event: RequestEvent): SessionData | null {
	const sessionId = event.cookies.get('session');
	if (!sessionId) {
		console.warn('[Auth] No session cookie found');
		return null;
	}

	const session = getSession(sessionId);
	if (!session) {
		console.warn('[Auth] Session not found or expired:', sessionId.substring(0, 8) + '...');
	}

	return session;
}

export function requireUser(event: RequestEvent): SessionData {
	const user = getUser(event);
	if (!user) {
		// Redirect to login page with return URL
		const returnUrl = event.url.pathname + event.url.search;
		throw redirect(303, `/login?redirect=${encodeURIComponent(returnUrl)}`);
	}
	return user;
}

export function requireUserForApi(event: RequestEvent): SessionData {
	const user = getUser(event);
	if (!user) {
		// Return 401 JSON response for API endpoints
		throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}
	return user;
}

export function setSessionCookie(event: RequestEvent, sessionId: string): void {
	// Detect HTTPS from request URL or proxy headers
	const isSecure = event.request.headers.get('x-forwarded-proto') === 'https'
		|| event.request.url.startsWith('https://');

	event.cookies.set('session', sessionId, {
		path: '/',
		httpOnly: true,
		secure: isSecure,
		sameSite: 'lax',
		maxAge: 7 * 24 * 60 * 60 // 7 days
	});
}

export function clearSessionCookie(event: RequestEvent): void {
	event.cookies.delete('session', { path: '/' });
}