import type { App } from "obsidian";
import { normalizePath } from "obsidian";
import {
	LEGACY_DOT_TUANKI,
	PATHS,
	WEAVE_DATA,
	getPluginPaths,
	getV2Paths,
	normalizeWeaveParentFolder,
	resolveWeaveParentFolderFromApp,
} from "../../config/paths";

export const DETACHED_EDITOR_TEMP_FILE_PREFIX = "weave-editor-";
export const DETACHED_EDITOR_TEMP_FILE_SUFFIX = ".md";

const MODAL_EDITOR_PERMANENT_FILE_PATTERN =
	/^modal-editor-permanent(?:-\d+)?\.md$/;

export function getPluginEditorTempDir(app: App): string {
	return normalizePath(getPluginPaths(app).cache.editorTemp);
}

function resolveEditorParentFolder(app: App, parentFolder?: string): string {
	if (parentFolder !== undefined) {
		return normalizeWeaveParentFolder(parentFolder);
	}
	return resolveWeaveParentFolderFromApp(app);
}

/**
 * Vault 可见的嵌入式编辑器临时目录。
 * 始终落在可配置的 IR 数据根下（`{root}/editor`）。
 * 优先使用显式传入的 `parentFolder`（plugin.settings.weaveParentFolder）。
 */
export function getVaultEditorTempDir(app: App, parentFolder?: string): string {
	const parent = resolveEditorParentFolder(app, parentFolder);
	return normalizePath(`${getV2Paths(parent).root}/editor`);
}

export function isDetachedEditorTempFileName(name: string): boolean {
	return (
		typeof name === "string" &&
		name.startsWith(DETACHED_EDITOR_TEMP_FILE_PREFIX) &&
		name.endsWith(DETACHED_EDITOR_TEMP_FILE_SUFFIX)
	);
}

export function isDetachedEditorTempFilePath(path?: string | null): boolean {
	if (!path) return false;

	const normalizedPath = normalizePath(path);
	const fileName = normalizedPath.split("/").pop() || "";
	return isDetachedEditorTempFileName(fileName);
}

/**
 * DetachedLeafEditor 临时文件目录。
 * 固定使用 IR 数据根下的 editor/，不跟源文件同目录（避免污染用户笔记树）。
 * `sourcePath` 保留为兼容参数；`parentFolder` 应由调用方传入设置值。
 */
export function resolveDetachedEditorTempFolder(
	app: App,
	_sourcePath?: string,
	parentFolder?: string,
): string {
	return getVaultEditorTempDir(app, parentFolder);
}

export function buildDetachedEditorTempFilePath(
	folderPath: string,
	fileName: string,
): string {
	return folderPath ? normalizePath(`${folderPath}/${fileName}`) : fileName;
}

export function isModalEditorPermanentFilePath(path: string): boolean {
	const normalizedPath = normalizePath(path);
	const fileName = normalizedPath.split("/").pop() || "";
	return MODAL_EDITOR_PERMANENT_FILE_PATTERN.test(fileName);
}

export function isLegacyModalEditorPermanentFilePath(path: string): boolean {
	const normalizedPath = normalizePath(path);
	if (!isModalEditorPermanentFilePath(normalizedPath)) return false;

	if (normalizedPath.startsWith(`${LEGACY_DOT_TUANKI}/temp/`)) return true;
	if (normalizedPath.startsWith(`${PATHS.temp}/`)) return true;
	if (normalizedPath.startsWith(`${WEAVE_DATA}/temp/`)) return true;
	if (normalizedPath.includes(`/${LEGACY_DOT_TUANKI}/temp/`)) return true;
	if (normalizedPath.includes(`/${WEAVE_DATA}/temp/`)) return true;
	return false;
}

export function isPluginCacheModalEditorPermanentFilePath(
	app: App,
	path: string,
): boolean {
	const normalizedPath = normalizePath(path);
	if (!isModalEditorPermanentFilePath(normalizedPath)) return false;

	const editorTempDir = getPluginEditorTempDir(app);
	return normalizedPath.startsWith(`${editorTempDir}/`);
}
