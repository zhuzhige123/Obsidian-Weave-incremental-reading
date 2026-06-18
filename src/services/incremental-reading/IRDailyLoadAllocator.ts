import type { IRPlannedScheduleItem } from "./IRScheduleKernel";
import {
	isScheduleItemInitialSequenceLockedForDay,
	sortScheduleItemsForDailyQueue,
	type IRScheduleSortableItem,
} from "./IRScheduleItemSort";

export type IRDailyLoadOverloadLevel = "normal" | "warning" | "overloaded";
export type IRLoadDeferAction = "load_defer" | "horizon_spread";

export interface IRDailyLoadPolicy {
	baselineMinutes: number;
	flowStretchPercent: number;
	maxEstimatedMinutesPerItem: number;
	enableLoadBasedDefer: boolean;
	dailyReadingPointCap: number;
	dailyReadingPointStretchCap: number;
}

export interface IRDailyLoadDayStats {
	baselineMinutes: number;
	stretchCeilingMinutes: number;
	baselineCount: number;
	stretchCountCeiling: number;
	assignedMinutes: number;
	assignedCount: number;
	deferredMinutes: number;
	deferredCount: number;
	overloadLevel: IRDailyLoadOverloadLevel;
}

export interface IRLoadDeferralRecord {
	itemId: string;
	sourceType: IRPlannedScheduleItem["sourceType"];
	fromDateKey: string;
	toDateKey: string;
	fromNextRepDate: number;
	toNextRepDate: number;
	action: IRLoadDeferAction;
}

export interface IRDailyLoadAllocationResult<T extends IRScheduleSortableItem> {
	assigned: T[];
	deferred: T[];
	stats: IRDailyLoadDayStats;
}

export const DEFAULT_FLOW_STRETCH_PERCENT = 15;
export const DEFAULT_MAX_ESTIMATED_MINUTES_PER_ITEM = 18;
export const DEFAULT_HORIZON_SPREAD_DAYS = 7;

export const DEFAULT_DAILY_READING_POINT_CAP = 15;
export const MIN_FLOW_STRETCH_PERCENT = 0;
export const MAX_FLOW_STRETCH_PERCENT = 40;

export function clampFlowStretchPercent(value: number | undefined): number {
	const raw = Number(value);
	if (!Number.isFinite(raw)) {
		return DEFAULT_FLOW_STRETCH_PERCENT;
	}
	return Math.max(MIN_FLOW_STRETCH_PERCENT, Math.min(MAX_FLOW_STRETCH_PERCENT, Math.round(raw)));
}

export function clampMaxEstimatedMinutesPerItem(value: number | undefined): number {
	const raw = Number(value);
	if (!Number.isFinite(raw)) {
		return DEFAULT_MAX_ESTIMATED_MINUTES_PER_ITEM;
	}
	return Math.max(5, Math.min(30, Math.round(raw)));
}

export function clampDailyReadingPointCap(value: number | undefined): number {
	const raw = Number(value);
	if (!Number.isFinite(raw)) {
		return DEFAULT_DAILY_READING_POINT_CAP;
	}
	return Math.max(5, Math.min(40, Math.round(raw)));
}

export function computeReadingPointStretchCap(
	baselineCount: number,
	flowStretchPercent: number,
	explicitStretch?: number
): number {
	if (typeof explicitStretch === "number" && Number.isFinite(explicitStretch)) {
		return Math.max(baselineCount, Math.round(explicitStretch));
	}
	const baseline = clampDailyReadingPointCap(baselineCount);
	const percent = clampFlowStretchPercent(flowStretchPercent);
	return Math.round(baseline * (1 + percent / 100));
}

export function buildDailyLoadPolicy(input: {
	baselineMinutes?: number;
	flowStretchPercent?: number;
	maxEstimatedMinutesPerItem?: number;
	enableLoadBasedDefer?: boolean;
	dailyReadingPointCap?: number;
	dailyReadingPointStretchCap?: number;
}): IRDailyLoadPolicy {
	const baselineMinutes = Math.max(1, Number(input.baselineMinutes) || 40);
	const flowStretchPercent = clampFlowStretchPercent(input.flowStretchPercent);
	const dailyReadingPointCap = clampDailyReadingPointCap(input.dailyReadingPointCap);
	return {
		baselineMinutes,
		flowStretchPercent,
		maxEstimatedMinutesPerItem: clampMaxEstimatedMinutesPerItem(input.maxEstimatedMinutesPerItem),
		enableLoadBasedDefer: input.enableLoadBasedDefer !== false,
		dailyReadingPointCap,
		dailyReadingPointStretchCap: computeReadingPointStretchCap(
			dailyReadingPointCap,
			flowStretchPercent,
			input.dailyReadingPointStretchCap
		),
	};
}

export function computeStretchCeilingMinutes(
	baselineMinutes: number,
	flowStretchPercent: number
): number {
	const baseline = Math.max(1, baselineMinutes);
	const percent = clampFlowStretchPercent(flowStretchPercent);
	return Math.round(baseline * (1 + percent / 100));
}

export function resolveScheduleItemLoadMinutes(
	item: IRScheduleSortableItem & { estimatedMinutes?: number },
	maxEstimatedMinutesPerItem: number
): number {
	const raw =
		Number(item.estimatedMinutes) ||
		Number(item.explanation?.estimatedMinutes) ||
		5;
	return capItemLoadMinutes(raw, maxEstimatedMinutesPerItem);
}

export function capItemLoadMinutes(estimatedMinutes: number, maxPerItem: number): number {
	const raw = Math.max(0, Number(estimatedMinutes) || 0);
	const cap = clampMaxEstimatedMinutesPerItem(maxPerItem);
	return Math.min(Math.max(raw, 1), cap);
}

export function isItemLoadDeferPinned(item: IRScheduleSortableItem, dayKey: string): boolean {
	if (isScheduleItemInitialSequenceLockedForDay(item, dayKey)) {
		return true;
	}
	const pinnedDateKey = String(item.manualSchedulePinnedDateKey || "").trim();
	return Boolean(pinnedDateKey && pinnedDateKey === dayKey);
}

export function computeDayOverloadLevel(input: {
	assignedMinutes: number;
	baselineMinutes: number;
	stretchCeilingMinutes: number;
	assignedCount: number;
	baselineCount: number;
	stretchCountCeiling: number;
	deferredCount: number;
}): IRDailyLoadOverloadLevel {
	const minutesOverStretch = input.assignedMinutes > input.stretchCeilingMinutes;
	const countOverStretch = input.assignedCount > input.stretchCountCeiling;
	if (input.deferredCount > 0 || minutesOverStretch || countOverStretch) {
		return "overloaded";
	}
	const minutesWarning = input.assignedMinutes > input.baselineMinutes;
	const countWarning = input.assignedCount > input.baselineCount;
	if (minutesWarning || countWarning) {
		return "warning";
	}
	return "normal";
}

export function allocateDailyLoadByPriority<T extends IRScheduleSortableItem>(
	candidates: T[],
	dayKey: string,
	policy: IRDailyLoadPolicy,
	options?: {
		isPinned?: (item: T) => boolean;
	}
): IRDailyLoadAllocationResult<T> {
	const baselineMinutes = Math.max(1, policy.baselineMinutes);
	const stretchCeilingMinutes = computeStretchCeilingMinutes(
		baselineMinutes,
		policy.flowStretchPercent
	);
	const baselineCount = policy.dailyReadingPointCap;
	const stretchCountCeiling = policy.dailyReadingPointStretchCap;
	const sorted = sortScheduleItemsForDailyQueue(candidates, dayKey);
	const isPinned = options?.isPinned ?? ((item) => isItemLoadDeferPinned(item, dayKey));

	const assigned: T[] = [];
	const deferred: T[] = [];
	let assignedMinutes = 0;
	let deferredMinutes = 0;

	for (const item of sorted) {
		const load = resolveScheduleItemLoadMinutes(item, policy.maxEstimatedMinutesPerItem);
		if (!policy.enableLoadBasedDefer || isPinned(item)) {
			assigned.push(item);
			assignedMinutes += load;
			continue;
		}

		const withinMinutes =
			assigned.length === 0 || assignedMinutes + load <= stretchCeilingMinutes;
		const withinCount = assigned.length === 0 || assigned.length + 1 <= stretchCountCeiling;
		if (withinMinutes && withinCount) {
			assigned.push(item);
			assignedMinutes += load;
			continue;
		}

		deferred.push(item);
		deferredMinutes += load;
	}

	return {
		assigned,
		deferred,
		stats: {
			baselineMinutes,
			stretchCeilingMinutes,
			baselineCount,
			stretchCountCeiling,
			assignedMinutes,
			assignedCount: assigned.length,
			deferredMinutes,
			deferredCount: deferred.length,
			overloadLevel: computeDayOverloadLevel({
				assignedMinutes,
				baselineMinutes,
				stretchCeilingMinutes,
				assignedCount: assigned.length,
				baselineCount,
				stretchCountCeiling,
				deferredCount: deferred.length,
			}),
		},
	};
}
