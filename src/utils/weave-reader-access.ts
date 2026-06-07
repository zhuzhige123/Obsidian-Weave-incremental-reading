import type { App, Plugin } from "obsidian";

export const WEAVE_MAIN_PLUGIN_ID = "weave";

export function getWeaveMainPlugin(app: App): Plugin | null {
	return app.plugins.getPlugin(WEAVE_MAIN_PLUGIN_ID) ?? null;
}

export function isWeaveMainPluginEnabled(app: App): boolean {
	return Boolean(getWeaveMainPlugin(app));
}
