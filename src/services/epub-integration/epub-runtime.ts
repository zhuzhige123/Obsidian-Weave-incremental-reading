export interface EpubRuntimeConfig {
	pluginId: string;
	pluginDirName: string;
	viewTypes: {
		reader: string;
		sidebar: string;
		bookshelfSidebar: string;
	};
	protocol: {
		primaryName: string;
		legacyNames: string[];
		allNames: string[];
	};
	events: {
		bookshelfDataChanged: string;
		bookshelfRefreshRequest: string;
		navigate: string;
	};
	globals: {
		pendingNavigationKey: string;
	};
	collaboratorHostPluginIds: string[];
}

declare const __WEAVE_EPUB_STANDALONE__: boolean;
declare const __WEAVE_IR_STANDALONE__: boolean;

const isEpubStandaloneBuild =
	typeof __WEAVE_EPUB_STANDALONE__ !== "undefined" && __WEAVE_EPUB_STANDALONE__;
const isIrStandaloneBuild =
	typeof __WEAVE_IR_STANDALONE__ !== "undefined" && __WEAVE_IR_STANDALONE__;
const useReaderProtocol = isEpubStandaloneBuild || isIrStandaloneBuild;

const primaryProtocolName = useReaderProtocol
	? "weave-epub-reader"
	: "weave-epub";
const legacyProtocolNames = useReaderProtocol ? ["weave-epub"] : [];
const bookshelfDataChangedEvent = isEpubStandaloneBuild
	? "WeaveEpubStandalone:epub-bookshelf-data-changed"
	: "Weave:epub-bookshelf-data-changed";
const bookshelfRefreshRequestEvent = isEpubStandaloneBuild
	? "WeaveEpubStandalone:epub-bookshelf-refresh-request"
	: "Weave:epub-bookshelf-refresh-request";

export const EPUB_RUNTIME: EpubRuntimeConfig = {
	pluginId: useReaderProtocol ? "weave-epub-reader" : "weave",
	pluginDirName: useReaderProtocol ? "weave-epub-reader" : "weave",
	viewTypes: {
		reader: useReaderProtocol
			? "weave-epub-reader-standalone"
			: "weave-epub-reader",
		sidebar: useReaderProtocol
			? "weave-epub-sidebar-standalone"
			: "weave-epub-sidebar",
		bookshelfSidebar: useReaderProtocol
			? "weave-epub-bookshelf-sidebar-standalone"
			: "weave-epub-bookshelf-sidebar",
	},
	protocol: {
		primaryName: primaryProtocolName,
		legacyNames: legacyProtocolNames,
		allNames: [primaryProtocolName, ...legacyProtocolNames],
	},
	events: {
		bookshelfDataChanged: bookshelfDataChangedEvent,
		bookshelfRefreshRequest: bookshelfRefreshRequestEvent,
		navigate: useReaderProtocol
			? "WeaveEpubStandalone:epub-navigate"
			: "Weave:epub-navigate",
	},
	globals: {
		pendingNavigationKey: useReaderProtocol
			? "__weaveEpubStandalonePendingNav"
			: "__weaveEpubPendingNav",
	},
	collaboratorHostPluginIds: useReaderProtocol
		? ["weave", "weave-incremental-reading"]
		: [],
};

export function getEpubRuntime(): EpubRuntimeConfig {
	return EPUB_RUNTIME;
}

export function isLegacyEpubProtocolName(protocolName: string): boolean {
	return EPUB_RUNTIME.protocol.legacyNames.includes(protocolName);
}

export function isSupportedEpubProtocolName(protocolName: string): boolean {
	return EPUB_RUNTIME.protocol.allNames.includes(protocolName);
}
