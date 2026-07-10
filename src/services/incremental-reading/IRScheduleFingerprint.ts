import type { IRPointFileIndex } from "../../types/ir-point-storage-types";
import type {
	IRBlock,
	IRBlockMeta,
	IRChunkFileData,
	IRDeck,
} from "../../types/ir-types";
import { resolveAssociatedNotePaths } from "./IRAssociatedNoteSignals";
import type { IRWorkspaceDataSnapshot } from "./IRWorkspaceSnapshotService";

export interface IRScheduleFingerprintSource {
	decksRecord?: Record<string, IRDeck>;
	blocksRecord?: Record<string, IRBlock>;
	chunksRecord?: Record<string, IRChunkFileData>;
	pdfTasks?: unknown[];
	epubTasks?: unknown[];
}

function collectBookmarkLinkedNotePaths(meta: unknown): string[] {
	if (!meta || typeof meta !== "object") {
		return [];
	}

	const record = meta as IRBlockMeta;
	return resolveAssociatedNotePaths({
		associatedNotePath:
			record.primaryAssociatedNotePath || record.associatedNotePath,
		associatedNotePaths: record.associatedNotePaths,
	});
}

export function hashStableValue(value: unknown): string {
	return hashString(stableStringify(value));
}

function stableStringify(value: unknown): string {
	if (value === null || value === undefined) {
		return "null";
	}
	if (typeof value === "number") {
		return Number.isFinite(value) ? String(value) : "null";
	}
	if (typeof value === "boolean") {
		return value ? "true" : "false";
	}
	if (typeof value === "string") {
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
	}
	if (value instanceof Date) {
		return JSON.stringify(value.toISOString());
	}
	if (typeof value === "object") {
		const record = value as Record<string, unknown>;
		return `{${Object.keys(record)
			.sort((left, right) => left.localeCompare(right))
			.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

function hashString(input: string): string {
	let hash = 2166136261;
	for (let index = 0; index < input.length; index += 1) {
		hash ^= input.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function buildScheduleFingerprint(
	source: IRScheduleFingerprintSource,
): string {
	const chunkSignals: Record<string, unknown> = {};
	for (const [chunkId, chunk] of Object.entries(source.chunksRecord || {})) {
		chunkSignals[chunkId] = {
			scheduleStatus: chunk.scheduleStatus,
			nextRepDate: chunk.nextRepDate,
			priorityUi: chunk.priorityUi,
			priorityEff: chunk.priorityEff,
			intervalDays: chunk.intervalDays,
			deckIds: chunk.deckIds,
			deckTag: chunk.deckTag,
		};
	}

	const blockSignals: Record<string, unknown> = {};

	const deckSignals: Record<string, unknown> = {};
	for (const [deckKey, deck] of Object.entries(source.decksRecord || {})) {
		deckSignals[deckKey] = {
			id: deck.id,
			path: (deck as { path?: string }).path,
			blockIds: deck.blockIds,
			sourceFiles: deck.sourceFiles,
		};
	}

	const pdfSignals = (source.pdfTasks || []).map((task) => {
		const record = task as Record<string, unknown>;
		return {
			id: record.id,
			status: record.status,
			nextRepDate: record.nextRepDate,
			topicId: record.topicId ?? record.deckId,
			priority: record.priority,
			linkedNotePaths: collectBookmarkLinkedNotePaths(record.meta),
		};
	});
	const epubSignals = (source.epubTasks || []).map((task) => {
		const record = task as Record<string, unknown>;
		return {
			id: record.id,
			status: record.status,
			nextRepDate: record.nextRepDate,
			topicId: record.topicId ?? record.deckId,
			priority: record.priority,
			linkedNotePaths: collectBookmarkLinkedNotePaths(record.meta),
		};
	});

	return hashStableValue({
		chunkSignals,
		blockSignals,
		deckSignals,
		pdfSignals,
		epubSignals,
	});
}

export function buildScheduleFingerprintFromWorkspace(
	workspaceData: IRWorkspaceDataSnapshot,
): string {
	return buildScheduleFingerprint({
		decksRecord: workspaceData.decksRecord,
		blocksRecord: workspaceData.blocksRecord,
		chunksRecord: workspaceData.chunksRecord,
		pdfTasks: workspaceData.pdfTasks,
		epubTasks: workspaceData.epubTasks,
	});
}

/**
 * 持久化 revision：基于 point-files-index 内容，跨 Obsidian 重启稳定。
 * 替代会话内 snapshotListCacheVersion 用于 schedule-index freshness。
 */
export function buildPointFilesIndexRevision(index: IRPointFileIndex): string {
	const fileSignals = (index.files || [])
		.map((entry) => ({
			file: String(entry.file || "").trim(),
			topicId: String(entry.topicId || "").trim(),
			pointCount: Math.max(0, Number(entry.pointCount || 0)),
			updatedAt: String(entry.updatedAt || "").trim(),
			pointIds: Array.isArray(entry.pointIds)
				? [...entry.pointIds]
						.map((id) => String(id || "").trim())
						.filter(Boolean)
						.sort()
				: [],
		}))
		.filter((entry) => entry.file)
		.sort((left, right) => left.file.localeCompare(right.file));

	return hashStableValue({
		schemaVersion: Number(index.schemaVersion || 0),
		updatedAt: String(index.updatedAt || "").trim(),
		files: fileSignals,
	});
}

export function buildExternalBookmarkTasksRevision(
	tasks: Array<{ id?: string; updatedAt?: number; meta?: unknown }>,
): string {
	const signals = tasks
		.map((task) => ({
			id: String(task?.id || "").trim(),
			updatedAt: Number(task?.updatedAt || 0),
			linkedNotePaths: collectBookmarkLinkedNotePaths(task?.meta),
		}))
		.filter((task) => task.id)
		.sort((left, right) => left.id.localeCompare(right.id));
	return hashStableValue(signals);
}
