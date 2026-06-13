import { Notice, type App } from "obsidian";
import type { EpubHostReaderCapabilities } from "../services/epub-integration/epub-host";
import { getObsidianPluginAs } from "./obsidian-plugin-registry";

export const EPUB_READER_PLUGIN_ID = "weave-epub-reader";
export const EPUB_READER_DISPLAY_NAME = "Weave EPUB 阅读器";

const EPUB_READER_NOTICE_COOLDOWN_MS = 8_000;

const recentEpubReaderNotices = new WeakMap<App, number>();

export type EpubReaderPluginAvailability = "available" | "disabled" | "failed" | "missing";

function getPluginManifest(app: App, pluginId: string): unknown {
	const manifests = (app.plugins as { manifests?: Record<string, unknown> } | undefined)?.manifests;
	return manifests?.[pluginId] ?? null;
}

function isPluginEnabledInSettings(app: App, pluginId: string): boolean {
	const enabledPlugins = (app.plugins as { enabledPlugins?: Set<string> } | undefined)?.enabledPlugins;
	return enabledPlugins?.has(pluginId) ?? false;
}

export function getEpubReaderPluginAvailability(app: App): EpubReaderPluginAvailability {
	if (getObsidianPluginAs(app, EPUB_READER_PLUGIN_ID)) {
		return "available";
	}
	if (!getPluginManifest(app, EPUB_READER_PLUGIN_ID)) {
		return "missing";
	}
	if (isPluginEnabledInSettings(app, EPUB_READER_PLUGIN_ID)) {
		return "failed";
	}
	return "disabled";
}

export function isEpubReaderPluginAvailable(app: App): boolean {
	return getEpubReaderPluginAvailability(app) === "available";
}

export function getEpubReaderHost(app: App): EpubHostReaderCapabilities | null {
	return getObsidianPluginAs<EpubHostReaderCapabilities>(app, EPUB_READER_PLUGIN_ID);
}

export function getEpubReaderUnavailableMessage(app: App): string {
	const availability = getEpubReaderPluginAvailability(app);
	if (availability === "failed") {
		return `${EPUB_READER_DISPLAY_NAME}（${EPUB_READER_PLUGIN_ID}）已在社区插件中启用，但当前未能成功加载。请打开开发者控制台查看报错，或在社区插件列表中关闭后重新启用该插件。`;
	}
	if (availability === "disabled") {
		return `${EPUB_READER_DISPLAY_NAME}（${EPUB_READER_PLUGIN_ID}）已安装但未启用。请在 Obsidian 设置 → 社区插件中启用。`;
	}
	return `未检测到 ${EPUB_READER_DISPLAY_NAME}（${EPUB_READER_PLUGIN_ID}）。请在 Obsidian 设置 → 社区插件中安装并启用。`;
}

export function notifyEpubReaderUnavailable(app: App): void {
	if (isEpubReaderPluginAvailable(app)) {
		return;
	}

	const now = Date.now();
	const lastNoticeAt = recentEpubReaderNotices.get(app) ?? 0;
	if (now - lastNoticeAt < EPUB_READER_NOTICE_COOLDOWN_MS) {
		return;
	}
	recentEpubReaderNotices.set(app, now);

	new Notice(getEpubReaderUnavailableMessage(app), 4500);
}
