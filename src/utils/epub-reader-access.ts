import { Notice, type App } from "obsidian";
import type { EpubHostReaderCapabilities } from "../services/epub-integration/epub-host";
import { i18n } from "./i18n";
import { getObsidianPluginAs } from "./obsidian-plugin-registry";

export const EPUB_READER_PLUGIN_ID = "weave-epub-reader";

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

export function getEpubReaderDisplayName(): string {
	return i18n.t("irMain.epubReader.displayName");
}

/** @deprecated Use {@link getEpubReaderDisplayName} for localized display name. */
export const EPUB_READER_DISPLAY_NAME = "Weave EPUB 阅读器";

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
	const displayName = getEpubReaderDisplayName();
	const availability = getEpubReaderPluginAvailability(app);
	if (availability === "failed") {
		return i18n.t("irMain.epubReader.unavailableFailed", {
			displayName,
			pluginId: EPUB_READER_PLUGIN_ID,
		});
	}
	if (availability === "disabled") {
		return i18n.t("irMain.epubReader.unavailableDisabled", {
			displayName,
			pluginId: EPUB_READER_PLUGIN_ID,
		});
	}
	return i18n.t("irMain.epubReader.unavailableMissing", {
		displayName,
		pluginId: EPUB_READER_PLUGIN_ID,
	});
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
