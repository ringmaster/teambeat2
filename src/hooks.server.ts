import {sequence} from "@sveltejs/kit/hooks";
import * as Sentry from "@sentry/sveltekit";
import type { Handle, RequestEvent } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { performanceTracker } from "$lib/server/performance/tracker";
import "$lib/server/analytics/rollup-service.js"; // Initialize rollup service

// Function to check if rate limiting is disabled
// Check dynamically to support runtime environment variable changes (e.g., in tests)
function isRateLimitingDisabled(): boolean {
				return env.DISABLE_RATE_LIMITING === "true";
}

function getRateLimitKey(event: RequestEvent): string {
				// Try multiple headers in order of reliability
				const forwarded = event.request.headers.get("x-forwarded-for");
				if (forwarded) {
								return forwarded.split(",")[0].trim();
				}

				const realIp = event.request.headers.get("x-real-ip");
				if (realIp) {
								return realIp;
				}

				const cfConnectingIp = event.request.headers.get("cf-connecting-ip"); // Cloudflare
				if (cfConnectingIp) {
								return cfConnectingIp;
				}

				// SvelteKit platform-specific
				const clientAddress = event.getClientAddress();
				if (clientAddress && clientAddress !== "127.0.0.1") {
								return clientAddress;
				}

				// Fallback: use session if authenticated, otherwise penalize all unknown
				const sessionId = event.cookies.get("sessionId");
				if (sessionId) {
								return `session:${sessionId}`;
				}

				// Last resort: everyone without an IP shares one rate limit
				// This is intentionally punitive - if we can't identify you, you get heavily limited
				return "unknown";
}

// Simple in-memory rate limiter
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(
				key: string,
				maxRequests: number,
				windowMs: number,
): boolean {
				// If rate limiting is disabled, always allow
				if (isRateLimitingDisabled()) {
								return true;
				}

				const now = Date.now();
				const limit = rateLimits.get(key);

				if (!limit || now > limit.resetAt) {
								rateLimits.set(key, { count: 1, resetAt: now + windowMs });
								return true;
				}

				if (limit.count >= maxRequests) {
								return false;
				}

				limit.count++;
				return true;
}

// Cleanup old entries periodically
setInterval(() => {
				const now = Date.now();
				for (const [key, limit] of rateLimits.entries()) {
								if (now > limit.resetAt) {
												rateLimits.delete(key);
								}
				}
}, 60000); // Every minute

// Deprecated API endpoint patterns from old Teambeat version
const DEPRECATED_ROUTE_PATTERNS = [
				/^\/api\/realtime/,
				/^\/api\/collections\/presence/,
				// Add more patterns as they are discovered
];

// Conditionally include Sentry handle only if SENTRY_DSN is configured
const handles: Handle[] = [];
if (env.SENTRY_DSN) {
  handles.push(Sentry.sentryHandle());
}

handles.push(async ({ event, resolve }) => {
	const { pathname } = event.url;

	// Check if this is a deprecated route
	if (DEPRECATED_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname))) {
		return new Response(
			JSON.stringify({
				message:
					"This API endpoint has been deprecated. Please reload the page.",
				deprecated_endpoint: pathname,
				code: 410,
			}),
			{
				status: 410,
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "no-cache",
				},
			},
		);
	}

	// Note: Login/register rate limiting is now handled in the endpoints themselves
	// to provide better user feedback with attempt counters

	// Rate limit card/board creation
	if (
		event.request.method === "POST" &&
		(pathname.startsWith("/api/cards") || pathname.startsWith("/api/boards"))
	) {
		const key = getRateLimitKey(event);
		if (!checkRateLimit(key, 30, 60 * 1000)) {
			// 30 per minute
			return new Response(
				JSON.stringify({
					error: "Too many requests. Please slow down.",
				}),
				{
					status: 429,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
	}

	// Measure performance
	const start = Date.now();
	const response = await resolve(event);
	const duration = Date.now() - start;

	// Track API performance (exclude admin performance routes to avoid feedback loop)
	if (
		event.route.id &&
		event.route.id.startsWith("/api/") &&
		!event.route.id.startsWith("/api/admin/performance")
	) {
		performanceTracker.recordApiRequest(
			duration,
			event.request.method,
			event.route.id,
			response.status,
		);
	}

	// Report 500 errors to Sentry
	if (env.SENTRY_DSN && response.status >= 500) {
		try {
			// Clone response to read body without consuming it
			const responseClone = response.clone();
			let errorBody: any;

			try {
				// Try to parse as JSON for better error context
				errorBody = await responseClone.json();
			} catch {
				// If not JSON, try to get text
				try {
					errorBody = await responseClone.text();
				} catch {
					errorBody = 'Unable to read response body';
				}
			}

			// Capture error to Sentry with context
			Sentry.captureException(new Error(`Server Error ${response.status}: ${pathname}`), {
				level: 'error',
				tags: {
					http_status: response.status,
					http_method: event.request.method,
					route_id: event.route.id || 'unknown',
				},
				contexts: {
					response: {
						status: response.status,
						statusText: response.statusText,
						body: errorBody,
					},
					request: {
						url: event.url.toString(),
						method: event.request.method,
						headers: Object.fromEntries(event.request.headers.entries()),
					},
				},
				user: event.locals.user ? {
					id: event.locals.user.userId,
					email: event.locals.user.email,
				} : undefined,
			});
		} catch (sentryError) {
			// Don't let Sentry errors break the response
			console.error('Failed to report error to Sentry:', sentryError);
		}
	}

	// Add cache-control headers to all API endpoints to prevent aggressive caching
	// This is critical for Digital Ocean App Platform and other CDNs that cache GET requests
	if (pathname.startsWith("/api/")) {
		const headers = new Headers(response.headers);
		headers.set(
			"Cache-Control",
			"no-store, no-cache, must-revalidate, proxy-revalidate",
		);
		headers.set("Pragma", "no-cache");
		headers.set("Expires", "0");

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}

	return response;
});

export const handle: Handle = sequence(...handles);
export const handleError = env.SENTRY_DSN ? Sentry.handleErrorWithSentry() : undefined;