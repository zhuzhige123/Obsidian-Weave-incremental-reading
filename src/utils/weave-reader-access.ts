import type { App } from "obsidian";

export const WEAVE_MAIN_PLUGIN_ID = "weave";

type AppWithPluginRegistry = App & {
	plugins?: {
		getPlugin?: (pluginId: string) => unknown;
	};
};

export function getWeaveMainPlugin(app: App): unknown | null {
	const plugin = (app as AppWithPluginRegistry).plugins?.getPlugin?.(WEAVE_MAIN_PLUGIN_ID);
	if (!plugin || typeof plugin !== "object") {
		return null;
	}
	return plugin;
}

export function isWeaveMainPluginEnabled(app: App): boolean {
	return Boolean(getWeaveMainPlugin(app));
}
