import type { RequestEvent } from '@sveltejs/kit';
import { vi } from 'vitest';

/**
 * Creates a mock RequestEvent for testing SvelteKit endpoints
 */
export function createMockRequestEvent(options: {
	method?: string;
	url?: string;
	params?: Record<string, string>;
	body?: unknown;
	locals?: Record<string, unknown>;
	cookies?: Map<string, string>;
}): RequestEvent {
	const {
		method = 'GET',
		url = 'http://localhost:5173',
		params = {},
		body = null,
		locals = {},
		cookies = new Map()
	} = options;

	const requestInit: RequestInit = { method };

	if (body) {
		requestInit.body = JSON.stringify(body);
		requestInit.headers = { 'Content-Type': 'application/json' };
	}

	const request = new Request(url, requestInit);

	return {
		request,
		params,
		url: new URL(url),
		locals,
		cookies: {
			get: vi.fn((name: string) => cookies.get(name)),
			set: vi.fn(),
			delete: vi.fn(),
			serialize: vi.fn()
		},
		fetch: vi.fn(),
		getClientAddress: vi.fn(() => '127.0.0.1'),
		platform: undefined,
		route: { id: '/api/test' },
		setHeaders: vi.fn(),
		isDataRequest: false,
		isSubRequest: false
	} as unknown as RequestEvent;
}

/**
 * Creates a mock user in locals for authenticated requests
 */
export function withAuthenticatedUser(
	event: RequestEvent,
	user: { userId: string; email: string; name: string }
): RequestEvent {
	return {
		...event,
		locals: {
			...event.locals,
			user
		}
	};
}
