import type { IRPoint } from "../types/ir-point-storage-types";
import {
	isValidUserReadingSourcePathShape,
	sanitizeUserReadingSourcePath,
} from "./ir-internal-data-path";

const LOCATOR_PATH_KEYS = [
	"filePath",
	"sourcePath",
	"chunkFilePath",
	"pdfPath",
	"canvasPath",
	"epubFilePath",
	"rawFilePath",
] as const;

const METADATA_PATH_KEYS = ["sourcePath", "rawFilePath", "chunkFilePath"] as const;

function sanitizePathValue(value: unknown): { next: string; changed: boolean } {
	if (typeof value !== "string" || !value.trim()) {
		return { next: "", changed: false };
	}
	const raw = value.trim();
	const sanitized = sanitizeUserReadingSourcePath(raw);
	if (sanitized === raw) {
		return { next: sanitized, changed: false };
	}
	return { next: sanitized, changed: true };
}

function sanitizeRecordPathFields(
	record: Record<string, unknown> | undefined,
	keys: readonly string[],
	options?: { emptyStringKeys?: readonly string[] }
): { next: Record<string, unknown> | undefined; changed: boolean; clearedFields: string[] } {
	if (!record) {
		return { next: record, changed: false, clearedFields: [] };
	}

	const emptyStringKeys = new Set(options?.emptyStringKeys || []);
	let changed = false;
	const clearedFields: string[] = [];
	const next: Record<string, unknown> = { ...record };

	for (const key of keys) {
		if (!(key in next)) {
			continue;
		}
		const result = sanitizePathValue(next[key]);
		if (!result.changed) {
			continue;
		}
		changed = true;
		if (!result.next && typeof record[key] === "string" && record[key].trim()) {
			clearedFields.push(key);
		}
		if (result.next) {
			next[key] = result.next;
		} else if (emptyStringKeys.has(key)) {
			next[key] = "";
		} else {
			delete next[key];
		}
	}

	return { next: changed ? next : record, changed, clearedFields };
}

/** 统计 raw JSON point 中无效来源路径字段数量（用于数据管理扫描）。 */
export function countInvalidSourcePathFieldsInRawPoint(point: unknown): number {
	if (!point || typeof point !== "object" || Array.isArray(point)) {
		return 0;
	}

	const record = point as Record<string, unknown>;
	let invalidCount = 0;

	const source =
		record.source && typeof record.source === "object"
			? (record.source as Record<string, unknown>)
			: null;
	if (typeof source?.path === "string" && source.path.trim()) {
		if (!isValidUserReadingSourcePathShape(source.path)) {
			invalidCount += 1;
		}
	}

	const metadata =
		record.metadata && typeof record.metadata === "object"
			? (record.metadata as Record<string, unknown>)
			: null;
	for (const key of METADATA_PATH_KEYS) {
		const value = metadata?.[key];
		if (typeof value === "string" && value.trim() && !isValidUserReadingSourcePathShape(value)) {
			invalidCount += 1;
		}
	}

	const locator =
		record.trace && typeof record.trace === "object"
			? ((record.trace as Record<string, unknown>).locator as Record<string, unknown> | undefined)
			: undefined;
	for (const key of LOCATOR_PATH_KEYS) {
		const value = locator?.[key];
		if (typeof value === "string" && value.trim() && !isValidUserReadingSourcePathShape(value)) {
			invalidCount += 1;
		}
	}

	return invalidCount;
}

/** 规范化单个 point 内所有来源路径字段；返回是否发生变化。 */
export function sanitizePointSourcePathFields(point: IRPoint): {
	point: IRPoint;
	changed: boolean;
	clearedFields: string[];
} {
	const clearedFields: string[] = [];
	let changed = false;
	let nextPoint: IRPoint = point;

	const sourceRecord =
		point.source && typeof point.source === "object"
			? ({ ...point.source } as Record<string, unknown>)
			: undefined;
	const sourceResult = sanitizeRecordPathFields(sourceRecord, ["path"], {
		emptyStringKeys: ["path"],
	});
	if (sourceResult.changed) {
		changed = true;
		clearedFields.push(
			...sourceResult.clearedFields.map((field) => `source.${field}`)
		);
		nextPoint = {
			...nextPoint,
			source: sourceResult.next as unknown as IRPoint["source"],
		};
	}

	const metadataResult = sanitizeRecordPathFields(
		nextPoint.metadata && typeof nextPoint.metadata === "object"
			? ({ ...nextPoint.metadata } as Record<string, unknown>)
			: undefined,
		METADATA_PATH_KEYS
	);
	if (metadataResult.changed) {
		changed = true;
		clearedFields.push(
			...metadataResult.clearedFields.map((field) => `metadata.${field}`)
		);
		nextPoint = {
			...nextPoint,
			metadata: metadataResult.next as IRPoint["metadata"],
		};
	}

	const trace = nextPoint.trace;
	if (trace && typeof trace === "object") {
		const locatorResult = sanitizeRecordPathFields(
			trace.locator && typeof trace.locator === "object"
				? ({ ...trace.locator } as Record<string, unknown>)
				: undefined,
			LOCATOR_PATH_KEYS
		);
		if (locatorResult.changed) {
			changed = true;
			clearedFields.push(
				...locatorResult.clearedFields.map((field) => `trace.locator.${field}`)
			);
			nextPoint = {
				...nextPoint,
				trace: {
					...trace,
					locator: locatorResult.next as IRPoint["trace"]["locator"],
				},
			};
		}
	}

	return { point: nextPoint, changed, clearedFields };
}
