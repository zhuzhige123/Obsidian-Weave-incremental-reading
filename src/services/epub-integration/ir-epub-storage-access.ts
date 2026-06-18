import type { App } from "obsidian";
import { IrEpubSourceRegistry } from "./IrEpubSourceRegistry";
import { getEpubReaderInteropHost } from "./epub-reader-interop";
import type { IrEpubStorageLike } from "./ir-epub-storage-types";

const fallbackRegistryByApp = new WeakMap<App, IrEpubSourceRegistry>();

/**
 * 优先使用 EPUB 阅读器插件的存储服务；未安装时回退到 IR 最小来源注册表。
 */
export function getIrEpubStorageService(app: App): IrEpubStorageLike {
	const reader = getEpubReaderInteropHost(app);
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
