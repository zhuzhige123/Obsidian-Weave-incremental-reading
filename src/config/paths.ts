/**
 * Standalone incremental-reading plugin path configuration.
 *
 * Vault IR data lives under a dedicated parent folder (default:
 * `weave Incremental reading/`), with `points/` / `materials/` / etc. directly
 * beneath it — not under a shared `weave/` series root.
 *
 * Plugin-local cache/state lives under
 * `.obsidian/plugins/{pluginId}/` (see {@link getActivePluginId}).
 */
import { type App, normalizePath } from "obsidian";
import { CURRENT_PLUGIN_ID } from "./plugin-runtime";

declare const __WEAVE_IR_STANDALONE__: boolean;

/** Compatibility: embedded Weave main plugin id (non-standalone builds). */
const EMBEDDED_WEAVE_PLUGIN_ID = "weave";

/**
 * Active Obsidian plugin folder id for this build.
 * Standalone IR → manifest id; embedded → main Weave plugin.
 */
export function getActivePluginId(): string {
	return typeof __WEAVE_IR_STANDALONE__ !== "undefined" && __WEAVE_IR_STANDALONE__
		? CURRENT_PLUGIN_ID
		: EMBEDDED_WEAVE_PLUGIN_ID;
}

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
		plugins?: Record<string, PluginFolderSettings | null | undefined>;
	};
};

/**
 * 运行时已登记的 IR 数据父目录（由主插件 load/save settings 写入）。
 * 编辑器临时文件等路径解析优先使用该值，避免依赖 app.plugins 反射。
 */
let registeredWeaveParentFolder: string | undefined;

/** 主插件在 loadSettings / saveSettings 后调用。 */
export function setActiveWeaveParentFolder(parentFolder?: string): void {
	registeredWeaveParentFolder = normalizeWeaveParentFolder(parentFolder);
}

/** 插件卸载时清理，避免热重载/测试串扰。 */
export function clearActiveWeaveParentFolder(): void {
	registeredWeaveParentFolder = undefined;
}

function readLooseProperty(value: unknown, key: string): unknown {
	if (typeof value !== "object" || value === null) {
		return undefined;
	}
	try {
		return Reflect.get(value, key);
	} catch {
		return undefined;
	}
}

function readLooseString(value: unknown, key: string): string | undefined {
	const raw = readLooseProperty(value, key);
	return typeof raw === "string" ? raw : undefined;
}

/**
 * 解析用户配置的 IR 数据父文件夹。
 * 优先级：主动登记值 → plugins.plugins[id] → getPlugin(id)
 */
export function resolveWeaveParentFolderFromApp(
	app?: App | AppWithPluginAccess,
): string {
	if (registeredWeaveParentFolder !== undefined) {
		return registeredWeaveParentFolder;
	}

	try {
		const pluginId = getActivePluginId();
		const pluginsContainer = readLooseProperty(app, "plugins");
		const pluginsMap = readLooseProperty(pluginsContainer, "plugins");
		const getPlugin = readLooseProperty(pluginsContainer, "getPlugin");

		const fromMap =
			pluginsMap && typeof pluginsMap === "object"
				? (readLooseProperty(pluginsMap, pluginId) ??
					readLooseProperty(pluginsMap, EMBEDDED_WEAVE_PLUGIN_ID))
				: undefined;
		const fromGetter =
			typeof getPlugin === "function"
				? ((Reflect.apply(getPlugin, pluginsContainer, [pluginId]) as
						| PluginFolderSettings
						| null
						| undefined) ??
					(Reflect.apply(getPlugin, pluginsContainer, [
						EMBEDDED_WEAVE_PLUGIN_ID,
					]) as PluginFolderSettings | null | undefined))
				: undefined;
		const plugin = fromMap ?? fromGetter;
		const settings = readLooseProperty(plugin, "settings");
		return normalizeWeaveParentFolder(
			readLooseString(settings, "weaveParentFolder"),
		);
	} catch {
		return "";
	}
}

/**
 * Compatibility note: 旧 Weave 系列共用 Vault 数据根（`weave/`）。
 * 独立 IR 默认根已改为 {@link DEFAULT_IR_DATA_ROOT}；本常量仅用于旧路径检测/迁移。
 */
export const WEAVE_DATA = "weave";

/**
 * IR Vault 数据父文件夹默认名。
 * 其下直接存放 points / materials / registry 等，不再套一层 `weave/` 或 `incremental-reading/`。
 */
export const DEFAULT_IR_DATA_ROOT = "weave Incremental reading";

/**
 * 拆分前默认 IR 根：`weave/incremental-reading/`（仅只读兼容 / 迁移源）。
 */
export const LEGACY_IR_DATA_ROOT = `${WEAVE_DATA}/incremental-reading`;

/** Compatibility note: legacy：旧的 Vault 隐藏数据根目录（历史版本机读数据） */
export const LEGACY_DOT_TUANKI = ".tuanki";

/** Compatibility note: v2.x 旧的机读数据子目录名（已废弃） */
export const LEGACY_MACHINE_DATA_SUBDIR = "_data";

/** 旧增量阅读正文/文件化块兼容目录（新正文默认路径已不再写入这里） */
export const DEFAULT_IR_IMPORT_FOLDER = `${DEFAULT_IR_DATA_ROOT}/IR`;
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

/**
 * 规范化用户配置的 IR 数据父文件夹。
 * 空值表示使用 {@link DEFAULT_IR_DATA_ROOT}；非空值即数据根本身（不再追加 weave）。
 */
export function normalizeWeaveParentFolder(parentFolder?: string): string {
	const raw = (parentFolder || "").trim();
	if (!raw || raw === "." || raw === "/") return "";
	const normalized = normalizePath(raw);
	if (!normalized || normalized === "." || normalized === "/") return "";
	// 与默认根相同则视为未自定义，避免设置里重复写出默认名造成歧义
	if (normalized === DEFAULT_IR_DATA_ROOT) return "";
	return normalized;
}

/**
 * IR Vault 数据根（父文件夹）。
 * - 未自定义：`weave Incremental reading`
 * - 已自定义：用户路径本身（其下直接放 points 等）
 */
export function getReadableWeaveRoot(parentFolder?: string): string {
	const parent = normalizeWeaveParentFolder(parentFolder);
	return parent || DEFAULT_IR_DATA_ROOT;
}

/**
 * Compatibility note: v2.x 旧的机读数据根（weave/_data/），仅用于启动迁移检测。
 */
export function getMachineWeaveRoot(_parentFolder?: string): string {
	return normalizePath(`${WEAVE_DATA}/${LEGACY_MACHINE_DATA_SUBDIR}`);
}

/** 拆分前 IR 数据根，供双读 / 迁移使用。 */
export function getLegacyIRDataRoot(parentFolder?: string): string {
	const parent = normalizeWeaveParentFolder(parentFolder);
	if (!parent) {
		return LEGACY_IR_DATA_ROOT;
	}
	// 设置迁移后可能已直接指向旧 IR 根，避免再次拼接
	if (
		parent === LEGACY_IR_DATA_ROOT ||
		parent.endsWith(`/${LEGACY_IR_DATA_ROOT}`)
	) {
		return parent;
	}
	// 旧模型：{parent}/weave/incremental-reading
	return normalizePath(`${parent}/${LEGACY_IR_DATA_ROOT}`);
}

export function getV2Paths(parentFolder?: string) {
	const root = getReadableWeaveRoot(parentFolder);

	return {
		/** 数据根目录（= IR 父文件夹） */
		root,
		/** Schema 版本文件（无点前缀，确保同步兼容） */
		schemaVersion: `${root}/schema-version.json`,

		/** 增量阅读模块：直接挂在父文件夹下 */ ir: {
			root,
			epub: `${root}/epub-reading`,
			epubBookmarks: `${root}/epub-bookmarks`,
			registry: `${root}/registry`,
			pointsDir: `${root}/points`,
			materialRecordsDir: `${root}/materials`,
			legacyTopics: `${root}/topics.json`,
			legacyDecks: `${root}/decks.json`,
			blocks: `${root}/blocks.json`,
			history: `${root}/history.json`,
			chunks: `${root}/chunks.json`,
			sources: `${root}/sources.json`,
			studySessions: `${root}/study-sessions.json`,
			calendarProgress: `${root}/calendar-progress.json`,
			tagGroups: `${root}/tag-groups.json`,
			tagGroupProfiles: `${root}/tag-group-profiles.json`,
			documentGroupMap: `${root}/document-group-map.json`,
			pdfBookmarkTasks: `${root}/pdf-bookmark-tasks.json`,
			epubBookmarkTasks: `${root}/epub-bookmark-tasks.json`,
			materialsIndex: `${root}/registry/materials-index.json`,
			pointFilesIndex: `${root}/registry/point-files-index.json`,
			scheduleProfiles: `${root}/registry/schedule-profiles.json`,
			materials: {
				root: `${root}/materials`,
				index: `${root}/materials/materials.json`,
				sessions: `${root}/materials/sessions`,
			},
		},
	} as const;
}

export function getV2PathsFromApp(app?: App | AppWithPluginAccess) {
	return getV2Paths(resolveWeaveParentFolderFromApp(app));
}

export function getLegacyIRImportFolder(parentFolder?: string): string {
	return normalizePath(`${getReadableWeaveRoot(parentFolder)}/IR`);
}

export function resolveIRImportFolder(
	importFolder?: string,
	parentFolder?: string,
): string {
	const raw = (importFolder || "").trim();
	const dynamicDefault = getLegacyIRImportFolder(parentFolder);

	if (!raw) return dynamicDefault;

	const normalized = normalizePath(raw);
	// 旧路径 / 系列共用根自动回退到当前默认 IR 目录
	if (normalized === ".weave" || normalized.startsWith(".weave/"))
		return dynamicDefault;
	if (normalized === WEAVE_DATA || normalized.startsWith(`${WEAVE_DATA}/`))
		return dynamicDefault;
	if (
		normalized === DEFAULT_IR_DATA_ROOT ||
		normalized === LEGACY_IR_DATA_ROOT
	) {
		return dynamicDefault;
	}
	const machineRoot = getMachineWeaveRoot(parentFolder);
	if (normalized === machineRoot || normalized.startsWith(`${machineRoot}/`))
		return dynamicDefault;
	const legacyDataRoot = getLegacyIRDataRoot(parentFolder);
	if (
		normalized === legacyDataRoot ||
		normalized === `${legacyDataRoot}/IR` ||
		normalized.startsWith(`${legacyDataRoot}/IR/`)
	) {
		return dynamicDefault;
	}
	const bareIR = normalizePath(`${getReadableWeaveRoot(parentFolder)}/IR`);
	if (normalized === bareIR) return dynamicDefault;
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
	return getPluginDirById(app, getActivePluginId());
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
	return getPluginPathsById(app, getActivePluginId());
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
	incrementalReading: LEGACY_IR_DATA_ROOT,
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
	root: DEFAULT_IR_DATA_ROOT,
	/** 临时文件夹 */
	temp: `${DEFAULT_IR_DATA_ROOT}/temp`,
	/** 增量阅读数据文件夹（现与数据根相同） */
	incrementalReading: DEFAULT_IR_DATA_ROOT,

	/** 增量阅读：人类可读内容文件夹 */
	irBase: `${DEFAULT_IR_DATA_ROOT}/IR`,
	/** 增量阅读：源材料文件夹 */
	irRaw: `${DEFAULT_IR_DATA_ROOT}/IR/raw`,
	/** 增量阅读：索引文件夹 */
	irSources: `${DEFAULT_IR_DATA_ROOT}/IR/sources`,
	/** 增量阅读：块文件夹 */
	irChunks: `${DEFAULT_IR_DATA_ROOT}/IR/chunks`,
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
