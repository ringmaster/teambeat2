import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createUser } from '$lib/server/repositories/user.js';
import { createSession } from '$lib/server/auth/session.js';
import { setSessionCookie } from '$lib/server/auth/index.js';
import { z } from 'zod';

const registerSchema = z.object({
	email: z.string().email('Invalid email format'),
	name: z.string().min(1).max(50).optional(),
	password: z.string().min(6).max(100)
});

export const POST: RequestHandler = async (event) => {
	const { request, cookies } = event;
	try {
		const body = await request.json();
		const data = registerSchema.parse(body);
		
		const user = await createUser(data);
		const sessionId = createSession(user.id, user.email);

		setSessionCookie(event, sessionId);

		return json({
			success: true,
			user: {
				id: user.id,
				email: user.email,
				name: user.name
			}
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return json(
				{ success: false, error: 'Invalid input', details: error.errors },
				{ status: 400 }
			);
		}
		
		return json(
			{ success: false, error: 'Registration failed' },
			{ status: 400 }
		);
	}
};