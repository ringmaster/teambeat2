import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUser } from '$lib/server/auth/index.js';
import { findUserById } from '$lib/server/repositories/user.js';

export const GET: RequestHandler = async (event) => {
	const sessionUser = getUser(event);
	
	if (!sessionUser) {
		return json(
			{ success: false, error: 'Not authenticated' },
			{ status: 401 }
		);
	}
	
	const user = await findUserById(sessionUser.userId);
	
	if (!user) {
		return json(
			{ success: false, error: 'User not found' },
			{ status: 404 }
		);
	}
	
	return json({
		success: true,
		user: {
			id: user.id,
			email: user.email,
			name: user.name
		}
	});
};