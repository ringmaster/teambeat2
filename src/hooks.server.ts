import type { Handle } from '@sveltejs/kit';
import { performanceTracker } from '$lib/server/performance/tracker';

export const handle: Handle = async ({ event, resolve }) => {
	const start = Date.now();
	const response = await resolve(event);
	const duration = Date.now() - start;

	// Track API performance (only for API routes)
	if (event.url.pathname.startsWith('/api/')) {
		performanceTracker.recordApiRequest(
			duration,
			event.request.method,
			event.url.pathname,
			response.status
		);
	}

	return response;
};
