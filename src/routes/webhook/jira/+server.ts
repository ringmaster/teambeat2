import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const payload = await request.json();

		console.log('=== JIRA Webhook Received ===');
		console.log('Timestamp:', new Date().toISOString());
		console.log('Payload:', JSON.stringify(payload, null, 2));
		console.log('=== End JIRA Webhook ===');

		return json({ success: true, message: 'Webhook received and logged' });
	} catch (error) {
		console.error('Error processing JIRA webhook:', error);
		return json({ success: false, error: 'Failed to process webhook' }, { status: 500 });
	}
};
