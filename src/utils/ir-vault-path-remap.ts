import { normalizePath } from "obsidian";
import type { IRPoint } from "../types/ir-point-storage-types";
import {
	IR_POINT_LOCATOR_PATH_KEYS,
	IR_POINT_METADATA_PATH_KEYS,
} from "./ir-point-source-path";

const EMBEDDED_PATH_STRING_KEYS = ["resumeLink", "link"] as const;

/**
 * Remap a vault path when a file or folder is renamed.
 * Supports exact match and folder-prefix remaps (`Notes/A` → `Notes/B`).
 * Returns null when the candidate is unaffected.
 */
export function remapVaultPath(
	filePath: string | null | undefined,
	oldPath: string,
	newPath: string,
): string | null {
	const normalizedFilePath = normalizePath(String(filePath || "").trim());
	const normalizedOldPath = normalizePath(String(oldPath || "").trim());
	const normalizedNewPath = normalizePath(String(newPath || "").trim());
	if (!normalizedFilePath || !normalizedOldPath || !normalizedNewPath) {
		return null;
	}
	if (normalizedOldPath === normalizedNewPath) {
		return null;
	}

	if (normalizedFilePath === normalizedOldPath) {
		return normalizedNewPath;
	}

	if (normalizedFilePath.startsWith(`${normalizedOldPath}/`)) {
		return `${normalizedNewPath}${normalizedFilePath.slice(normalizedOldPath.length)}`;
	}

	return null;
}

function stripExtension(path: string): string {
	return path.replace(/\.[^/.]+$/, "");
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace an exact vault path token without matching longer path prefixes
 * (e.g. avoid turning `Notes/A.mdx` when remapping `Notes/A.md`).
 */
function replaceExactPathToken(
	text: string,
	oldPath: string,
	newPath: string,
): string {
	const pattern = new RegExp(
		`(^|[^A-Za-z0-9._\\-/])(${escapeRegExp(oldPath)})(?=$|[^A-Za-z0-9._\\-])`,
		"g",
	);
	return text.replace(pattern, `$1${newPath}`);
}

/**
 * Rewrite vault paths embedded in wiki links, protocol URLs, or plain path text.
 */
export function remapEmbeddedVaultPathInText(
	text: string | null | undefined,
	oldPath: string,
	newPath: string,
): string {
	const raw = String(text || "");
	const normalizedOldPath = normalizePath(String(oldPath || "").trim());
	const normalizedNewPath = normalizePath(String(newPath || "").trim());
	if (
		!raw ||
		!normalizedOldPath ||
		!normalizedNewPath ||
		normalizedOldPath === normalizedNewPath
	) {
		return raw;
	}

	let next = replaceExactPathToken(raw, normalizedOldPath, normalizedNewPath);

	const encodedOld = encodeURIComponent(normalizedOldPath);
	const encodedNew = encodeURIComponent(normalizedNewPath);
	if (encodedOld !== normalizedOldPath && next.includes(encodedOld)) {
		next = next.split(encodedOld).join(encodedNew);
	}

	// Wiki links often omit the extension: [[Notes/Demo#^x]] for Notes/Demo.md
	const oldNoExt = stripExtension(normalizedOldPath);
	const newNoExt = stripExtension(normalizedNewPath);
	if (
		oldNoExt &&
		oldNoExt !== normalizedOldPath &&
		newNoExt &&
		oldNoExt !== newNoExt
	) {
		const wikiNoExtPattern = new RegExp(
			`(\\[\\[)${escapeRegExp(oldNoExt)}(?=#|\\||\\]\\])`,
			"g",
		);
		next = next.replace(wikiNoExtPattern, `$1${newNoExt}`);
	}

	return next;
}

function remapRecordPathFields(
	record: Record<string, unknown> | undefined,
	keys: readonly string[],
	oldPath: string,
	newPath: string,
): { next: Record<string, unknown> | undefined; changed: boolean } {
	if (!record) {
		return { next: record, changed: false };
	}

	let changed = false;
	const next: Record<string, unknown> = { ...record };
	for (const key of keys) {
		if (!(key in next) || typeof next[key] !== "string") {
			continue;
		}
		const remapped = remapVaultPath(String(next[key]), oldPath, newPath);
		if (remapped && remapped !== next[key]) {
			next[key] = remapped;
			changed = true;
		}
	}
	return { next: changed ? next : record, changed };
}

function remapEmbeddedStringFields(
	record: Record<string, unknown> | undefined,
	keys: readonly string[],
	oldPath: string,
	newPath: string,
): { next: Record<string, unknown> | undefined; changed: boolean } {
	if (!record) {
		return { next: record, changed: false };
	}

	let changed = false;
	const next: Record<string, unknown> = { ...record };
	for (const key of keys) {
		if (!(key in next) || typeof next[key] !== "string") {
			continue;
		}
		const current = String(next[key]);
		const remapped = remapEmbeddedVaultPathInText(current, oldPath, newPath);
		if (remapped !== current) {
			next[key] = remapped;
			changed = true;
		}
	}
	return { next: changed ? next : record, changed };
}

export interface RemapPointSourcePathsResult {
	point: IRPoint;
	changed: boolean;
}

/**
 * Remap vault source paths on a persisted IR point (source / locator / metadata / links / linked notes).
 */
export function remapPointSourcePaths(
	point: IRPoint,
	oldPath: string,
	newPath: string,
): RemapPointSourcePathsResult {
	let changed = false;
	let nextPoint: IRPoint = point;

	const remappedSourcePath = remapVaultPath(point.source?.path, oldPath, newPath);
	if (remappedSourcePath && remappedSourcePath !== point.source?.path) {
		changed = true;
		nextPoint = {
			...nextPoint,
			source: {
				...nextPoint.source,
				path: remappedSourcePath,
			},
		};
	}

	const locator =
		nextPoint.trace?.locator && typeof nextPoint.trace.locator === "object"
			? nextPoint.trace.locator
			: {};
	const locatorPaths = remapRecordPathFields(
		locator,
		IR_POINT_LOCATOR_PATH_KEYS,
		oldPath,
		newPath,
	);
	const locatorEmbedded = remapEmbeddedStringFields(
		locatorPaths.next || locator,
		EMBEDDED_PATH_STRING_KEYS,
		oldPath,
		newPath,
	);
	if (locatorPaths.changed || locatorEmbedded.changed) {
		changed = true;
		nextPoint = {
			...nextPoint,
			trace: {
				...nextPoint.trace,
				locator: locatorEmbedded.next || locator,
			},
		};
	}

	const metadata = nextPoint.metadata || {};
	const metadataPaths = remapRecordPathFields(
		metadata,
		IR_POINT_METADATA_PATH_KEYS,
		oldPath,
		newPath,
	);
	const metadataEmbedded = remapEmbeddedStringFields(
		metadataPaths.next || metadata,
		EMBEDDED_PATH_STRING_KEYS,
		oldPath,
		newPath,
	);
	if (metadataPaths.changed || metadataEmbedded.changed) {
		changed = true;
		nextPoint = {
			...nextPoint,
			metadata: metadataEmbedded.next || metadata,
		};
	}

	const currentLinked = Array.isArray(nextPoint.relations?.linkedNotePaths)
		? nextPoint.relations.linkedNotePaths
		: [];
	if (currentLinked.length > 0) {
		let linkedChanged = false;
		const nextLinked = currentLinked.map((path) => {
			const remapped = remapVaultPath(path, oldPath, newPath);
			if (remapped && remapped !== path) {
				linkedChanged = true;
				return remapped;
			}
			return path;
		});
		if (linkedChanged) {
			changed = true;
			nextPoint = {
				...nextPoint,
				relations: {
					...nextPoint.relations,
					linkedNotePaths: nextLinked,
				},
			};
		}
	}

	if (!changed) {
		return { point, changed: false };
	}

	return {
		changed: true,
		point: {
			...nextPoint,
			timestamps: {
				...nextPoint.timestamps,
				updatedAt: new Date().toISOString(),
			},
		},
	};
}
