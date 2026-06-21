import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
				// Consult https://svelte.dev/docs/kit/integrations
				// for more information about preprocessors
				preprocess: [vitePreprocess({ script: true })],

				compilerOptions: {
								runes: true,
				},

				// Suppress state_referenced_locally in board/[id] — the cards $state
				// is correctly reactive; the onMount usage is intentional (runs once at
				// mount with the SSR-populated value, then SSE handlers reassign cards).
				onwarn(warning, handler) {
								if (
												warning.code === "state_referenced_locally" &&
												warning.filename?.includes("board/[id]")
								) {
												return;
								}
								handler(warning);
				},

				kit: {
				 // adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
					// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
					// See https://svelte.dev/docs/kit/adapters for more information about adapters.
					adapter: adapter(),

				 experimental: {
					 tracing: {
						 server: true,
						},

					 instrumentation: {
						 server: true,
						},
					},
				},
};

export default config;