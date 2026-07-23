import {
	type IRBlock,
	type IRBlockMeta,
	type IRChunkFileData,
	migrateToIRBlockV4,
} from "../../types/ir-types";
import { basenameWithoutExtension } from "../../utils/ir-internal-data-path";
import { getChunkTopicIds, getTaskTopicId } from "../../utils/ir-topic-compat";
import { readString } from "../../utils/unknown-record";
import { resolveAssociatedNotePaths } from "./IRAssociatedNoteSignals";
import type { IREpubBookmarkTask } from "./IREpubBookmarkTaskService";
import {
	supportsPointLinkedNotes,
	supportsPointLinkedNotesForScheduleItem,
} from "./IRLinkedNotePolicy";
import type { IRPdfBookmarkTask } from "./IRPdfBookmarkTaskService";
import type { IRProjectedScheduleItem } from "./IRProjectedScheduleSummary";
import { extractReadingPointDisplayName } from "./IRReadingPointTitle";
import type { IRScheduleExplanation } from "./IRScheduleKernel";
import { resolveLegacyBlockResumeLink } from "./paragraph-workbench/paragraph-block-reference";

export type ScheduleItemSourceType = IRProjectedScheduleItem["sourceType"];

type LegacyScheduleBlock = IRBlock & {
	primaryAssociatedNotePath?: string;
	associatedNotePath?: string;
	associatedNotePaths?: string[];
	meta?: Partial<IRBlockMeta>;
};

export interface ScheduleItem {
	id: string;
	title: string;
	displayName?: string;
	sourceFile: string;
	autoSubscribedAt?: string;
	autoSubscribedBadgeUntil?: string;
	primaryAssociatedNotePath?: string;
	associatedNotePath?: string;
	associatedNotePaths?: string[];
	associatedNoteScope?: "point" | "material";
	deckId?: string;
	priority: number;
	intervalDays: number;
	scheduleStatus: string;
	nextRepDate: number;
	nextReviewDate: Date | null;
	/** Reading-point creation time (ms epoch). */
	createdAt?: number;
	/** Reading-point last update time (ms epoch). */
	updatedAt?: number;
	resumeLink?: string;
	sourceType?: ScheduleItemSourceType;
	explanation?: IRScheduleExplanation;
	sourceSequenceGroup?: string;
	sourceSequenceOrder?: number;
	sourceSequenceLocked?: boolean;
	sourceSequenceAnchorDateKey?: string;
	manualSchedulePinnedDateKey?: string;
}

function normalizePointTimestampMs(value: unknown): number | undefined {
	if (typeof value === "number" && Number.isFinite(value) && value > 0) {
		return value;
	}
	if (typeof value === "string" && value.trim()) {
		const parsed = Date.parse(value);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
	}
	return undefined;
}

function extractChunkTitleFromFilePath(
	filePath: string,
	fallbackId?: string,
): string {
	const fallback = String(fallbackId || "").trim();
	const stem = basenameWithoutExtension(filePath, fallback);
	const cleaned = stem.replace(/^\d+_/, "").trim();
	return cleaned || stem || fallback || "Untitled";
}

function extractChunkTitle(
	chunk: IRChunkFileData,
	fallbackId?: string,
): string {
	const chunkMeta = (chunk?.meta || {}) as unknown as Record<string, unknown>;
	const pointTitle =
		typeof chunkMeta.pointTitle === "string"
			? String(chunkMeta.pointTitle || "").trim()
			: "";
	if (pointTitle) {
		return pointTitle;
	}
	return extractChunkTitleFromFilePath(
		String(chunk?.filePath || "").trim(),
		fallbackId,
	);
}

function getLegacyBlockDisplayName(block: IRBlock): string | undefined {
	const displayName =
		Array.isArray(block.headingPath) && block.headingPath.length > 0
			? String(block.headingPath[block.headingPath.length - 1] || "").trim()
			: "";
	return displayName || undefined;
}

function getLegacyBlockAssociatedNoteFields(
	block: LegacyScheduleBlock,
): Pick<
	ScheduleItem,
	| "primaryAssociatedNotePath"
	| "associatedNotePath"
	| "associatedNotePaths"
	| "associatedNoteScope"
> {
	if (!supportsPointLinkedNotes("legacy-block")) {
		return {};
	}

	const associatedNotePaths = resolveAssociatedNotePaths({
		associatedNotePath:
			block.primaryAssociatedNotePath ||
			block.associatedNotePath ||
			block.meta?.associatedNotePath,
		associatedNotePaths:
			block.associatedNotePaths || block.meta?.associatedNotePaths,
	});
	const primaryAssociatedNotePath = associatedNotePaths[0] || undefined;
	return {
		primaryAssociatedNotePath,
		associatedNotePath: primaryAssociatedNotePath,
		associatedNotePaths,
		associatedNoteScope: primaryAssociatedNotePath ? "point" : undefined,
	};
}

function normalizeScheduleItemSequenceOrder(
	value: unknown,
): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}
	return undefined;
}

function getScheduleItemSequenceMeta(
	meta: unknown,
): Pick<
	ScheduleItem,
	| "sourceSequenceGroup"
	| "sourceSequenceOrder"
	| "sourceSequenceLocked"
	| "sourceSequenceAnchorDateKey"
> {
	const record =
		meta && typeof meta === "object" ? (meta as Record<string, unknown>) : null;
	const sourceSequenceGroup =
		readString(record?.sourceSequenceGroup) || undefined;
	const sourceSequenceOrder = normalizeScheduleItemSequenceOrder(
		record?.sourceSequenceOrder,
	);
	const sourceSequenceAnchorDateKey =
		readString(record?.sourceSequenceAnchorDateKey) || undefined;

	return {
		sourceSequenceGroup,
		sourceSequenceOrder,
		sourceSequenceLocked:
			record?.sourceSequenceLocked === true ? true : undefined,
		sourceSequenceAnchorDateKey,
	};
}

export function buildScheduleItemFromProjectedItem(
	item: IRProjectedScheduleItem,
): ScheduleItem {
	const linkedNotesEnabled = supportsPointLinkedNotesForScheduleItem(item);
	const associatedNotePaths = linkedNotesEnabled
		? resolveAssociatedNotePaths({
				associatedNotePath: item.associatedNotePath,
				associatedNotePaths: item.associatedNotePaths,
		  })
		: [];
	const primaryAssociatedNotePath = associatedNotePaths[0];
	return {
		id: item.id,
		title: item.title,
		displayName: item.displayName,
		sourceFile: item.sourceFile,
		autoSubscribedAt: item.autoSubscribedAt,
		autoSubscribedBadgeUntil: item.autoSubscribedBadgeUntil,
		primaryAssociatedNotePath,
		associatedNotePath: primaryAssociatedNotePath,
		associatedNotePaths,
		associatedNoteScope: linkedNotesEnabled
			? item.associatedNoteScope
			: undefined,
		deckId: item.deckId,
		priority: item.priority,
		intervalDays: item.intervalDays,
		scheduleStatus: item.scheduleStatus,
		nextRepDate: item.nextRepDate,
		nextReviewDate: item.nextReviewDate,
		resumeLink: item.resumeLink,
		sourceType: item.sourceType,
		explanation: item.explanation,
		sourceSequenceGroup: item.sourceSequenceGroup,
		sourceSequenceOrder: item.sourceSequenceOrder,
		sourceSequenceLocked: item.sourceSequenceLocked,
		sourceSequenceAnchorDateKey: item.sourceSequenceAnchorDateKey,
		manualSchedulePinnedDateKey: item.manualSchedulePinnedDateKey,
		createdAt: normalizePointTimestampMs(item.createdAt),
		updatedAt: normalizePointTimestampMs(item.updatedAt),
	};
}

export function buildScheduleItemFromLegacyBlock(block: IRBlock): ScheduleItem {
	const legacyBlock = block as LegacyScheduleBlock;
	const migrated = migrateToIRBlockV4(block);
	const displayName = getLegacyBlockDisplayName(block);
	const title =
		displayName ||
		String(block.headingText || "").trim() ||
		String(block.contentPreview || "")
			.trim()
			.replace(/\s+/g, " ")
			.slice(0, 60) ||
		String(block.id || "").trim() ||
		"Untitled";

	return {
		id: block.id,
		title,
		displayName,
		sourceFile: String(block.filePath || "").trim(),
		deckId: String(block.deckPath || "").trim() || undefined,
		...getLegacyBlockAssociatedNoteFields(legacyBlock),
		priority: Number(block.priorityUi ?? block.priorityEff ?? 5),
		intervalDays: Number(block.interval ?? migrated.intervalDays ?? 1),
		scheduleStatus: String(block.state || migrated.status || "new"),
		nextRepDate: Number(migrated.nextRepDate || 0),
		nextReviewDate: migrated.nextRepDate
			? new Date(migrated.nextRepDate)
			: null,
		createdAt: normalizePointTimestampMs(
			migrated.createdAt ?? block.createdAt,
		),
		updatedAt: normalizePointTimestampMs(
			migrated.updatedAt ?? block.updatedAt,
		),
		resumeLink: resolveLegacyBlockResumeLink(block),
		...getScheduleItemSequenceMeta(legacyBlock.meta),
		sourceType: "legacy-block",
	};
}

export function buildScheduleItemFromChunkData(
	chunk: IRChunkFileData,
	fallbackId?: string,
): ScheduleItem {
	const filePath = String(chunk?.filePath || "").trim();
	const title = extractChunkTitle(
		chunk,
		fallbackId || String(chunk?.chunkId || "").trim(),
	);
	const associatedNotePaths = supportsPointLinkedNotes("chunk")
		? resolveAssociatedNotePaths({
				associatedNotePath:
					chunk?.meta?.primaryAssociatedNotePath ||
					chunk?.meta?.associatedNotePath,
				associatedNotePaths: chunk?.meta?.associatedNotePaths,
		  })
		: [];
	const primaryAssociatedNotePath = associatedNotePaths[0] || undefined;
	const nextRepDate = Number(chunk?.nextRepDate || 0);
	const chunkMeta = (chunk?.meta || {}) as unknown as Record<string, unknown>;

	return {
		id: String(chunk?.chunkId || fallbackId || "").trim(),
		title,
		displayName: extractReadingPointDisplayName(title),
		sourceFile: filePath,
		autoSubscribedAt:
			typeof chunkMeta.autoSubscribedAt === "string"
				? chunkMeta.autoSubscribedAt
				: undefined,
		autoSubscribedBadgeUntil:
			typeof chunkMeta.autoSubscribedBadgeUntil === "string"
				? chunkMeta.autoSubscribedBadgeUntil
				: undefined,
		deckId: String(getChunkTopicIds(chunk)[0] || "").trim() || undefined,
		primaryAssociatedNotePath,
		associatedNotePath: primaryAssociatedNotePath,
		associatedNotePaths,
		associatedNoteScope: primaryAssociatedNotePath ? "point" : undefined,
		priority: Number(chunk?.priorityUi ?? chunk?.priorityEff ?? 5),
		intervalDays: Number(chunk?.intervalDays ?? 1),
		scheduleStatus: String(chunk?.scheduleStatus || "new"),
		nextRepDate,
		nextReviewDate: nextRepDate > 0 ? new Date(nextRepDate) : null,
		createdAt: normalizePointTimestampMs(chunk?.createdAt),
		updatedAt: normalizePointTimestampMs(chunk?.updatedAt),
		resumeLink:
			typeof chunkMeta.resumeLink === "string"
				? chunkMeta.resumeLink
				: undefined,
		...getScheduleItemSequenceMeta(chunk?.meta),
		sourceType: "chunk",
	};
}

export function buildScheduleItemFromPdfTask(
	task: IRPdfBookmarkTask,
): ScheduleItem {
	const fullTitle = String(task?.title || "").trim() || "PDF";
	return {
		id: String(task?.id || "").trim(),
		title: fullTitle,
		displayName: extractReadingPointDisplayName(fullTitle),
		sourceFile: String(task?.pdfPath || "").trim(),
		primaryAssociatedNotePath:
			task?.meta?.primaryAssociatedNotePath || task?.meta?.associatedNotePath,
		associatedNotePath:
			task?.meta?.associatedNotePath || task?.meta?.primaryAssociatedNotePath,
		associatedNotePaths: resolveAssociatedNotePaths({
			associatedNotePath:
				task?.meta?.primaryAssociatedNotePath || task?.meta?.associatedNotePath,
			associatedNotePaths: task?.meta?.associatedNotePaths,
		}),
		associatedNoteScope:
			task?.meta?.associatedNotePath || task?.meta?.primaryAssociatedNotePath
				? "point"
				: undefined,
		resumeLink: task?.link,
		priority: Number(task?.priorityUi ?? task?.priorityEff ?? 5),
		intervalDays: Number(task?.intervalDays ?? 1),
		scheduleStatus: String(task?.status || "new"),
		nextRepDate: Number(task?.nextRepDate || 0),
		nextReviewDate: task?.nextRepDate ? new Date(task.nextRepDate) : null,
		createdAt: normalizePointTimestampMs(task?.createdAt),
		updatedAt: normalizePointTimestampMs(task?.updatedAt),
		deckId: String(getTaskTopicId(task) || "").trim() || undefined,
		...getScheduleItemSequenceMeta(task?.meta),
		sourceType: "pdf",
	};
}

export async function buildScheduleItemFromEpubTask(
	task: IREpubBookmarkTask,
	options?: {
		resolvedFilePath?: string;
		resolveFilePath?: (
			input: Pick<IREpubBookmarkTask, "sourceId" | "epubFilePath">,
		) => Promise<string>;
	},
): Promise<ScheduleItem> {
	const resolvedFilePath =
		options?.resolvedFilePath ||
		(await options?.resolveFilePath?.({
			sourceId: task?.sourceId,
			epubFilePath: task?.epubFilePath,
		})) ||
		String(task?.epubFilePath || "").trim();

	return {
		id: String(task?.id || "").trim(),
		title: String(task?.title || "").trim() || "EPUB",
		displayName: extractReadingPointDisplayName(
			String(task?.title || "").trim() || "EPUB",
		),
		sourceFile: resolvedFilePath,
		primaryAssociatedNotePath:
			task?.meta?.primaryAssociatedNotePath || task?.meta?.associatedNotePath,
		associatedNotePath:
			task?.meta?.associatedNotePath || task?.meta?.primaryAssociatedNotePath,
		associatedNotePaths: resolveAssociatedNotePaths({
			associatedNotePath:
				task?.meta?.primaryAssociatedNotePath || task?.meta?.associatedNotePath,
			associatedNotePaths: task?.meta?.associatedNotePaths,
		}),
		associatedNoteScope:
			task?.meta?.associatedNotePath || task?.meta?.primaryAssociatedNotePath
				? "point"
				: undefined,
		resumeLink:
			typeof task?.meta?.resumeLink === "string"
				? task.meta.resumeLink
				: undefined,
		priority: Number(task?.priorityUi ?? task?.priorityEff ?? 5),
		intervalDays: Number(task?.intervalDays ?? 1),
		scheduleStatus: String(task?.status || "new"),
		nextRepDate: Number(task?.nextRepDate || 0),
		nextReviewDate: task?.nextRepDate ? new Date(task.nextRepDate) : null,
		createdAt: normalizePointTimestampMs(task?.createdAt),
		updatedAt: normalizePointTimestampMs(task?.updatedAt),
		deckId: String(getTaskTopicId(task) || "").trim() || undefined,
		...getScheduleItemSequenceMeta(task?.meta),
		sourceType: "epub",
	};
}
