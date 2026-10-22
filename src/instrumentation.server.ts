import * as Sentry from '@sentry/sveltekit';

// Read process.env, not $env/dynamic/private: this file runs before SvelteKit
// populates $env/dynamic/private, so that object is still empty here.
const dsn = process.env.SENTRY_DSN;

// Only initialize Sentry if SENTRY_DSN is provided
if (dsn) {
  Sentry.init({
    dsn,

    tracesSampleRate: 1.0,

    // Enable logs to be sent to Sentry
    enableLogs: true,

    // uncomment the line below to enable Spotlight (https://spotlightjs.com)
    // spotlight: import.meta.env.DEV,
  });
}
