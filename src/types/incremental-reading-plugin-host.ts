import type { Plugin } from "obsidian";
import type { Card } from "../data/types";
import type { ReadingMaterialManager } from "../services/incremental-reading/ReadingMaterialManager";
import type { IncrementalReadingSettings } from "./plugin-settings.d";

export type IncrementalReadingDataStorage = {
	getAllCards?: () => Promise<Card[]>;
};

export type IncrementalReadingPluginSettings = {
	incrementalReading?: IncrementalReadingSettings;
	weaveParentFolder?: string;
};

/**
 * 增量阅读插件在运行时可被其他 IR 模块依赖的最小宿主面。
 * 用于替代散落的 `any` 插件查找。
 */
export type IncrementalReadingPluginHost = Plugin & {
	settings?: IncrementalReadingPluginSettings;
	readingMaterialManager?: ReadingMaterialManager;
	dataStorage?: IncrementalReadingDataStorage | null;
};
