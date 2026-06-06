import type { App, TAbstractFile, TFile, TFolder } from "obsidian";
import { normalizePath, TFile as TFileClass, TFolder as TFolderClass } from "obsidian";
import type { IncrementalReadingFolderSubscriptionRule } from "../../types/plugin-settings.d";
import { normalizeIncrementalReadingFolderSubscriptionPath } from "./folder-subscription-settings";

function scanMarkdownFilesInFolder(app: App, folderPath: string): TFile[] {
	const normalizedFolderPath = normalizeIncrementalReadingFolderSubscriptionPath(folderPath);
	if (!normalizedFolderPath) {
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
		for (const child of folder.children) {
			if (isVaultFolder(child)) {
				visit(child);
				continue;
			}
			if (isVaultMarkdownFile(child)) {
				files.push(child);
			}
		}
	};
	visit(root);
	return files;
}

/**
 * 仅扫描订阅规则覆盖的文件夹，避免 `getMarkdownFiles()` 全库遍历。
 */
export function collectMarkdownFilesForFolderSubscriptionRules(
	app: App,
	rules: IncrementalReadingFolderSubscriptionRule[]
): TFile[] {
	const seenPaths = new Set<string>();
	const collected: TFile[] = [];

	for (const rule of rules) {
		const folderPath = normalizeIncrementalReadingFolderSubscriptionPath(String(rule.folderPath || ""));
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
	file: TAbstractFile
): file is TAbstractFile & { children: TAbstractFile[] } {
	return "children" in file && Array.isArray(file.children);
}

function isVaultFolder(file: TAbstractFile | null | undefined): file is TFolder {
	if (!file) {
		return false;
	}
	return file instanceof TFolderClass || hasFolderChildren(file);
}

function isVaultMarkdownFile(file: TAbstractFile): file is TFile {
	if (file instanceof TFileClass) {
		return true;
	}
	return "extension" in file && String(file.extension || "").toLowerCase() === "md";
}
