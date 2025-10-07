import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { findUserByEmail } from '$lib/server/repositories/user.js';
import { verifyPassword } from '$lib/server/auth/password.js';
import { createSession } from '$lib/server/auth/session.js';
import { setSessionCookie } from '$lib/server/auth/index.js';
import { z } from 'zod';

const loginSchema = z.object({
	email: z.string().email('Invalid email format'),
	password: z.string().min(1)
});

export const POST: RequestHandler = async (event) => {
	const { request, cookies } = event;
	try {
		const body = await request.json();
		const data = loginSchema.parse(body);
		
		const user = await findUserByEmail(data.email);
		if (!user || !verifyPassword(data.password, user.passwordHash)) {
			return json(
				{ success: false, error: 'Invalid email or password' },
				{ status: 401 }
			);
		}
		
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
			{ success: false, error: 'Login failed' },
			{ status: 500 }
		);
	}
};