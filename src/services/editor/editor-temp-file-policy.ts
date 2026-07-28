import type { App } from "obsidian";
import { normalizePath } from "obsidian";
import {
	LEGACY_DOT_TUANKI,
	PATHS,
	WEAVE_DATA,
	getPluginPaths,
	getV2PathsFromApp,
} from "../../config/paths";

export const DETACHED_EDITOR_TEMP_FILE_PREFIX = "weave-editor-";
export const DETACHED_EDITOR_TEMP_FILE_SUFFIX = ".md";

const MODAL_EDITOR_PERMANENT_FILE_PATTERN =
	/^modal-editor-permanent(?:-\d+)?\.md$/;

export function getPluginEditorTempDir(app: App): string {
	return normalizePath(getPluginPaths(app).cache.editorTemp);
}

/**
 * Vault 可见的嵌入式编辑器临时目录。
 * 始终落在可配置的 IR 数据根下（`{root}/editor`），尊重设置中的 weaveParentFolder。
 */
export function getVaultEditorTempDir(app: App): string {
	return normalizePath(`${getV2PathsFromApp(app).root}/editor`);
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
 * `sourcePath` 保留为兼容参数，不再影响落盘位置。
 */
export function resolveDetachedEditorTempFolder(
	app: App,
	_sourcePath?: string,
): string {
	return getVaultEditorTempDir(app);
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
