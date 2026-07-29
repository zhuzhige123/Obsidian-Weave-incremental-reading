import type { App } from "obsidian";
import type { IRChunkFileData } from "../../types/ir-types";
import { getChunkTopicIds } from "../../utils/ir-topic-compat";
import {
	DEFAULT_DAILY_TIME_BUDGET_MINUTES,
	DEFAULT_TYPICAL_NEW_ITEM_MINUTES,
	clampDailyReadingPointCap,
	estimateLoadMinutesFromReadingStats,
	resolveRemainingDailyAdmissionQuota,
} from "./IRDailyLoadAllocator";
import { IRStorageService } from "./IRStorageService";

/** 待放出阅读点的占位 due：不会进入今日/近端候选，直至每日准入。 */
export const FOLDER_SUBSCRIPTION_PENDING_ADMISSION_NEXT_REP_DATE =
	Date.UTC(2099, 0, 1);

export function isFolderSubscriptionPendingAdmission(
	meta: { pendingFolderAdmission?: boolean } | null | undefined,
): boolean {
	return meta?.pendingFolderAdmission === true;
}

export function isFolderSubscriptionChunkPendingAdmission(
	chunk: Pick<IRChunkFileData, "meta"> | null | undefined,
): boolean {
	return isFolderSubscriptionPendingAdmission(chunk?.meta);
}

function isInactiveScheduleStatus(status: string): boolean {
	const normalized = String(status || "")
		.trim()
		.toLowerCase();
	return (
		normalized === "removed" ||
		normalized === "done" ||
		normalized === "suspended"
	);
}

function chunkOccupiesToday(
	chunk: IRChunkFileData,
	endOfTodayMs: number,
): boolean {
	if (isFolderSubscriptionChunkPendingAdmission(chunk)) {
		return false;
	}
	if (isInactiveScheduleStatus(String(chunk.scheduleStatus || ""))) {
		return false;
	}
	const nextRepDate = Number(chunk.nextRepDate || 0);
	// 已准入的 new 与到期项一样占用今日名额；待放出项已在上方排除。
	if (String(chunk.scheduleStatus || "").trim() === "new") {
		return nextRepDate <= endOfTodayMs;
	}
	return nextRepDate > 0 && nextRepDate <= endOfTodayMs;
}

/** 统计今日已占用的阅读点名额（不含待放出）。 */
export function countTodayOccupiedReadingPoints(
	chunks: IRChunkFileData[],
	endOfTodayMs: number,
): number {
	return chunks.filter((chunk) => chunkOccupiesToday(chunk, endOfTodayMs))
		.length;
}

/** 统计今日已占用的估时分钟（不含待放出）。 */
export function sumTodayOccupiedReadingMinutes(
	chunks: IRChunkFileData[],
	endOfTodayMs: number,
	maxEstimatedMinutesPerItem?: number,
): number {
	let total = 0;
	for (const chunk of chunks) {
		if (!chunkOccupiesToday(chunk, endOfTodayMs)) {
			continue;
		}
		total += estimateLoadMinutesFromReadingStats(
			chunk.stats,
			maxEstimatedMinutesPerItem,
		);
	}
	return total;
}

/**
 * @deprecated 请使用 resolveRemainingDailyAdmissionQuota（时间 ∩ 条数）。
 * 保留为条数软顶剩余名额的薄封装。
 */
export function resolveRemainingDailyReadingPointSlots(options: {
	dailyReadingPointCap: number;
	todayOccupiedCount: number;
}): number {
	const cap = clampDailyReadingPointCap(options.dailyReadingPointCap);
	return Math.max(0, cap - Math.max(0, options.todayOccupiedCount));
}

function chunkBelongsToDeckScope(
	chunk: IRChunkFileData,
	deckIds: Set<string> | null,
): boolean {
	if (!deckIds || deckIds.size === 0) {
		return true;
	}
	return getChunkTopicIds(chunk).some((deckId) => deckIds.has(deckId));
}

function comparePendingAdmissionChunks(
	left: IRChunkFileData,
	right: IRChunkFileData,
): number {
	const leftPriority = Number(left.priorityUi ?? left.priorityEff ?? 0);
	const rightPriority = Number(right.priorityUi ?? right.priorityEff ?? 0);
	if (rightPriority !== leftPriority) {
		return rightPriority - leftPriority;
	}

	const leftOrder = Number(left.meta?.sourceSequenceOrder || 0);
	const rightOrder = Number(right.meta?.sourceSequenceOrder || 0);
	if (leftOrder !== rightOrder) {
		return leftOrder - rightOrder;
	}

	const leftSubscribed = String(left.meta?.autoSubscribedAt || "");
	const rightSubscribed = String(right.meta?.autoSubscribedAt || "");
	if (leftSubscribed !== rightSubscribed) {
		return leftSubscribed.localeCompare(rightSubscribed);
	}

	const createdDiff = Number(left.createdAt || 0) - Number(right.createdAt || 0);
	if (createdDiff !== 0) {
		return createdDiff;
	}

	return String(left.chunkId || "").localeCompare(
		String(right.chunkId || ""),
		"zh-CN",
	);
}

export function selectFolderSubscriptionAdmissionCandidates(options: {
	chunks: IRChunkFileData[];
	dailyReadingPointCap: number;
	dailyTimeBudgetMinutes: number;
	endOfTodayMs: number;
	deckIds?: string[];
	maxEstimatedMinutesPerItem?: number;
	typicalNewItemMinutes?: number;
}): {
	toAdmit: IRChunkFileData[];
	remainingSlots: number;
	remainingMinutes: number;
	todayOccupied: number;
	todayOccupiedMinutes: number;
	pendingCount: number;
} {
	const deckIds = options.deckIds?.length
		? new Set(
				options.deckIds
					.map((id) => String(id || "").trim())
					.filter(Boolean),
		  )
		: null;
	const todayOccupied = countTodayOccupiedReadingPoints(
		options.chunks,
		options.endOfTodayMs,
	);
	const todayOccupiedMinutes = sumTodayOccupiedReadingMinutes(
		options.chunks,
		options.endOfTodayMs,
		options.maxEstimatedMinutesPerItem,
	);
	const quota = resolveRemainingDailyAdmissionQuota({
		dailyTimeBudgetMinutes: options.dailyTimeBudgetMinutes,
		dailyReadingPointCap: options.dailyReadingPointCap,
		todayOccupiedCount: todayOccupied,
		todayOccupiedMinutes,
		maxEstimatedMinutesPerItem: options.maxEstimatedMinutesPerItem,
		typicalNewItemMinutes: options.typicalNewItemMinutes,
	});
	const pending = options.chunks
		.filter(
			(chunk) =>
				isFolderSubscriptionChunkPendingAdmission(chunk) &&
				!isInactiveScheduleStatus(String(chunk.scheduleStatus || "")) &&
				chunkBelongsToDeckScope(chunk, deckIds),
		)
		.sort(comparePendingAdmissionChunks);

	return {
		toAdmit: pending.slice(0, quota.admitCount),
		remainingSlots: quota.admitCount,
		remainingMinutes: quota.remainingMinutes,
		todayOccupied,
		todayOccupiedMinutes,
		pendingCount: pending.length,
	};
}

export function applyFolderSubscriptionAdmissionToChunk(
	chunk: IRChunkFileData,
	options: {
		todayStartMs: number;
		todayDateKey: string;
		nowMs?: number;
	},
): IRChunkFileData {
	const nowMs = options.nowMs ?? Date.now();
	const previousMeta = { ...(chunk.meta || {}) };
	delete previousMeta.pendingFolderAdmission;
	const meta = {
		...previousMeta,
		sourceSequenceLocked: true,
		sourceSequenceAnchorDateKey: options.todayDateKey,
	};
	return {
		...chunk,
		nextRepDate: options.todayStartMs,
		scheduleStatus: "new",
		updatedAt: nowMs,
		meta,
	};
}

export async function admitPendingFolderSubscriptionChunks(options: {
	app: App;
	todayStartMs: number;
	todayDateKey: string;
	dailyReadingPointCap: number;
	dailyTimeBudgetMinutes?: number;
	maxEstimatedMinutesPerItem?: number;
	typicalNewItemMinutes?: number;
	deckIds?: string[];
	storage?: IRStorageService;
}): Promise<{
	admittedChunkIds: string[];
	remainingPending: number;
	todayOccupiedBefore: number;
}> {
	const storage = options.storage ?? new IRStorageService(options.app);
	await storage.initialize();
	const chunksById = await storage.getAllChunkData();
	const chunks = Object.values(chunksById);
	const endOfToday = new Date(options.todayStartMs);
	endOfToday.setHours(23, 59, 59, 999);

	const selection = selectFolderSubscriptionAdmissionCandidates({
		chunks,
		dailyReadingPointCap: options.dailyReadingPointCap,
		dailyTimeBudgetMinutes:
			options.dailyTimeBudgetMinutes ?? DEFAULT_DAILY_TIME_BUDGET_MINUTES,
		endOfTodayMs: endOfToday.getTime(),
		deckIds: options.deckIds,
		maxEstimatedMinutesPerItem: options.maxEstimatedMinutesPerItem,
		typicalNewItemMinutes:
			options.typicalNewItemMinutes ?? DEFAULT_TYPICAL_NEW_ITEM_MINUTES,
	});

	if (selection.toAdmit.length === 0) {
		return {
			admittedChunkIds: [],
			remainingPending: selection.pendingCount,
			todayOccupiedBefore: selection.todayOccupied,
		};
	}

	const nowMs = Date.now();
	const updated = selection.toAdmit.map((chunk) =>
		applyFolderSubscriptionAdmissionToChunk(chunk, {
			todayStartMs: options.todayStartMs,
			todayDateKey: options.todayDateKey,
			nowMs,
		}),
	);
	await storage.saveChunkDataBatch(updated);

	return {
		admittedChunkIds: updated.map((chunk) => chunk.chunkId),
		remainingPending: Math.max(0, selection.pendingCount - updated.length),
		todayOccupiedBefore: selection.todayOccupied,
	};
}
