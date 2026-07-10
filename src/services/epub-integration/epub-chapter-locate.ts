import type { App } from "obsidian";
import { EpubLinkService } from "./EpubLinkService";
import { getEpubReaderInteropHost } from "./epub-reader-interop";

/**
 * 章节级 EPUB 阅读点的标准溯源链接（obsidian:// 协议 Markdown 链接）。
 * 优先委托阅读器插件生成，保证与阅读器协议处理器一致。
 */
export function buildEpubChapterResumeLink(
	app: App,
	filePath: string,
	tocHref: string,
	chapterTitle?: string,
	sourceId?: string,
	chapterIndex?: number,
): string {
	const reader = getEpubReaderInteropHost(app);
	if (typeof reader?.buildPublicationChapterMarkdownLink === "function") {
		return reader.buildPublicationChapterMarkdownLink(
			filePath,
			tocHref,
			chapterTitle,
			sourceId,
			chapterIndex,
		);
	}

	const linkService = new EpubLinkService(app);
	return linkService.buildProtocolMarkdownLinkForChapter(
		filePath,
		tocHref,
		chapterTitle,
		sourceId,
		chapterIndex,
	);
}
