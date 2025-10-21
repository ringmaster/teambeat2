import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUser } from '$lib/server/auth/index.js';
import { setEmailVerified, findUserById } from '$lib/server/repositories/user.js';

export const PUT: RequestHandler = async (event) => {
	const sessionUser = getUser(event);

	if (!sessionUser) {
		return json(
			{ success: false, error: 'Unauthorized' },
			{ status: 401 }
		);
	}

	// Check if user is admin
	const user = await findUserById(sessionUser.userId);
	if (!user || !user.is_admin) {
		return json(
			{ success: false, error: 'Unauthorized' },
			{ status: 403 }
		);
	}

	const { userId } = event.params;
	const body = await event.request.json();
	const { verified } = body;

	if (typeof verified !== 'boolean') {
		return json(
			{ success: false, error: 'Invalid request: verified must be a boolean' },
			{ status: 400 }
		);
	}

	try {
		await setEmailVerified(userId, verified);

		return json({
			success: true,
			message: `User email verification set to ${verified}`
		});
	} catch (error) {
		console.error('Failed to update email verification:', error);
		return json(
			{ success: false, error: 'Failed to update email verification' },
			{ status: 500 }
		);
	}
};
