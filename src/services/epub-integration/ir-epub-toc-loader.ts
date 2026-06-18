import { Notice, type App } from "obsidian";
import { EpubError } from "./epub-error";
import { getBookExtensionFromPath } from "./book-format";
import {
	getEpubReaderInteropFailureMessage,
	getEpubReaderInteropHost,
	resolveEpubReaderInteropFailure,
} from "./epub-reader-interop";
import type { TocItem } from "./types";

/**
 * 为 IR 导入流程加载书籍目录：委托 Weave EPUB 阅读器插件。
 */
export async function loadEpubTocForIrImport(app: App, filePath: string): Promise<TocItem[]> {
	const reader = getEpubReaderInteropHost(app);
	if (typeof reader?.loadPublicationTocItems === "function") {
		return reader.loadPublicationTocItems(filePath);
	}

	const failure = resolveEpubReaderInteropFailure(app);
	const message =
		failure != null
			? getEpubReaderInteropFailureMessage(app, failure)
			: buildLegacyReaderRequiredMessage(filePath);

	new Notice(message, 8000);
	throw new EpubError("reader_interop_unavailable", message, {
		reason: failure ?? "missing-api",
		filePath,
	});
}

function buildLegacyReaderRequiredMessage(filePath: string): string {
	const extension = getBookExtensionFromPath(filePath);
	const formatHint =
		extension && extension !== "epub"
			? `（当前为 .${extension}，需阅读器支持该格式）`
			: "";
	return `导入书籍目录需要启用 Weave EPUB 阅读器插件${formatHint}。请在社区插件中安装并启用「weave-epub-reader」。`;
}
