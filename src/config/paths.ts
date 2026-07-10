/**
 * Standalone incremental-reading plugin path configuration.
 *
 * Vault data lives under `weave/incremental-reading/`; plugin-local cache/state
 * lives under `.obsidian/plugins/weave-incremental-reading/`.
 */
import { type App, normalizePath } from "obsidian";

declare const __WEAVE_IR_STANDALONE__: boolean;

type PluginFolderSettings = {
	settings?: {
		weaveParentFolder?: string;
	};
};

type AppWithPluginAccess = {
	vault?: {
		configDir?: string;
	};
	plugins?: {
		getPlugin?: (pluginId: string) => PluginFolderSettings | null | undefined;
	};
};

/** Vault 数据根目录 */
export const WEAVE_DATA = "weave";

/** Compatibility note: legacy：旧的 Vault 隐藏数据根目录（历史版本机读数据） */
export const LEGACY_DOT_TUANKI = ".tuanki";

/** Compatibility note: v2.x 旧的机读数据子目录名（已废弃，数据现在直接在 weave/ 下） */
export const LEGACY_MACHINE_DATA_SUBDIR = "_data";

/** 旧增量阅读正文/文件化块兼容目录（新正文默认路径已不再写入这里） */
export const DEFAULT_IR_IMPORT_FOLDER = `${WEAVE_DATA}/incremental-reading/IR`;
const DEFAULT_OBSIDIAN_CONFIG_DIR = [".", "obsidian"].join("");
const DEFAULT_CONFIG_DIR_PATH_MARKER = `/${DEFAULT_OBSIDIAN_CONFIG_DIR}`;
const DEFAULT_CONFIG_DIR_PATH_SEGMENT = `${DEFAULT_CONFIG_DIR_PATH_MARKER}/`;

function resolveVaultConfigDir(app?: { vault: { configDir: string } }): string {
	const configDir = app?.vault?.configDir?.trim();
	const raw =
		configDir && configDir.length > 0 ? configDir : DEFAULT_OBSIDIAN_CONFIG_DIR;
	const normalized = normalizePath(raw);
	if (!/^[A-Za-z]:\//.test(normalized)) {
		return normalized;
	}

	const obsidianIndex = normalized.lastIndexOf(DEFAULT_CONFIG_DIR_PATH_MARKER);
	if (obsidianIndex >= 0) {
		return normalized.slice(obsidianIndex + 1);
	}

	const segments = normalized.split("/").filter(Boolean);
	return segments[segments.length - 1] || DEFAULT_OBSIDIAN_CONFIG_DIR;
}

/** vault.adapter 只接受相对 vault 根的路径；剥离 Windows 绝对路径前缀。 */
export function toVaultAdapterPath(
	app: { vault: { configDir: string } } | undefined,
	inputPath: string,
): string {
	const normalized = normalizePath(String(inputPath || "").trim());
	if (!normalized || !/^[A-Za-z]:\//.test(normalized)) {
		return normalized;
	}

	const configDir = resolveVaultConfigDir(app);
	const configMarker = `/${configDir}/`;
	const configIndex = normalized.indexOf(configMarker);
	if (configIndex >= 0) {
		return normalized.slice(configIndex + 1);
	}

	const obsidianIndex = normalized.indexOf(DEFAULT_CONFIG_DIR_PATH_SEGMENT);
	if (obsidianIndex >= 0) {
		return normalized.slice(obsidianIndex + 1);
	}

	const pluginsIndex = normalized.indexOf("/plugins/");
	if (pluginsIndex >= 0) {
		return `${configDir}${normalized.slice(pluginsIndex)}`;
	}

	return normalized;
}

export function normalizeWeaveParentFolder(parentFolder?: string): string {
	const raw = (parentFolder || "").trim();
	if (!raw || raw === "." || raw === "/") return "";
	const normalized = normalizePath(raw);
	if (!normalized || normalized === "." || normalized === "/") return "";
	if (normalized === WEAVE_DATA) return "";
	return normalized;
}

export function getReadableWeaveRoot(parentFolder?: string): string {
	const parent = normalizeWeaveParentFolder(parentFolder);
	return parent ? normalizePath(`${parent}/${WEAVE_DATA}`) : WEAVE_DATA;
}

/**
 * Compatibility note: v2.x 旧的机读数据根（weave/_data/），现在直接使用 getReadableWeaveRoot()
 * 保留仅用于启动迁移检测
 */
export function getMachineWeaveRoot(parentFolder?: string): string {
	return normalizePath(
		`${getReadableWeaveRoot(parentFolder)}/${LEGACY_MACHINE_DATA_SUBDIR}`,
	);
}

export function getV2Paths(parentFolder?: string) {
	const root = getReadableWeaveRoot(parentFolder);

	return {
		/** 数据根目录 */
		root,
		/** Schema 版本文件（无点前缀，确保同步兼容） */
		schemaVersion: `${root}/schema-version.json`,

		/** 增量阅读模块 */ ir: {
			root: `${root}/incremental-reading`,
			epub: `${root}/incremental-reading/epub-reading`,
			registry: `${root}/incremental-reading/registry`,
			pointsDir: `${root}/incremental-reading/points`,
			materialRecordsDir: `${root}/incremental-reading/materials`,
			legacyTopics: `${root}/incremental-reading/topics.json`,
			legacyDecks: `${root}/incremental-reading/decks.json`,
			blocks: `${root}/incremental-reading/blocks.json`,
			history: `${root}/incremental-reading/history.json`,
			chunks: `${root}/incremental-reading/chunks.json`,
			sources: `${root}/incremental-reading/sources.json`,
			studySessions: `${root}/incremental-reading/study-sessions.json`,
			calendarProgress: `${root}/incremental-reading/calendar-progress.json`,
			tagGroups: `${root}/incremental-reading/tag-groups.json`,
			tagGroupProfiles: `${root}/incremental-reading/tag-group-profiles.json`,
			documentGroupMap: `${root}/incremental-reading/document-group-map.json`,
			pdfBookmarkTasks: `${root}/incremental-reading/pdf-bookmark-tasks.json`,
			epubBookmarkTasks: `${root}/incremental-reading/epub-bookmark-tasks.json`,
			materialsIndex: `${root}/incremental-reading/registry/materials-index.json`,
			pointFilesIndex: `${root}/incremental-reading/registry/point-files-index.json`,
			scheduleProfiles: `${root}/incremental-reading/registry/schedule-profiles.json`,
			materials: {
				root: `${root}/incremental-reading/materials`,
				index: `${root}/incremental-reading/materials/materials.json`,
				sessions: `${root}/incremental-reading/materials/sessions`,
			},
		},
	} as const;
}

export function getV2PathsFromApp(app?: App | AppWithPluginAccess) {
	try {
		const pluginHost = app as AppWithPluginAccess | undefined;
		const pluginId =
			typeof __WEAVE_IR_STANDALONE__ !== "undefined" && __WEAVE_IR_STANDALONE__
				? "weave-incremental-reading"
				: "weave";
		const plugin =
			pluginHost?.plugins?.getPlugin?.(pluginId) ??
			pluginHost?.plugins?.getPlugin?.("weave");
		const parentFolder = plugin?.settings?.weaveParentFolder;
		return getV2Paths(parentFolder);
	} catch {
		return getV2Paths(undefined);
	}
}

export function getLegacyIRImportFolder(parentFolder?: string): string {
	return normalizePath(
		`${getReadableWeaveRoot(parentFolder)}/incremental-reading/IR`,
	);
}

export function resolveIRImportFolder(
	importFolder?: string,
	parentFolder?: string,
): string {
	const raw = (importFolder || "").trim();
	const dynamicDefault = getLegacyIRImportFolder(parentFolder);

	if (!raw) return dynamicDefault;

	const normalized = normalizePath(raw);
	// 旧路径自动回退到新默认值
	if (normalized === ".weave" || normalized.startsWith(".weave/"))
		return dynamicDefault;
	if (normalized === "weave" || normalized.startsWith("weave/"))
		return dynamicDefault;
	const machineRoot = getMachineWeaveRoot(parentFolder);
	if (normalized === machineRoot || normalized.startsWith(`${machineRoot}/`))
		return dynamicDefault;
	if (
		normalized === `${WEAVE_DATA}/${LEGACY_MACHINE_DATA_SUBDIR}` ||
		normalized.startsWith(`${WEAVE_DATA}/${LEGACY_MACHINE_DATA_SUBDIR}/`)
	)
		return dynamicDefault;
	const legacyIR = normalizePath(`${getReadableWeaveRoot(parentFolder)}/IR`);
	if (normalized === legacyIR) return dynamicDefault;
	return normalized;
}

/** 插件目录根路径（动态获取，兼容自定义 configDir） */
export function getPluginDirById(
	app: { vault: { configDir: string } } | undefined,
	pluginId: string,
): string {
	const configDir = resolveVaultConfigDir(app);
	return `${configDir}/plugins/${pluginId}`;
}

/** 插件目录根路径（动态获取，兼容自定义 configDir） */
export function getPluginDir(app?: { vault: { configDir: string } }): string {
	const pluginId =
		typeof __WEAVE_IR_STANDALONE__ !== "undefined" && __WEAVE_IR_STANDALONE__
			? "weave-incremental-reading"
			: "weave";
	return getPluginDirById(app, pluginId);
}

/** Schema 版本号 */
export const SCHEMA_VERSION = "3.0.0";

// ============================================================================
// V2.0 规范化路径（新架构）
// ============================================================================

/** 动态获取插件目录路径（支持自定义 configDir） */
export function getPluginPathsById(
	app: { vault: { configDir: string } } | undefined,
	pluginId: string,
) {
	const root = getPluginDirById(app, pluginId);
	const cacheRoot = `${root}/cache`;
	const migrationRoot = `${cacheRoot}/migration`;
	const editorTempRoot = `${cacheRoot}/editor-temp`;
	const irCacheRoot = `${cacheRoot}/incremental-reading`;
	const stateRoot = `${root}/state`;
	const irStateRoot = `${stateRoot}/incremental-reading`;
	return {
		root,
		state: {
			root: stateRoot,
			localStorage: `${stateRoot}/local-storage.json`,
			incrementalReading: {
				root: irStateRoot,
				readingMaterialsRuntime: `${irStateRoot}/reading-materials-runtime.json`,
				epubReaderData: `${irStateRoot}/epub-reader-data.json`,
				monitoring: `${irStateRoot}/monitoring.json`,
				history: `${irStateRoot}/history.json`,
				studySessions: `${irStateRoot}/study-sessions.json`,
				calendarProgress: `${irStateRoot}/calendar-progress.json`,
				readerState: `${irStateRoot}/reader-state`,
			},
		},
		cache: {
			root: cacheRoot,
			anchors: `${cacheRoot}/anchors-cache.json`,
			editorTemp: editorTempRoot,
			incrementalReading: {
				root: irCacheRoot,
				irCalendarCache: `${irCacheRoot}/ir-calendar-cache.json`,
				irCalendarDayIndex: `${irCacheRoot}/ir-calendar-day-index.json`,
				scheduleIndex: `${irCacheRoot}/schedule-index.json`,
				epubBacklinkHighlightsCache: `${irCacheRoot}/epub-backlink-highlights-cache.json`,
				documentGroupMap: `${irCacheRoot}/document-group-map.json`,
				pointFilesIndex: `${irCacheRoot}/point-files-index.json`,
				dueDateIndex: `${irCacheRoot}/ir-due-date-index.json`,
				syncState: `${irCacheRoot}/sync-state.json`,
				readerArtifacts: `${irCacheRoot}/reader-artifacts`,
			},
		},
		backups: `${root}/backups`,
		migration: {
			root: migrationRoot,
			state: `${migrationRoot}/migration-state.json`,
		},
	} as const;
}

/** 动态获取插件目录路径（支持自定义 configDir） */
export function getPluginPaths(app?: { vault: { configDir: string } }) {
	const pluginId =
		typeof __WEAVE_IR_STANDALONE__ !== "undefined" && __WEAVE_IR_STANDALONE__
			? "weave-incremental-reading"
			: "weave";
	return getPluginPathsById(app, pluginId);
}

export function getLegacyPluginPaths(app?: { vault: { configDir: string } }) {
	const root = getPluginDir(app);
	return {
		root,
		config: {
			root: `${root}/config`,
			userProfile: `${root}/config/user-profile.json`,
		},
		userProfile: `${root}/user-profile.json`,
		importMappings: `${root}/importMappings.json`,
		qualityInbox: `${root}/quality-inbox.json`,
		uiState: `${root}/state/ui-state.json`,
		indices: `${root}/indices`,
		migration: `${root}/migration`,
	} as const;
}

/**
 *  旧版本路径（用于迁移检测）
 */
export const LEGACY_PATHS = {
	/** 记忆牌组旧路径 */
	decks: `${WEAVE_DATA}/decks`,
	cards: `${WEAVE_DATA}/cards`,
	learning: `${WEAVE_DATA}/learning`,
	media: `${WEAVE_DATA}/media`,

	/** flashcards 旧路径（早期版本数据存储位置） */
	flashcards: {
		root: `${WEAVE_DATA}/flashcards`,
		decks: `${WEAVE_DATA}/flashcards/decks`,
		decksJson: `${WEAVE_DATA}/flashcards/decks/decks.json`,
		cards: `${WEAVE_DATA}/flashcards/cards`,
		learning: `${WEAVE_DATA}/flashcards/learning`,
	},

	/** 配置/索引旧路径 */
	profile: `${WEAVE_DATA}/profile`,
	indices: `${WEAVE_DATA}/indices`,
	temp: `${WEAVE_DATA}/temp`,

	/** 增量阅读旧路径 */
	readingMaterials: `${WEAVE_DATA}/reading-materials`,
	ir: `${WEAVE_DATA}/IR`,
	incrementalReading: `${WEAVE_DATA}/incremental-reading`,
	epubReading: `${WEAVE_DATA}/epub-reading`,

	/** 题库旧路径 */
	examBank: `${WEAVE_DATA}/question-bank`,

	/** v2.x _data/ 中间层旧路径（用于迁移检测） */
	dataSubdir: `${WEAVE_DATA}/${LEGACY_MACHINE_DATA_SUBDIR}`,
	dataMemory: `${WEAVE_DATA}/${LEGACY_MACHINE_DATA_SUBDIR}/memory`,
	dataIR: `${WEAVE_DATA}/${LEGACY_MACHINE_DATA_SUBDIR}/incremental-reading`,
	dataExamBank: `${WEAVE_DATA}/${LEGACY_MACHINE_DATA_SUBDIR}/question-bank`,
	dataProfile: `${WEAVE_DATA}/${LEGACY_MACHINE_DATA_SUBDIR}/profile`,
	dataDecks: `${WEAVE_DATA}/${LEGACY_MACHINE_DATA_SUBDIR}/decks`,
} as const;

// ============================================================================
// V1.x 兼容路径（向后兼容，迁移完成后将被移除）
// ============================================================================

/**
 * V1.x 兼容路径（向后兼容）
 * Compatibility note: 迁移完成后请使用 getV2Paths(parentFolder)
 */
export const PATHS = {
	/** 数据根目录 */
	root: WEAVE_DATA,
	/** 临时文件夹 */
	temp: `${WEAVE_DATA}/temp`,
	/** 增量阅读数据文件夹 */
	incrementalReading: `${WEAVE_DATA}/incremental-reading`,

	/** 增量阅读：人类可读内容文件夹（现在在 incremental-reading/IR 下） */
	irBase: `${WEAVE_DATA}/incremental-reading/IR`,
	/** 增量阅读：源材料文件夹 */
	irRaw: `${WEAVE_DATA}/incremental-reading/IR/raw`,
	/** 增量阅读：索引文件夹 */
	irSources: `${WEAVE_DATA}/incremental-reading/IR/sources`,
	/** 增量阅读：块文件夹 */
	irChunks: `${WEAVE_DATA}/incremental-reading/IR/chunks`,
} as const;

/**
 * 辅助函数：获取备份路径
 * @param backupId 备份ID（可选）
 * @returns 完整备份路径
 */
export function getBackupPath(
	backupId?: string,
	app?: { vault: { configDir: string } },
): string {
	const folder = getPluginPaths(app).backups;
	return backupId ? `${folder}/${backupId}` : folder;
}
