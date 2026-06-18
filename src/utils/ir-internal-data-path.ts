import { normalizePath } from "obsidian";

export const IR_DECK_FILE_EXTENSION = ".irdeck";

/** `.irdeck` 专题数据文件路径（增量阅读点存储，不是用户阅读材料）。 */
export function isIRDeckFilePath(path?: string | null): boolean {
	return String(path || "")
		.trim()
		.toLowerCase()
		.endsWith(IR_DECK_FILE_EXTENSION);
}

/**
 * 不应进入月历/调度/阅读材料列表的来源路径。
 * 当前仅覆盖 `.irdeck`；后续可在此集中扩展其它插件内部数据扩展名。
 */
export function isIRInternalScheduleSourcePath(path?: string | null): boolean {
	return isIRDeckFilePath(path);
}

/** 从路径提取用于展示的文件名（去掉扩展名）。 */
export function basenameWithoutExtension(path?: string | null, fallback = ""): string {
	const normalizedPath = normalizePath(String(path || "").trim());
	const fileName = normalizedPath.split("/").pop() || "";
	const withoutExtension = fileName.replace(/\.[^.]+$/u, "").trim();
	return withoutExtension || fallback;
}

const INVALID_ROOT_PATHS = new Set(["/", "."]);

/** 静态形状校验：不访问 vault，用于写入门禁与磁盘扫描。 */
export function isValidUserReadingSourcePathShape(path?: string | null): boolean {
	const normalized = normalizePath(String(path || "").trim());
	if (!normalized || INVALID_ROOT_PATHS.has(normalized)) {
		return false;
	}
	if (normalized.endsWith("/")) {
		return false;
	}
	if (isIRInternalScheduleSourcePath(normalized)) {
		return false;
	}
	const fileName = normalized.split("/").pop() || "";
	if (!fileName || !fileName.includes(".")) {
		return false;
	}
	return true;
}

/** 过滤内部数据路径；无效时返回空字符串。 */
export function sanitizeUserReadingSourcePath(path?: string | null): string {
	const normalized = normalizePath(String(path || "").trim());
	if (!isValidUserReadingSourcePathShape(normalized)) {
		return "";
	}
	return normalized;
}

export function shouldExcludeScheduleItemBySource(item: {
	sourceFile?: string | null;
}): boolean {
	return isIRInternalScheduleSourcePath(item.sourceFile);
}
