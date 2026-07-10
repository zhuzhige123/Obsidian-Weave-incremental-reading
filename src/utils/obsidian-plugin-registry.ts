import type { App, Plugin } from "obsidian";
import type { EpubHostReaderCapabilities } from "../services/epub-integration/epub-host";

export function getObsidianPlugin(app: App, pluginId: string): Plugin | null {
	return app.plugins.getPlugin(pluginId) ?? null;
}

export function getObsidianPluginAs<T extends object>(
	app: App,
	pluginId: string,
): T | null {
	const plugin = getObsidianPlugin(app, pluginId);
	return plugin ? (plugin as T) : null;
}

export function findCollaboratorEpubHost(
	app: App,
	collaboratorPluginIds: readonly string[],
	excludePlugin?: Plugin | null,
): EpubHostReaderCapabilities | null {
	for (const pluginId of collaboratorPluginIds) {
		const plugin = getObsidianPlugin(app, pluginId);
		if (!plugin || plugin === excludePlugin) {
			continue;
		}

		const candidate = plugin as Plugin & EpubHostReaderCapabilities;
		if (typeof candidate.openEpubReader === "function") {
			return candidate;
		}
	}

	return null;
}
