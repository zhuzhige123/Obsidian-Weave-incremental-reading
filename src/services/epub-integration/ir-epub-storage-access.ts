import type { App } from "obsidian";
import { IrEpubSourceRegistry } from "./IrEpubSourceRegistry";
import type { IrEpubStorageLike } from "./ir-epub-storage-types";

const EPUB_READER_PLUGIN_ID = "weave-epub-reader";
const fallbackRegistryByApp = new WeakMap<App, IrEpubSourceRegistry>();

type EpubReaderStorageHost = {
	getEpubStorageService?: () => IrEpubStorageLike;
};

/**
 * 优先使用 EPUB 阅读器插件的存储服务；未安装时回退到 IR 最小来源注册表。
 */
export function getIrEpubStorageService(app: App): IrEpubStorageLike {
	const reader = (app as { plugins?: { getPlugin?: (id: string) => unknown } }).plugins?.getPlugin?.(
		EPUB_READER_PLUGIN_ID
	) as EpubReaderStorageHost | null;
	if (typeof reader?.getEpubStorageService === "function") {
		return reader.getEpubStorageService();
	}

	let fallback = fallbackRegistryByApp.get(app);
	if (!fallback) {
		fallback = new IrEpubSourceRegistry(app);
		fallbackRegistryByApp.set(app, fallback);
	}
	return fallback;
}
