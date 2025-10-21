import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER;

export const GET: RequestHandler = async () => {
	// Email verification is required if EMAIL_PROVIDER is explicitly set (including 'console')
	// Only when EMAIL_PROVIDER is undefined/empty should verification be disabled
	const isEmailConfigured = !!EMAIL_PROVIDER;

	return json({
		success: true,
		isEmailConfigured
	});
};
