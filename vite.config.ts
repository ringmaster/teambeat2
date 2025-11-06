import { sentrySvelteKit } from "@sentry/sveltekit";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sentrySvelteKit({
      sourceMapsUploadOptions: {
        org: "critical-hit-qr",
        project: "teambeat",
        authToken: process.env.SENTRY_AUTH_TOKEN,
      },
      // Disable Sentry features when auth token is not provided
      autoUploadSourceMaps: !!process.env.SENTRY_AUTH_TOKEN,
    }),
    sveltekit(),
  ],
  server: {
    allowedHosts: [".ngrok-free.app", "teambeat.ngrok.dev", ".ngrok.app"],
  },
});
