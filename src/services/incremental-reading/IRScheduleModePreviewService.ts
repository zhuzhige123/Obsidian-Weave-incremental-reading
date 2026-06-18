import type { IRAdvancedScheduleSettings, IRBlockStatus, IRBlockV4 } from "../../types/ir-types";
import { DEFAULT_IR_BLOCK_META, DEFAULT_IR_BLOCK_STATS } from "../../types/ir-types";
import type { ScheduleItem } from "./IRCalendarScheduleItem";
import {
	M_BASE,
	calculateNextRepDate,
	calculatePsi,
} from "./IRCoreAlgorithmsV4";

export type IRScheduleMenuAction = "intensive" | "normal" | "slow" | "postpone";

/**
 * 从月历列表项同步构造预览用 block，不触发 workspace / 存储 I/O。
 */
export function scheduleItemToPreviewBlockV4(item: ScheduleItem): IRBlockV4 {
	const priorityUi = item.explanation?.manualPriority ?? item.priority ?? 5;
	const priorityEff = item.explanation?.effectivePriority ?? priorityUi;
	const status = (String(item.scheduleStatus || "queued").trim() || "queued") as IRBlockStatus;

	return {
		id: item.id,
		sourcePath: item.sourceFile,
		blockId: item.id,
		contentHash: "",
		status,
		priorityUi,
		priorityEff,
		intervalDays: item.intervalDays ?? 1,
		nextRepDate: item.nextRepDate ?? 0,
		stats: { ...DEFAULT_IR_BLOCK_STATS },
		meta: {
			...DEFAULT_IR_BLOCK_META,
			manualSchedulePinnedDateKey: item.manualSchedulePinnedDateKey,
		},
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};
}

const SCHEDULING_DEFAULT_INTERVALS: Record<Exclude<IRScheduleMenuAction, "postpone">, number> = {
	intensive: 1,
	normal: 3,
	slow: 7,
};

const INTERVAL_MULTIPLIERS: Record<Exclude<IRScheduleMenuAction, "postpone">, number> = {
	intensive: 0.5,
	normal: 1,
	slow: 1.8,
};

export interface IRScheduleModePreviewInput {
	block: IRBlockV4;
	advancedSettings: IRAdvancedScheduleSettings;
	/** 标签组间隔系数；未提供时用 1.0（与 enableTagGroupPrior=false 一致）。 */
	tagGroupIntervalFactor?: number;
}

function clampIntervalDays(intervalDays: number, maxIntervalDays: number): number {
	return Math.max(1, Math.min(intervalDays, maxIntervalDays));
}

function withManualScheduleMeta(blockV4: IRBlockV4, nextRepDate: number, patch: Partial<IRBlockV4>): IRBlockV4 {
	const meta = { ...(blockV4.meta || {}) };
	if (nextRepDate > 0) {
		const date = new Date(nextRepDate);
		meta.manualSchedulePinnedDateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
			date.getDate()
		).padStart(2, "0")}`;
	} else {
		delete meta.manualSchedulePinnedDateKey;
	}
	return {
		...blockV4,
		...patch,
		meta,
		updatedAt: Date.now(),
	};
}

/**
 * Tier-A：单点公式计算某调度模式下的下次复习块（无全库重算、无磁盘 I/O）。
 */
export function computeScheduleModeAdjustedBlock(
	blockV4: IRBlockV4,
	mode: Exclude<IRScheduleMenuAction, "postpone">,
	input: IRScheduleModePreviewInput
): IRBlockV4 {
	const advancedSettings = input.advancedSettings;
	const mGroup =
		advancedSettings.enableTagGroupPrior === true
			? Math.max(0.1, Number(input.tagGroupIntervalFactor ?? 1) || 1)
			: 1;
	const currentInterval = blockV4.intervalDays || 1;
	const priorityEff = blockV4.priorityEff ?? blockV4.priorityUi ?? 5;

	let intervalDays: number;
	if (currentInterval <= 1) {
		intervalDays = SCHEDULING_DEFAULT_INTERVALS[mode];
	} else {
		const psi = calculatePsi(priorityEff);
		intervalDays = Math.round(
			currentInterval *
				(advancedSettings.defaultIntervalFactor ?? M_BASE) *
				mGroup *
				psi *
				INTERVAL_MULTIPLIERS[mode]
		);
	}

	intervalDays = clampIntervalDays(intervalDays, advancedSettings.maxIntervalDays ?? 365);
	const nextRepDate = calculateNextRepDate(intervalDays);

	return withManualScheduleMeta(blockV4, nextRepDate, {
		nextRepDate,
		intervalDays,
		status: "queued" as IRBlockStatus,
	});
}

/**
 * Tier-A：稍后（顺延 N 天）。
 */
export function computePostponeAdjustedBlock(blockV4: IRBlockV4, days: number): IRBlockV4 {
	const base = blockV4.nextRepDate > 0 ? new Date(blockV4.nextRepDate) : new Date();
	base.setHours(0, 0, 0, 0);
	base.setDate(base.getDate() + Math.max(1, Math.round(days)));
	const nextRepDate = base.getTime();
	return withManualScheduleMeta(blockV4, nextRepDate, {
		nextRepDate,
		status: "queued" as IRBlockStatus,
	});
}

export function computeAllScheduleMenuBlocks(
	blockV4: IRBlockV4,
	input: IRScheduleModePreviewInput
): Record<IRScheduleMenuAction, IRBlockV4> {
	return {
		intensive: computeScheduleModeAdjustedBlock(blockV4, "intensive", input),
		normal: computeScheduleModeAdjustedBlock(blockV4, "normal", input),
		slow: computeScheduleModeAdjustedBlock(blockV4, "slow", input),
		postpone: computePostponeAdjustedBlock(blockV4, 2),
	};
}
