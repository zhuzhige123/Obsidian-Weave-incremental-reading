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

/**
 * 列表标题是否像 `.irdeck` 文件名/路径。
 * 用于兜底：source 被 sanitize 清空后，title 仍残留 `五月份的书籍阅读.irdeck`。
 */
export function isIRDeckGhostLabel(value?: string | null): boolean {
	return isIRDeckFilePath(value);
}

/** 从路径提取用于展示的文件名（去掉扩展名）。 */
export function basenameWithoutExtension(
	path?: string | null,
	fallback = "",
): string {
	const normalizedPath = normalizePath(String(path || "").trim());
	const fileName = normalizedPath.split("/").pop() || "";
	const withoutExtension = fileName.replace(/\.[^.]+$/u, "").trim();
	return withoutExtension || fallback;
}

const INVALID_ROOT_PATHS = new Set(["/", "."]);

const POINT_SOURCE_PATH_METADATA_KEYS = [
	"sourcePath",
	"rawFilePath",
	"chunkFilePath",
] as const;

const POINT_SOURCE_PATH_LOCATOR_KEYS = [
	"filePath",
	"sourcePath",
	"chunkFilePath",
	"pdfPath",
	"epubFilePath",
	"rawFilePath",
] as const;

function readTrimmedString(value: unknown): string {
	return typeof value === "string" && value.trim() ? value.trim() : "";
}

/** 收集阅读点上可能残留的原始来源路径（sanitize 前）。 */
export function collectPointSourcePathCandidates(point: {
	source?: { path?: string | null } | null;
	metadata?: Record<string, unknown> | null;
	trace?: { locator?: Record<string, unknown> | null } | null;
}): string[] {
	const paths: string[] = [];
	const sourcePath = readTrimmedString(point.source?.path);
	if (sourcePath) {
		paths.push(sourcePath);
	}

	const metadata = point.metadata;
	if (metadata && typeof metadata === "object") {
		for (const key of POINT_SOURCE_PATH_METADATA_KEYS) {
			const value = readTrimmedString(metadata[key]);
			if (value) {
				paths.push(value);
			}
		}
	}

	const locator = point.trace?.locator;
	if (locator && typeof locator === "object") {
		for (const key of POINT_SOURCE_PATH_LOCATOR_KEYS) {
			const value = readTrimmedString(locator[key]);
			if (value) {
				paths.push(value);
			}
		}
	}

	return paths;
}

/**
 * 是否为「专题数据文件错误充当阅读点」的幽灵条目。
 * 判定：任意来源路径为 `.irdeck`，或标题/展示名就是 `.irdeck` 文件名。
 */
export function isIRDeckGhostPoint(point: {
	source?: { path?: string | null; title?: string | null } | null;
	userData?: { title?: string | null } | null;
	metadata?: Record<string, unknown> | null;
	trace?: { locator?: Record<string, unknown> | null } | null;
}): boolean {
	if (collectPointSourcePathCandidates(point).some(isIRDeckFilePath)) {
		return true;
	}
	if (isIRDeckGhostLabel(point.source?.title)) {
		return true;
	}
	if (isIRDeckGhostLabel(point.userData?.title)) {
		return true;
	}
	if (isIRDeckGhostLabel(readTrimmedString(point.metadata?.pointTitle))) {
		return true;
	}
	return false;
}

export function isIRDeckGhostPointSnapshot(snapshot: {
	point: Parameters<typeof isIRDeckGhostPoint>[0];
	material?: {
		source?: { path?: string | null } | null;
		bibliography?: { title?: string | null } | null;
	} | null;
}): boolean {
	if (isIRDeckGhostPoint(snapshot.point)) {
		return true;
	}
	if (isIRDeckFilePath(snapshot.material?.source?.path)) {
		return true;
	}
	if (isIRDeckGhostLabel(snapshot.material?.bibliography?.title)) {
		return true;
	}
	return false;
}

/** 静态形状校验：不访问 vault，用于写入门禁与磁盘扫描。 */
export function isValidUserReadingSourcePathShape(
	path?: string | null,
): boolean {
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

/**
 * 调度/月历列表排除：来源是 `.irdeck`，或标题仍残留 `.irdeck` 文件名
 * （sanitize 清空路径后的常见泄漏形态）。
 */
export function shouldExcludeScheduleItemBySource(item: {
	sourceFile?: string | null;
	title?: string | null;
	displayName?: string | null;
}): boolean {
	return (
		isIRInternalScheduleSourcePath(item.sourceFile) ||
		isIRDeckGhostLabel(item.title) ||
		isIRDeckGhostLabel(item.displayName)
	);
}
