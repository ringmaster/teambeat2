import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Sentry Tunnel Endpoint
 *
 * This endpoint forwards Sentry events from the client to Sentry's servers.
 * It bypasses ad blockers and content blockers that block requests to sentry.io.
 *
 * Documentation: https://docs.sentry.io/platforms/javascript/troubleshooting/#dealing-with-ad-blockers
 */
export const POST: RequestHandler = async ({ request }) => {
	// Only allow tunnel if Sentry is configured
	if (!env.SENTRY_DSN) {
		throw error(404, 'Sentry tunnel not configured');
	}

	try {
		// Extract the Sentry host from the DSN
		const dsnMatch = env.SENTRY_DSN.match(/https:\/\/[^@]+@([^/]+)/);
		if (!dsnMatch) {
			throw error(500, 'Invalid Sentry DSN configuration');
		}

		const sentryHost = dsnMatch[1];
		const envelopeData = await request.text();

		// Parse the envelope to extract the DSN from the first line
		const envelopeLines = envelopeData.split('\n');
		if (envelopeLines.length < 2) {
			throw error(400, 'Invalid Sentry envelope format');
		}

		// First line is JSON with DSN info
		const headerLine = JSON.parse(envelopeLines[0]);
		const projectId = headerLine.dsn?.split('/').pop();

		if (!projectId) {
			throw error(400, 'Could not extract project ID from envelope');
		}

		// Forward to Sentry's ingest endpoint
		const sentryUrl = `https://${sentryHost}/api/${projectId}/envelope/`;

		const response = await fetch(sentryUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-sentry-envelope',
			},
			body: envelopeData,
		});

		// Return the same status code Sentry returned
		return new Response(null, {
			status: response.status,
		});
	} catch (err) {
		console.error('Sentry tunnel error:', err);
		throw error(500, 'Failed to forward error to Sentry');
	}
};
