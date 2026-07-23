import type { App, TAbstractFile, TFile, TFolder } from "obsidian";
import {
	TFile as TFileClass,
	TFolder as TFolderClass,
	normalizePath,
} from "obsidian";
import type { IncrementalReadingFolderSubscriptionRule } from "../../types/plugin-settings.d";
import { readString } from "../../utils/unknown-record";
import { normalizeIncrementalReadingFolderSubscriptionPath } from "./folder-subscription-settings";

/** 订阅文件夹自动添加仅限 Markdown（产品契约 + Obsidian 笔记文件约定）。 */
export function isFolderSubscriptionMarkdownExtension(
	extension: string | null | undefined,
): boolean {
	return readString(extension).toLowerCase() === "md";
}

/**
 * 路径侧 Markdown 判定（vault create/rename 事件只有 path 时使用）。
 * 与 `TFile.extension === "md"` 对齐：忽略大小写，不把 `.md.backup` 等当成笔记。
 */
export function isFolderSubscriptionMarkdownPath(
	filePath: string | null | undefined,
): boolean {
	const normalized = normalizePath(String(filePath || "").trim());
	if (!normalized || normalized.endsWith("/")) {
		return false;
	}
	const fileName = normalized.split("/").pop() || "";
	const dot = fileName.lastIndexOf(".");
	if (dot <= 0 || dot === fileName.length - 1) {
		return false;
	}
	return isFolderSubscriptionMarkdownExtension(fileName.slice(dot + 1));
}

/**
 * 订阅扫描用的 Markdown 文件判定。
 * 必须同时满足：可当作 TFile 使用，且 extension 为 md。
 */
export function isFolderSubscriptionMarkdownFile(
	file: TAbstractFile | null | undefined,
): file is TFile {
	if (!file) {
		return false;
	}
	const extension =
		"extension" in file
			? readString((file as { extension?: unknown }).extension)
			: "";
	if (!isFolderSubscriptionMarkdownExtension(extension)) {
		return false;
	}
	return file instanceof TFileClass || ("path" in file && "extension" in file);
}

function isPathInsideVaultConfigDir(app: App, filePath: string): boolean {
	const configDir = normalizePath(String(app.vault.configDir || "").trim());
	const normalized = normalizePath(String(filePath || "").trim());
	if (!configDir || !normalized) {
		return false;
	}
	return (
		normalized === configDir || normalized.startsWith(`${configDir}/`)
	);
}

function scanMarkdownFilesInFolder(app: App, folderPath: string): TFile[] {
	const normalizedFolderPath =
		normalizeIncrementalReadingFolderSubscriptionPath(folderPath);
	if (!normalizedFolderPath) {
		return [];
	}
	if (
		normalizedFolderPath !== "/" &&
		isPathInsideVaultConfigDir(app, normalizedFolderPath)
	) {
		return [];
	}

	const root =
		normalizedFolderPath === "/"
			? app.vault.getRoot()
			: app.vault.getAbstractFileByPath(normalizedFolderPath);
	if (!isVaultFolder(root)) {
		return [];
	}

	const files: TFile[] = [];
	const visit = (folder: TFolder): void => {
		if (isPathInsideVaultConfigDir(app, folder.path || "")) {
			return;
		}
		for (const child of folder.children) {
			if (isVaultFolder(child)) {
				visit(child);
				continue;
			}
			if (!isFolderSubscriptionMarkdownFile(child)) {
				continue;
			}
			if (isPathInsideVaultConfigDir(app, child.path)) {
				continue;
			}
			files.push(child);
		}
	};
	visit(root);
	return files;
}

/**
 * 仅扫描订阅规则覆盖的文件夹内的 Markdown 文件，避免 `getMarkdownFiles()` 全库遍历。
 * 图片 / PDF / 其它附件一律不进入自动订阅候选；并排除 `vault.configDir`。
 */
export function collectMarkdownFilesForFolderSubscriptionRules(
	app: App,
	rules: IncrementalReadingFolderSubscriptionRule[],
): TFile[] {
	const seenPaths = new Set<string>();
	const collected: TFile[] = [];

	for (const rule of rules) {
		const folderPath = normalizeIncrementalReadingFolderSubscriptionPath(
			String(rule.folderPath || ""),
		);
		if (!folderPath) {
			continue;
		}
		for (const file of scanMarkdownFilesInFolder(app, folderPath)) {
			const normalizedPath = normalizePath(String(file.path || "").trim());
			if (!normalizedPath || seenPaths.has(normalizedPath)) {
				continue;
			}
			seenPaths.add(normalizedPath);
			collected.push(file);
		}
	}

	return collected;
}

function hasFolderChildren(
	file: TAbstractFile,
): file is TAbstractFile & { children: TAbstractFile[] } {
	return "children" in file && Array.isArray(file.children);
}

function isVaultFolder(
	file: TAbstractFile | null | undefined,
): file is TFolder {
	if (!file) {
		return false;
	}
	// Prefer real TFolder; duck-typing is only for test doubles.
	// Never treat a TFile as a folder even if a mock accidentally has children.
	if (file instanceof TFileClass) {
		return false;
	}
	return file instanceof TFolderClass || hasFolderChildren(file);
}
