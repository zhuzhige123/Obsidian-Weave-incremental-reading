import type { TocItem } from "../../../services/epub-integration/types";
import type {
	ImportContentBlock,
	OutlineSelectionItem,
} from "./material-import-types";

export function buildOutlineDisplayTitle(
	item: OutlineSelectionItem,
	isMultiFileMode: boolean,
): string {
	const titlePath = item.path.length > 0 ? item.path.join(" / ") : item.label;
	if (isMultiFileMode && item.bookTitle && titlePath !== item.bookTitle) {
		return `${item.bookTitle} / ${titlePath}`;
	}
	return titlePath || item.bookTitle || item.label;
}

export function buildContentBlocksFromSelectedOutlineItems(
	items: OutlineSelectionItem[],
	isMultiFileMode: boolean,
): ImportContentBlock[] {
	return items.map((item, index) => {
		const title = buildOutlineDisplayTitle(item, isMultiFileMode);
		if (item.type === "pdf") {
			return {
				id: `pdf-${index}`,
				title,
				content: item.pageNumber
					? `[[${item.filePath}#page=${item.pageNumber}|${title}]]`
					: `[[${item.filePath}|${title}]]`,
				charCount: title.length,
				startOffset: 0,
				endOffset: 0,
				sourceFilePath: item.filePath,
				pdfPageNumber: item.pageNumber,
				outlineLevel: item.level,
				outlineLabel: item.label,
				outlinePath: item.path,
				fallbackWholeFile: item.fallbackWholeFile,
			} as ImportContentBlock;
		}

		return {
			id: `epub-${index}`,
			title,
			content: item.href || "",
			charCount: title.length,
			startOffset: 0,
			endOffset: 0,
			sourceFilePath: item.filePath,
			epubTocHref: item.href,
			epubTocLevel: item.level,
			epubSourceId: item.sourceId,
			epubBookTitle: item.bookTitle,
			outlineLevel: item.level,
			outlineLabel: item.label,
			outlinePath: item.path,
		} as ImportContentBlock;
	});
}

export function attachEpubItemContext(
	item: TocItem,
	filePath: string,
	bookTitle: string,
	sourceId?: string,
): TocItem {
	return {
		...item,
		id: `${sourceId || filePath}::${item.id}`,
		filePath,
		bookTitle,
		sourceId,
		subitems: item.subitems?.map((subitem) =>
			attachEpubItemContext(subitem, filePath, bookTitle, sourceId),
		),
	} as TocItem;
}

export function flattenEpubTocToOutlineItems(
	items: TocItem[],
): OutlineSelectionItem[] {
	const result: OutlineSelectionItem[] = [];
	const walk = (
		list: TocItem[],
		filePath = "",
		bookTitle = "",
		sourceId = "",
		ancestors: string[] = [],
		depth = 1,
	) => {
		for (const item of list) {
			const nextSourceId =
				sourceId ||
				String(
					(item as TocItem & { sourceId?: string }).sourceId ||
						item.id.split("::")[0] ||
						"",
				);
			const nextFilePath =
				filePath ||
				String((item as TocItem & { filePath?: string }).filePath || "");
			const nextBookTitle =
				bookTitle ||
				String(
					(item as TocItem & { bookTitle?: string }).bookTitle || item.label,
				);
			const nextAncestors = item.href ? [...ancestors, item.label] : ancestors;
			const resolvedLevel = Math.max(
				1,
				depth,
				Number.isFinite(item.level) ? item.level : 0,
			);

			if (item.href) {
				result.push({
					id: item.id,
					type: "epub",
					label: item.label,
					href: item.href,
					level: resolvedLevel,
					path: nextAncestors,
					filePath: nextFilePath,
					sourceId: nextSourceId || undefined,
					bookTitle: nextBookTitle,
				});
			}
			if (item.subitems && item.subitems.length > 0) {
				walk(
					item.subitems,
					nextFilePath,
					nextBookTitle,
					nextSourceId,
					nextAncestors,
					resolvedLevel + 1,
				);
			}
		}
	};
	walk(items);
	return result;
}
