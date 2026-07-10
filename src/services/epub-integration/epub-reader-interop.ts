import type { App } from "obsidian";
import {
	EPUB_READER_PLUGIN_ID,
	getEpubReaderDisplayName,
	getEpubReaderPluginAvailability,
	getEpubReaderUnavailableMessage,
} from "../../utils/epub-reader-access";
import { i18n } from "../../utils/i18n";
import { getObsidianPluginAs } from "../../utils/obsidian-plugin-registry";
import type { IrEpubStorageLike } from "./ir-epub-storage-types";
import type { TocItem } from "./types";

/**
 * weave-epub-reader 对 standalone IR 暴露的互操作面。
 * 目录解析、章节导航与链接生成由阅读器插件负责；IR 只做编排与导入。
 */
export interface EpubReaderInteropHost {
	getEpubStorageService?: () => IrEpubStorageLike;
	loadPublicationTocItems?: (filePath: string) => Promise<TocItem[]>;
	navigateToPublicationChapter?: (
		filePath: string,
		tocHref: string,
		options?: { sourceId?: string; sourceMarkdownPath?: string },
	) => Promise<void>;
	buildPublicationChapterMarkdownLink?: (
		filePath: string,
		tocHref: string,
		chapterTitle?: string,
		sourceId?: string,
		chapterIndex?: number,
	) => string;
}

export function getEpubReaderInteropHost(
	app: App,
): EpubReaderInteropHost | null {
	return getObsidianPluginAs<EpubReaderInteropHost>(app, EPUB_READER_PLUGIN_ID);
}

export function hasEpubReaderTocInterop(app: App): boolean {
	const host = getEpubReaderInteropHost(app);
	return typeof host?.loadPublicationTocItems === "function";
}

export function hasEpubReaderChapterNavigationInterop(app: App): boolean {
	const host = getEpubReaderInteropHost(app);
	return typeof host?.navigateToPublicationChapter === "function";
}

export type EpubReaderInteropFailureReason =
	| "missing"
	| "disabled"
	| "failed"
	| "api-missing";

export function resolveEpubReaderInteropFailure(
	app: App,
): EpubReaderInteropFailureReason | null {
	if (hasEpubReaderTocInterop(app)) {
		return null;
	}

	const availability = getEpubReaderPluginAvailability(app);
	if (availability === "available") {
		return "api-missing";
	}
	return availability;
}

export function getEpubReaderInteropFailureMessage(
	app: App,
	reason: EpubReaderInteropFailureReason,
): string {
	if (reason === "api-missing") {
		return i18n.t("irMain.epubReader.unavailableOutdated", {
			displayName: getEpubReaderDisplayName(),
			pluginId: EPUB_READER_PLUGIN_ID,
		});
	}
	return getEpubReaderUnavailableMessage(app);
}
