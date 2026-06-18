export { getIrEpubStorageService } from "./ir-epub-storage-access";
export { IrEpubSourceRegistry } from "./IrEpubSourceRegistry";
export type { EpubSourceRegistryEntry, IrEpubStorageLike } from "./ir-epub-storage-types";
export { loadEpubTocForIrImport } from "./ir-epub-toc-loader";
export {
	getEpubReaderInteropHost,
	hasEpubReaderTocInterop,
	hasEpubReaderChapterNavigationInterop,
	resolveEpubReaderInteropFailure,
} from "./epub-reader-interop";
export { buildEpubChapterResumeLink } from "./epub-chapter-locate";
export type { EpubReaderInteropHost } from "./epub-reader-interop";
export {
	registerEpubHost,
	resolveEpubCardHost,
	resolveEpubHost,
	resolveEpubIRHost,
	resolveEpubReaderHost,
	unregisterEpubHost,
} from "./epub-host";
export type {
	EpubHostCapabilities,
	EpubHostCardCapabilities,
	EpubHostCreateCardInput,
	EpubHostExportChapterInput,
	EpubHostExportBookNotesInput,
	EpubHostIRCapabilities,
	EpubHostMarkdownAsset,
	EpubHostReadingPointInput,
	EpubHostReaderCapabilities,
	EpubHostResumePointInput,
	EpubHostScheduleChapterInput,
	EpubHostSelectedTextAIPanelInput,
	EpubHostSelectedTextAISplitMenuOptions,
} from "./epub-host";
export { EPUB_RUNTIME, getEpubRuntime, isLegacyEpubProtocolName, isSupportedEpubProtocolName } from "./epub-runtime";
export { EpubBookmarkService, DEFAULT_EPUB_BOOKMARK_FOLDER, getEpubBookmarkFolderDisplayPath, normalizeEpubBookmarkFolderPath } from "./EpubBookmarkService";
export { EpubLinkService } from "./EpubLinkService";
export * from "./types";
