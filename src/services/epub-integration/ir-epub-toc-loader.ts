import { Notice, type App } from "obsidian";
import { getBookExtensionFromPath } from "./book-format";
import type { TocItem } from "./types";

const EPUB_READER_PLUGIN_ID = "weave-epub-reader";

type EpubReaderTocHost = {
	loadPublicationTocItems?: (filePath: string) => Promise<TocItem[]>;
};

/**
 * 为 IR 导入流程加载书籍目录：仅委托 Weave EPUB 阅读器插件。
 */
export async function loadEpubTocForIrImport(app: App, filePath: string): Promise<TocItem[]> {
	const reader = (app as { plugins?: { getPlugin?: (id: string) => unknown } }).plugins?.getPlugin?.(
		EPUB_READER_PLUGIN_ID
	) as EpubReaderTocHost | null;
	if (typeof reader?.loadPublicationTocItems === "function") {
		return reader.loadPublicationTocItems(filePath);
	}

	const extension = getBookExtensionFromPath(filePath);
	const formatHint =
		extension && extension !== "epub"
			? `（当前为 .${extension}，需阅读器支持该格式）`
			: "";
	new Notice(
		`导入书籍目录需要启用 Weave EPUB 阅读器插件${formatHint}。请在社区插件中安装并启用「weave-epub-reader」。`,
		8000
	);
	throw new Error("epub-reader-plugin-required");
}
