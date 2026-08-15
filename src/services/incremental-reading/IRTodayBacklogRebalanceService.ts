import type { App } from "obsidian";
import type { IRChunkFileData } from "../../types/ir-types";
import { resolveCalendarDisplayDateKey } from "./IRCalendarCommittedDueMaterials";
import {
	DEFAULT_DAILY_TIME_BUDGET_MINUTES,
	DEFAULT_TYPICAL_NEW_ITEM_MINUTES,
	estimateLoadMinutesFromReadingStats,
	resolveRemainingDailyAdmissionQuota,
} from "./IRDailyLoadAllocator";
import {
	FOLDER_SUBSCRIPTION_PENDING_ADMISSION_NEXT_REP_DATE,
	isFolderSubscriptionChunkPendingAdmission,
} from "./IRFolderSubscriptionAdmissionService";
import { IRStorageService } from "./IRStorageService";

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

function formatDateKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
		2,
		"0",
	)}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * 与月历「今日列表」同口径：钉日 / 序列锚点 / 承诺 due / 逾期滚入今天。
 * 仅看 nextRepDate<=今天会漏掉「仍挂在今日列表、但磁盘 due 已挪到未来」的项。
 */
function chunkAppearsOnTodayCalendar(
	chunk: IRChunkFileData,
	todayDateKey: string,
): boolean {
	if (isFolderSubscriptionChunkPendingAdmission(chunk)) {
		return false;
	}
	if (isInactiveScheduleStatus(String(chunk.scheduleStatus || ""))) {
		return false;
	}
	const meta = chunk.meta || {};
	const nextRepDate = Number(chunk.nextRepDate || 0);
	const displayDateKey = resolveCalendarDisplayDateKey(
		{
			manualSchedulePinnedDateKey: String(
				meta.manualSchedulePinnedDateKey || "",
			).trim() || undefined,
			sourceSequenceLocked: meta.sourceSequenceLocked === true,
			sourceSequenceAnchorDateKey: String(
				meta.sourceSequenceAnchorDateKey || "",
			).trim() || undefined,
			committedNextRepDate: nextRepDate > 0 ? nextRepDate : undefined,
			nextRepDate,
			scheduleStatus: String(chunk.scheduleStatus || ""),
		},
		todayDateKey,
	);
	return displayDateKey === todayDateKey;
}

function isManuallyPinnedToToday(
	chunk: IRChunkFileData,
	todayDateKey: string,
): boolean {
	return (
		String(chunk.meta?.manualSchedulePinnedDateKey || "").trim() ===
		todayDateKey
	);
}

function compareTodayBacklogChunks(
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
	if (leftOrder !== rightOrder && leftOrder > 0 && rightOrder > 0) {
		return leftOrder - rightOrder;
	}

	const nextRepDiff =
		Number(left.nextRepDate || 0) - Number(right.nextRepDate || 0);
	if (nextRepDiff !== 0) {
		return nextRepDiff;
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

export function selectTodayBacklogRebalancePlan(options: {
	chunks: IRChunkFileData[];
	todayStartMs: number;
	todayDateKey: string;
	dailyTimeBudgetMinutes: number;
	dailyReadingPointCap: number;
	maxEstimatedMinutesPerItem?: number;
	typicalNewItemMinutes?: number;
}): {
	keep: IRChunkFileData[];
	moveToPending: IRChunkFileData[];
	protectedPinned: IRChunkFileData[];
	todayOccupiedBefore: number;
	keepQuota: number;
} {
	const todayItems = options.chunks
		.filter((chunk) =>
			chunkAppearsOnTodayCalendar(chunk, options.todayDateKey),
		)
		.sort(compareTodayBacklogChunks);

	const protectedPinned = todayItems.filter((chunk) =>
		isManuallyPinnedToToday(chunk, options.todayDateKey),
	);
	const movable = todayItems.filter(
		(chunk) => !isManuallyPinnedToToday(chunk, options.todayDateKey),
	);

	const protectedMinutes = protectedPinned.reduce(
		(sum, chunk) =>
			sum +
			estimateLoadMinutesFromReadingStats(
				chunk.stats,
				options.maxEstimatedMinutesPerItem,
			),
		0,
	);

	const quota = resolveRemainingDailyAdmissionQuota({
		dailyTimeBudgetMinutes: options.dailyTimeBudgetMinutes,
		dailyReadingPointCap: options.dailyReadingPointCap,
		todayOccupiedCount: protectedPinned.length,
		todayOccupiedMinutes: protectedMinutes,
		maxEstimatedMinutesPerItem: options.maxEstimatedMinutesPerItem,
		typicalNewItemMinutes:
			options.typicalNewItemMinutes ?? DEFAULT_TYPICAL_NEW_ITEM_MINUTES,
	});

	const keepFromMovable = movable.slice(0, quota.admitCount);
	const moveToPending = movable.slice(quota.admitCount);

	return {
		keep: [...protectedPinned, ...keepFromMovable],
		moveToPending,
		protectedPinned,
		todayOccupiedBefore: todayItems.length,
		keepQuota: protectedPinned.length + quota.admitCount,
	};
}

export function applyTodayBacklogMoveToPending(
	chunk: IRChunkFileData,
	options: { nowMs?: number; sequenceGroup?: string; sequenceOrder?: number },
): IRChunkFileData {
	const nowMs = options.nowMs ?? Date.now();
	const previousMeta = { ...(chunk.meta || {}) };
	delete previousMeta.sourceSequenceLocked;
	delete previousMeta.sourceSequenceAnchorDateKey;
	delete previousMeta.manualSchedulePinnedDateKey;
	const meta = {
		...previousMeta,
		pendingFolderAdmission: true,
		...(options.sequenceGroup
			? { sourceSequenceGroup: options.sequenceGroup }
			: {}),
		...(typeof options.sequenceOrder === "number"
			? { sourceSequenceOrder: options.sequenceOrder }
			: {}),
	};

	return {
		...chunk,
		nextRepDate: FOLDER_SUBSCRIPTION_PENDING_ADMISSION_NEXT_REP_DATE,
		scheduleStatus: "new",
		updatedAt: nowMs,
		meta,
	};
}

export async function rebalanceTodayReadingPointBacklog(options: {
	app: App;
	todayStartMs: number;
	dailyTimeBudgetMinutes?: number;
	dailyReadingPointCap: number;
	maxEstimatedMinutesPerItem?: number;
	storage?: IRStorageService;
}): Promise<{
	todayOccupiedBefore: number;
	keptToday: number;
	movedToPending: number;
	protectedPinned: number;
}> {
	const storage = options.storage ?? new IRStorageService(options.app);
	await storage.initialize();
	const chunks = Object.values(await storage.getAllChunkData());
	const todayDateKey = formatDateKey(new Date(options.todayStartMs));

	const plan = selectTodayBacklogRebalancePlan({
		chunks,
		todayStartMs: options.todayStartMs,
		todayDateKey,
		dailyTimeBudgetMinutes:
			options.dailyTimeBudgetMinutes ?? DEFAULT_DAILY_TIME_BUDGET_MINUTES,
		dailyReadingPointCap: options.dailyReadingPointCap,
		maxEstimatedMinutesPerItem: options.maxEstimatedMinutesPerItem,
	});

	if (plan.moveToPending.length === 0) {
		return {
			todayOccupiedBefore: plan.todayOccupiedBefore,
			keptToday: plan.keep.length,
			movedToPending: 0,
			protectedPinned: plan.protectedPinned.length,
		};
	}

	const nowMs = Date.now();
	const sequenceGroup = `today-backlog-rebalance:${todayDateKey}`;
	const updated = plan.moveToPending.map((chunk, index) =>
		applyTodayBacklogMoveToPending(chunk, {
			nowMs,
			sequenceGroup,
			sequenceOrder: index + 1,
		}),
	);
	await storage.saveChunkDataBatch(updated);

	return {
		todayOccupiedBefore: plan.todayOccupiedBefore,
		keptToday: plan.keep.length,
		movedToPending: updated.length,
		protectedPinned: plan.protectedPinned.length,
	};
}
