import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** Used by svelte-check; build options remain in vite.config.ts */
export default {
	preprocess: vitePreprocess(),
	compilerOptions: {
		runes: true,
		compatibility: {
			componentApi: 4,
		},
	},
};
