import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["tests/unit/**/*.test.ts"],
	},
	resolve: {
		alias: {
			$lib: path.resolve(__dirname, "./src/lib"),
		},
	},
});
