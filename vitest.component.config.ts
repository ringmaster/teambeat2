import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		svelte({
			// Prevent loading svelte.config.js which sets runes: true globally.
			// That global flag breaks @testing-library/svelte-core's scaffold
			// (which uses legacy export let). Svelte 5 auto-detects runes mode
			// per-file when $state/$props/$derived are actually used.
			configFile: false,
			preprocess: [vitePreprocess({ script: true })],
			compilerOptions: {},
		}),
	],
	test: {
		globals: true,
		environment: "happy-dom",
		include: ["tests/component/**/*.test.ts"],
		setupFiles: ["tests/component/setup.ts"],
	},
	resolve: {
		// Ensure browser builds of packages are resolved (not SSR/server builds).
		// Without this Svelte loads index-server.js and mount() throws.
		conditions: ["browser"],
		alias: {
			$lib: path.resolve(__dirname, "./src/lib"),
			$app: path.resolve(__dirname, "./tests/component/mocks/app"),
		},
	},
});
