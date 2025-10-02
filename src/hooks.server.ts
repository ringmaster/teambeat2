import type { Handle } from '@sveltejs/kit';
import { performanceTracker } from '$lib/server/performance/tracker';

export const handle: Handle = async ({ event, resolve }) => {
	const start = Date.now();
	const response = await resolve(event);
	const duration = Date.now() - start;

	// Track API performance (exclude admin performance routes to avoid feedback loop)
	if (event.url.pathname.startsWith('/api/') && !event.url.pathname.startsWith('/api/admin/performance')) {
		performanceTracker.recordApiRequest(
			duration,
			event.request.method,
			event.url.pathname,
			response.status
		);
	}

	return response;
};
