import type {
	IRAdvancedScheduleSettings,
	IRBlockStatus,
	IRBlockV4,
} from "../../types/ir-types";
import {
	DEFAULT_IR_BLOCK_META,
	DEFAULT_IR_BLOCK_STATS,
} from "../../types/ir-types";
import type { ScheduleItem } from "./IRCalendarScheduleItem";
import {
	M_BASE,
	calculateNextRepDate,
	calculatePsi,
} from "./IRCoreAlgorithmsV4";

export type IRScheduleMenuAction = "intensive" | "normal" | "slow" | "postpone";

/** 月历「推迟」默认顺延天数（不改 intervalDays）。 */
export const POSTPONE_MENU_DAYS = 2;

/** 手动推迟次数默认上限；达到后禁止再推迟。 */
export const POSTPONE_MAX_COUNT = 2;

/**
 * 从月历列表项同步构造预览用 block，不触发 workspace / 存储 I/O。
 */
export function scheduleItemToPreviewBlockV4(item: ScheduleItem): IRBlockV4 {
	const priorityUi = item.explanation?.manualPriority ?? item.priority ?? 5;
	const priorityEff = item.explanation?.effectivePriority ?? priorityUi;
	const status = (String(item.scheduleStatus || "queued").trim() ||
		"queued") as IRBlockStatus;
	const postponeCount = Math.max(
		0,
		Math.round(Number(item.manualPostponeCount || 0)) || 0,
	);

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
			...(postponeCount > 0 ? { manualPostponeCount: postponeCount } : {}),
		},
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};
}

const SCHEDULING_DEFAULT_INTERVALS: Record<
	Exclude<IRScheduleMenuAction, "postpone">,
	number
> = {
	intensive: 1,
	normal: 3,
	slow: 7,
};

const INTERVAL_MULTIPLIERS: Record<
	Exclude<IRScheduleMenuAction, "postpone">,
	number
> = {
	intensive: 0.5,
	normal: 1,
	slow: 1.8,
};

export interface IRScheduleModePreviewInput {
	block: IRBlockV4;
	advancedSettings: IRAdvancedScheduleSettings;
	/** 标签组间隔系数；未提供时用 1.0（与 enableTagGroupPrior=false 一致）。 */
	tagGroupIntervalFactor?: number;
	/**
	 * 月历「推迟」基准日：当前列表所在日（dateKey / Date / timestamp）。
	 * 不传则仅相对今天顺延。故意不使用存储 nextRepDate（避免错位 due / 脏数据）。
	 */
	postponeContextDate?: Date | string | number | null;
}

function clampIntervalDays(
	intervalDays: number,
	maxIntervalDays: number,
): number {
	return Math.max(1, Math.min(intervalDays, maxIntervalDays));
}

function withManualScheduleMeta(
	blockV4: IRBlockV4,
	nextRepDate: number,
	patch: Partial<IRBlockV4>,
): IRBlockV4 {
	const meta = { ...(blockV4.meta || {}) };
	if (nextRepDate > 0) {
		const date = new Date(nextRepDate);
		meta.manualSchedulePinnedDateKey = `${date.getFullYear()}-${String(
			date.getMonth() + 1,
		).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
	} else {
		meta.manualSchedulePinnedDateKey = undefined;
	}
	return {
		...blockV4,
		...patch,
		meta,
		updatedAt: Date.now(),
	};
}

export function getManualPostponeCount(
	block: Pick<IRBlockV4, "meta"> | { meta?: { manualPostponeCount?: number } },
): number {
	return Math.max(
		0,
		Math.round(Number(block.meta?.manualPostponeCount || 0)) || 0,
	);
}

export function canPostponeBlock(
	block: Pick<IRBlockV4, "meta"> | { meta?: { manualPostponeCount?: number } },
	maxCount: number = POSTPONE_MAX_COUNT,
): boolean {
	return getManualPostponeCount(block) < Math.max(1, Math.round(maxCount));
}

function withManualPostponeCount(
	blockV4: IRBlockV4,
	count: number | undefined,
): IRBlockV4 {
	const meta = { ...(blockV4.meta || {}) };
	const normalized = Math.max(0, Math.round(Number(count || 0)) || 0);
	if (normalized > 0) {
		meta.manualPostponeCount = normalized;
	} else {
		delete meta.manualPostponeCount;
	}
	return {
		...blockV4,
		meta,
		updatedAt: Date.now(),
	};
}

/**
 * 安排 / 完成阅读：清零推迟计数。
 * 「推迟」仅表示未处理先挪开；一旦用户安排或真正处理，计数归零。
 */
export function clearManualPostponeCount(blockV4: IRBlockV4): IRBlockV4 {
	return withManualPostponeCount(blockV4, 0);
}

/**
 * Tier-A：单点公式计算某调度模式下的下次复习块（无全库重算、无磁盘 I/O）。
 * 强化/正常/放缓表示「安排处理」，清零推迟计数。
 */
export function computeScheduleModeAdjustedBlock(
	blockV4: IRBlockV4,
	mode: Exclude<IRScheduleMenuAction, "postpone">,
	input: IRScheduleModePreviewInput,
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
				INTERVAL_MULTIPLIERS[mode],
		);
	}

	intervalDays = clampIntervalDays(
		intervalDays,
		advancedSettings.maxIntervalDays ?? 365,
	);
	const nextRepDate = calculateNextRepDate(intervalDays);

	return clearManualPostponeCount(
		withManualScheduleMeta(blockV4, nextRepDate, {
			nextRepDate,
			intervalDays,
			status: "queued" as IRBlockStatus,
		}),
	);
}

/**
 * Tier-A：用户手动改期（提醒时间 / 加入今日等）。
 * 与强化/正常/放缓同属「安排」：钉住日期并清零推迟计数。
 */
export function computeManualRescheduleAdjustedBlock(
	blockV4: IRBlockV4,
	options: {
		nextRepDate: number;
		intervalDays?: number;
		scheduleStatus?: IRBlockStatus;
	},
): IRBlockV4 {
	return clearManualPostponeCount(
		withManualScheduleMeta(blockV4, options.nextRepDate, {
			nextRepDate: options.nextRepDate,
			intervalDays: options.intervalDays ?? blockV4.intervalDays,
			status: options.scheduleStatus ?? blockV4.status,
		}),
	);
}

function startOfLocalDay(date: Date): Date {
	const normalized = new Date(date);
	normalized.setHours(0, 0, 0, 0);
	return normalized;
}

/** 解析「推迟」上下文日；无效则返回 null。 */
export function parsePostponeContextDate(
	value: Date | string | number | null | undefined,
): Date | null {
	if (value == null || value === "") {
		return null;
	}
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) {
			return null;
		}
		return startOfLocalDay(value);
	}
	if (typeof value === "number") {
		if (!Number.isFinite(value) || value <= 0) {
			return null;
		}
		const fromTs = new Date(value);
		if (Number.isNaN(fromTs.getTime())) {
			return null;
		}
		return startOfLocalDay(fromTs);
	}

	const trimmed = String(value).trim();
	const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (match) {
		const parsed = new Date(
			Number(match[1]),
			Number(match[2]) - 1,
			Number(match[3]),
		);
		if (Number.isNaN(parsed.getTime())) {
			return null;
		}
		return startOfLocalDay(parsed);
	}

	const parsed = new Date(trimmed);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}
	return startOfLocalDay(parsed);
}

/**
 * 「推迟」基准日 = max(今天, 月历列表日)。
 * 不读取存储 nextRepDate：IR 的 postpone 是队列管理，不是间隔结论。
 */
export function resolvePostponeBaseDate(options?: {
	contextDate?: Date | string | number | null;
	now?: Date;
}): Date {
	const today = startOfLocalDay(options?.now ?? new Date());
	const context = parsePostponeContextDate(options?.contextDate);
	if (!context) {
		return today;
	}
	return context.getTime() > today.getTime() ? context : today;
}

/**
 * Tier-A：推迟（相对日历上下文顺延 N 天，保留 intervalDays）。
 * 默认次数 +1；已达上限且需要写盘时返回原 block。
 * `incrementCount: false` 仅用于达上限时的日期预览。
 */
export function computePostponeAdjustedBlock(
	blockV4: IRBlockV4,
	days: number = POSTPONE_MENU_DAYS,
	options?: {
		contextDate?: Date | string | number | null;
		now?: Date;
		maxCount?: number;
		incrementCount?: boolean;
	},
): IRBlockV4 {
	const maxCount = options?.maxCount ?? POSTPONE_MAX_COUNT;
	const shouldIncrement = options?.incrementCount !== false;
	if (shouldIncrement && !canPostponeBlock(blockV4, maxCount)) {
		return blockV4;
	}

	const base = resolvePostponeBaseDate({
		contextDate: options?.contextDate,
		now: options?.now,
	});
	const next = new Date(base);
	next.setDate(next.getDate() + Math.max(1, Math.round(days)));
	const nextRepDate = next.getTime();
	const scheduled = withManualScheduleMeta(blockV4, nextRepDate, {
		nextRepDate,
		intervalDays: blockV4.intervalDays || 1,
		status: "queued" as IRBlockStatus,
	});
	if (!shouldIncrement) {
		return scheduled;
	}
	return withManualPostponeCount(
		scheduled,
		getManualPostponeCount(blockV4) + 1,
	);
}

export function computeAllScheduleMenuBlocks(
	blockV4: IRBlockV4,
	input: IRScheduleModePreviewInput,
): Record<IRScheduleMenuAction, IRBlockV4> {
	const canPostpone = canPostponeBlock(blockV4);
	return {
		intensive: computeScheduleModeAdjustedBlock(blockV4, "intensive", input),
		normal: computeScheduleModeAdjustedBlock(blockV4, "normal", input),
		slow: computeScheduleModeAdjustedBlock(blockV4, "slow", input),
		postpone: computePostponeAdjustedBlock(blockV4, POSTPONE_MENU_DAYS, {
			contextDate: input.postponeContextDate,
			incrementCount: canPostpone,
		}),
	};
}
