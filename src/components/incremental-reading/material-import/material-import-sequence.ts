import { normalizePath } from "obsidian";

/**
 * 单文件保留 `md:路径`（与历史拆分导入一致）；
 * 多文件整批共用一组，让「正序分散」的 sourceSequenceOrder 能跨文件比较。
 */
export function createMarkdownImportSequenceGroup(
	filePaths: string[],
	now: number = Date.now(),
): string {
	if (filePaths.length === 1) {
		return `md:${normalizePath(filePaths[0])}`;
	}
	return `md-batch:${now}`;
}
