import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { getUserByEmail } from '$lib/server/repositories/user.js';
import { generatePasswordResetToken } from '$lib/server/auth/password-reset.js';
import { emailService, isEmailConfigured } from '$lib/server/email/index.js';
import { passwordResetTemplate } from '$lib/server/email/templates.js';
import { checkRateLimit } from '$lib/server/rate-limit.js';

const requestSchema = z.object({
	email: z.string().email()
});

export const POST: RequestHandler = async ({ request, getClientAddress, url }) => {
	if (!isEmailConfigured) {
		return json(
			{
				success: false,
				error: 'Password reset not available on this server'
			},
			{ status: 400 }
		);
	}

	const body = await request.json();
	const result = requestSchema.safeParse(body);

	if (!result.success) {
		// Always return success to prevent email enumeration
		return json({
			success: true,
			message: 'If an account exists with that email, a password reset link has been sent.'
		});
	}

	const email = result.data.email;
	const clientIp = getClientAddress();

	// Primary rate limit: 3 requests per email per hour
	const emailRateLimitKey = `password-reset:email:${email}`;
	const emailRateLimit = await checkRateLimit(emailRateLimitKey, 3, 60 * 60 * 1000);

	if (!emailRateLimit.allowed) {
		return json(
			{
				success: false,
				error: 'Too many password reset requests. Please try again in an hour.'
			},
			{ status: 429 }
		);
	}

	// Secondary rate limit: 20 requests per IP per hour (allows teams, prevents abuse)
	const ipRateLimitKey = `password-reset:ip:${clientIp}`;
	const ipRateLimit = await checkRateLimit(ipRateLimitKey, 20, 60 * 60 * 1000);

	if (!ipRateLimit.allowed) {
		return json(
			{
				success: false,
				error: 'Too many password reset requests from your network. Please try again later.'
			},
			{ status: 429 }
		);
	}

	const user = await getUserByEmail(email);

	// Always return success to prevent email enumeration
	if (!user || !user.passwordHash) {
		return json({
			success: true,
			message: 'If an account exists with that email, a password reset link has been sent.'
		});
	}

	const token = generatePasswordResetToken(user.id, user.passwordHash);
	const resetUrl = `${url.origin}/reset-password?token=${token}`;
	const html = passwordResetTemplate(resetUrl, user.name || user.email);

	const emailResult = await emailService.send({
		to: user.email,
		subject: 'Reset your TeamBeat password',
		html,
	});

	if (!emailResult.success) {
		console.error('Failed to send password reset email:', emailResult.error);
		// Still return success to prevent enumeration
	}

	return json({
		success: true,
		message: 'If an account exists with that email, a password reset link has been sent.'
	});
};
