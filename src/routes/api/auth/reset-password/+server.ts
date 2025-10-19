import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { validatePasswordResetToken } from '$lib/server/auth/password-reset.js';
import { updateUserPassword } from '$lib/server/repositories/user.js';

const resetPasswordSchema = z.object({
	token: z.string().min(1),
	newPassword: z.string().min(8)
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { token, newPassword } = resetPasswordSchema.parse(body);

		// Validate the token
		const validationResult = await validatePasswordResetToken(token);

		if (!validationResult.valid) {
			return json({ error: validationResult.error }, { status: 400 });
		}

		// Update the user's password
		await updateUserPassword(validationResult.userId, newPassword);

		return json({ success: true });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return json({ error: 'Invalid input' }, { status: 400 });
		}
		console.error('Failed to reset password:', error);
		return json({ error: 'Failed to reset password' }, { status: 500 });
	}
};
