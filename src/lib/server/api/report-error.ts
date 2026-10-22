import * as Sentry from "@sentry/sveltekit";

/**
 * Log an error that an API handler caught and turned into a 500 response,
 * and send it to Sentry with its stack trace.
 * Sentry.captureException does nothing when Sentry is not initialized (no SENTRY_DSN).
 */
export function reportApiError(label: string, err: unknown): void {
	console.error(label, err);
	Sentry.captureException(err, { tags: { api_handler: label } });
}
