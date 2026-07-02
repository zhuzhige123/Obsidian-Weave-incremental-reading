import path from "node:path";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [
		svelte({
			hot: !process.env.VITEST,
			compilerOptions: {
				runes: true,
				compatibility: {
					componentApi: 4,
				},
			},
		}),
	],
	resolve: {
		// Force client-side Svelte for @testing-library/svelte (avoid index-server.js mount errors).
		conditions: ["browser", "import", "module", "default"],
		alias: {
			obsidian: path.resolve(projectRoot, "src/tests/mocks/obsidian.ts"),
		},
	},
	define: {
		__WEAVE_EPUB_STANDALONE__: JSON.stringify(false),
		__WEAVE_IR_STANDALONE__: JSON.stringify(true),
	},
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["src/tests/setup.ts"],
		include: ["src/**/*.{test,spec}.ts"],
		exclude: [
			"**/node_modules/**",
			"dist/**",
			".obsidian-community-publish/**",
			".obsidian-community-staging/**",
			".desktop-hot-reload/**",
			".mobile-hot-reload/**",
		],
	},
});
