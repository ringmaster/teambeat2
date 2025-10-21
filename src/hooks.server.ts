import type { Handle, RequestEvent } from '@sveltejs/kit';
import { performanceTracker } from '$lib/server/performance/tracker';
import { env } from '$env/dynamic/private';

// Check if rate limiting is disabled via environment variable
const RATE_LIMITING_DISABLED = env.DISABLE_RATE_LIMITING === 'true';

function getRateLimitKey(event: RequestEvent): string {
  // Try multiple headers in order of reliability
  const forwarded = event.request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = event.request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = event.request.headers.get('cf-connecting-ip'); // Cloudflare
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // SvelteKit platform-specific
  const clientAddress = event.getClientAddress();
  if (clientAddress && clientAddress !== '127.0.0.1') {
    return clientAddress;
  }

  // Fallback: use session if authenticated, otherwise penalize all unknown
  const sessionId = event.cookies.get('sessionId');
  if (sessionId) {
    return `session:${sessionId}`;
  }

  // Last resort: everyone without an IP shares one rate limit
  // This is intentionally punitive - if we can't identify you, you get heavily limited
  return 'unknown';
}

// Simple in-memory rate limiter
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  // If rate limiting is disabled, always allow
  if (RATE_LIMITING_DISABLED) {
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

export const handle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;

  // Check if this is a deprecated route
  if (DEPRECATED_ROUTE_PATTERNS.some(pattern => pattern.test(pathname))) {
    return new Response(
      JSON.stringify({
        message: 'This API endpoint has been deprecated. Please reload the page.',
        deprecated_endpoint: pathname,
        code: 410
      }),
      {
        status: 410,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      }
    );
  }

  // Rate limit auth endpoints aggressively
  if (pathname.startsWith('/api/auth/login') || pathname.startsWith('/api/auth/register')) {
    const key = getRateLimitKey(event);
    if (!checkRateLimit(key, 5, 15 * 60 * 1000)) { // 5 requests per 15 minutes
      return new Response('Too many requests', { status: 429 });
    }
  }

  // Rate limit card/board creation
  if (event.request.method === 'POST' && (
    pathname.startsWith('/api/cards') ||
    pathname.startsWith('/api/boards')
  )) {
    const key = getRateLimitKey(event);
    if (!checkRateLimit(key, 30, 60 * 1000)) { // 30 per minute
      return new Response('Too many requests', { status: 429 });
    }
  }

  // Measure performance
	const start = Date.now();
	const response = await resolve(event);
	const duration = Date.now() - start;

	// Track API performance (exclude admin performance routes to avoid feedback loop)
	if (event.route.id && event.route.id.startsWith('/api/') && !event.route.id.startsWith('/api/admin/performance')) {
		performanceTracker.recordApiRequest(
			duration,
			event.request.method,
			event.route.id,
			response.status
		);
	}

	return response;
};
