import type { RequestEvent } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";
import { validateApiToken } from "./api-token.js";
import type { SessionData } from "./session.js";
import { getSession } from "./session.js";

export function getUser(event: RequestEvent): SessionData | null {
	const sessionId = event.cookies.get("session");
	if (!sessionId) {
		console.warn("[Auth] No session cookie found");
		return null;
	}

	const session = getSession(sessionId);
	if (!session) {
		console.warn(
			"[Auth] Session not found or expired:",
			sessionId.substring(0, 8) + "...",
		);
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
		throw new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}
	return user;
}

/**
 * Auth check for v1 API routes. Accepts either a Bearer API token or a session cookie.
 * Must be awaited — token validation is async (DB lookup).
 */
export async function requireApiV1Auth(
	event: RequestEvent,
): Promise<SessionData> {
	const authHeader = event.request.headers.get("Authorization");
	if (authHeader?.startsWith("Bearer ")) {
		const rawToken = authHeader.slice(7).trim();
		const user = await validateApiToken(rawToken);
		if (user) return { userId: user.userId, email: user.email, expiresAt: 0 };
	}

	const sessionUser = getUser(event);
	if (sessionUser) return sessionUser;

	throw new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
		status: 401,
		headers: { "Content-Type": "application/json" },
	});
}

export function setSessionCookie(event: RequestEvent, sessionId: string): void {
	// Detect HTTPS from request URL or proxy headers
	const isSecure =
		event.request.headers.get("x-forwarded-proto") === "https" ||
		event.request.url.startsWith("https://");

	event.cookies.set("session", sessionId, {
		path: "/",
		httpOnly: true,
		secure: isSecure,
		sameSite: "lax",
		maxAge: 7 * 24 * 60 * 60, // 7 days
	});
}

export function clearSessionCookie(event: RequestEvent): void {
	event.cookies.delete("session", { path: "/" });
}
