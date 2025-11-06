import { sentrySvelteKit } from "@sentry/sveltekit";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sentrySvelteKit({
      sourceMapsUploadOptions: {
        org: "critical-hit-qr",
        project: "teambeat",
      },
    }),
    sveltekit(),
  ],
  server: {
    allowedHosts: [".ngrok-free.app", "teambeat.ngrok.dev", ".ngrok.app"],
  },
});
