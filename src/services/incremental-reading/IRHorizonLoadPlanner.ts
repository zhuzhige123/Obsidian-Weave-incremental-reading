import {
	DEFAULT_HORIZON_SPREAD_DAYS,
	type IRDailyLoadPolicy,
	type IRLoadDeferAction,
	type IRLoadDeferralRecord,
	buildDailyLoadPolicy,
	computeStretchCeilingMinutes,
	isItemLoadDeferPinned,
	resolveScheduleItemLoadMinutes,
} from "./IRDailyLoadAllocator";
import { getScheduleItemManualPriority } from "./IRScheduleItemSort";
import type { IRPlannedScheduleItem } from "./IRScheduleKernel";

export interface IRHorizonLoadPolicy extends IRDailyLoadPolicy {
	horizonDays: number;
	enableHorizonSmoothing: boolean;
}

export function buildHorizonLoadPolicy(input: {
	baselineMinutes?: number;
	flowStretchPercent?: number;
	maxEstimatedMinutesPerItem?: number;
	enableLoadBasedDefer?: boolean;
	horizonDays?: number;
	dailyReadingPointCap?: number;
	dailyReadingPointStretchCap?: number;
	enableHorizonSmoothing?: boolean;
}): IRHorizonLoadPolicy {
	return {
		...buildDailyLoadPolicy(input),
		horizonDays: Math.max(
			1,
			Math.min(
				14,
				Math.round(Number(input.horizonDays) || DEFAULT_HORIZON_SPREAD_DAYS),
			),
		),
		enableHorizonSmoothing: input.enableHorizonSmoothing !== false,
	};
}

function formatDateKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
		2,
		"0",
	)}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfDay(date: Date): Date {
	const normalized = new Date(date);
	normalized.setHours(0, 0, 0, 0);
	return normalized;
}

function addDays(base: Date, offset: number): Date {
	const next = new Date(base);
	next.setDate(next.getDate() + offset);
	next.setHours(0, 0, 0, 0);
	return next;
}

function dayOffsetBetween(target: Date, base: Date): number {
	return Math.round(
		(startOfDay(target).getTime() - startOfDay(base).getTime()) /
			(24 * 60 * 60 * 1000),
	);
}

type HorizonBucket<T> = {
	dayKey: string;
	day: Date;
	items: T[];
	minutes: number;
	count: number;
};

function getMaxDelayDays(priority: number): number {
	if (priority >= 8) {
		return 1;
	}
	if (priority >= 6) {
		return 3;
	}
	return 99;
}

function buildBuckets<T extends IRPlannedScheduleItem>(
	items: T[],
	today: Date,
	horizonDays: number,
	policy: IRDailyLoadPolicy,
): HorizonBucket<T>[] {
	const buckets: HorizonBucket<T>[] = [];
	for (let offset = 0; offset < horizonDays; offset++) {
		const day = addDays(today, offset);
		buckets.push({
			dayKey: formatDateKey(day),
			day,
			items: [],
			minutes: 0,
			count: 0,
		});
	}

	const lastKey = buckets[buckets.length - 1]?.dayKey;
	for (const item of items) {
		const reviewDate = item.nextReviewDate
			? startOfDay(item.nextReviewDate)
			: today;
		let dayKey = formatDateKey(reviewDate);
		const inHorizon = buckets.some((bucket) => bucket.dayKey === dayKey);
		if (!inHorizon) {
			dayKey = lastKey || formatDateKey(today);
		}
		const bucket =
			buckets.find((entry) => entry.dayKey === dayKey) || buckets[0];
		if (!bucket) {
			continue;
		}
		const load = resolveScheduleItemLoadMinutes(
			item,
			policy.maxEstimatedMinutesPerItem,
		);
		bucket.items.push(item);
		bucket.minutes += load;
		bucket.count += 1;
	}

	return buckets;
}

function recomputeBucketMetrics<T extends IRPlannedScheduleItem>(
	bucket: HorizonBucket<T>,
	policy: IRDailyLoadPolicy,
): void {
	bucket.minutes = 0;
	bucket.count = bucket.items.length;
	for (const item of bucket.items) {
		bucket.minutes += resolveScheduleItemLoadMinutes(
			item,
			policy.maxEstimatedMinutesPerItem,
		);
	}
}

function findValleyBucketIndex<T>(
	buckets: HorizonBucket<T>[],
	excludeIndex: number,
	stretchMinutes: number,
	stretchCount: number,
	itemLoad: number,
): number {
	let bestIndex = -1;
	let bestScore = Number.POSITIVE_INFINITY;
	for (let index = 0; index < buckets.length; index++) {
		if (index === excludeIndex) {
			continue;
		}
		const bucket = buckets[index];
		const projectedMinutes = bucket.minutes + itemLoad;
		const projectedCount = bucket.count + 1;
		const overload =
			Math.max(0, projectedMinutes - stretchMinutes) +
			Math.max(0, projectedCount - stretchCount) * 3;
		const score = projectedMinutes + projectedCount * 2 + overload * 10;
		if (score < bestScore) {
			bestScore = score;
			bestIndex = index;
		}
	}
	return bestIndex;
}

function isMovableToBucket<T extends IRPlannedScheduleItem>(
	item: T,
	fromBucket: HorizonBucket<T>,
	toBucket: HorizonBucket<T>,
	_today: Date,
): boolean {
	if (isItemLoadDeferPinned(item, fromBucket.dayKey)) {
		return false;
	}
	const original = item.nextReviewDate
		? startOfDay(item.nextReviewDate)
		: fromBucket.day;
	const maxDelay = getMaxDelayDays(getScheduleItemManualPriority(item));
	const delayDays = dayOffsetBetween(toBucket.day, original);
	if (delayDays < 0) {
		return false;
	}
	return delayDays <= maxDelay;
}

/**
 * 跨日注水平滑：将扎堆到期项分散到 horizon 内低负载日。
 */
export function smoothHorizonLoad<T extends IRPlannedScheduleItem>(
	items: T[],
	today: Date,
	policy: IRHorizonLoadPolicy,
): { items: T[]; spreadRecords: IRLoadDeferralRecord[] } {
	if (!policy.enableHorizonSmoothing || items.length === 0) {
		return { items, spreadRecords: [] };
	}

	const stretchMinutes = computeStretchCeilingMinutes(
		policy.baselineMinutes,
		policy.flowStretchPercent,
	);
	const stretchCount = policy.dailyReadingPointStretchCap;
	const buckets = buildBuckets(items, today, policy.horizonDays, policy);
	const spreadRecords: IRLoadDeferralRecord[] = [];
	const maxIterations = items.length * 3;
	let iteration = 0;

	while (iteration < maxIterations) {
		iteration += 1;
		let moved = false;
		const peakIndex = buckets.reduce((best, bucket, index, all) => {
			const bestBucket = all[best];
			if (!bestBucket) {
				return index;
			}
			const peakScore = bucket.minutes + bucket.count * 3;
			const bestScore = bestBucket.minutes + bestBucket.count * 3;
			return peakScore > bestScore ? index : best;
		}, 0);
		const peak = buckets[peakIndex];
		if (!peak) {
			break;
		}
		if (peak.minutes <= stretchMinutes && peak.count <= stretchCount) {
			break;
		}

		const candidates = [...peak.items]
			.filter((item) => !isItemLoadDeferPinned(item, peak.dayKey))
			.sort(
				(a, b) =>
					getScheduleItemManualPriority(a) - getScheduleItemManualPriority(b) ||
					String(a.id).localeCompare(String(b.id), "zh-CN"),
			);

		for (const item of candidates) {
			const itemLoad = resolveScheduleItemLoadMinutes(
				item,
				policy.maxEstimatedMinutesPerItem,
			);
			const valleyIndex = findValleyBucketIndex(
				buckets,
				peakIndex,
				stretchMinutes,
				stretchCount,
				itemLoad,
			);
			if (valleyIndex < 0) {
				continue;
			}
			const valley = buckets[valleyIndex];
			if (!valley || !isMovableToBucket(item, peak, valley, today)) {
				continue;
			}

			const fromNextRepDate = item.nextRepDate;
			const fromDateKey = peak.dayKey;
			peak.items = peak.items.filter((entry) => entry.id !== item.id);
			valley.items.push(item);
			item.nextReviewDate = new Date(valley.day);
			item.nextRepDate = valley.day.getTime();
			recomputeBucketMetrics(peak, policy);
			recomputeBucketMetrics(valley, policy);
			spreadRecords.push({
				itemId: item.id,
				sourceType: item.sourceType,
				fromDateKey,
				toDateKey: valley.dayKey,
				fromNextRepDate,
				toNextRepDate: valley.day.getTime(),
				action: "horizon_spread",
			});
			moved = true;
			break;
		}

		if (!moved) {
			break;
		}
	}

	return { items, spreadRecords };
}

export function findLowestLoadDayKey(
	dayKeys: string[],
	projectedMinutes: Map<string, number>,
	projectedCount: Map<string, number>,
	startIndex: number,
	stretchMinutes: number,
	stretchCount: number,
	itemLoad: number,
): string | null {
	let bestKey: string | null = null;
	let bestScore = Number.POSITIVE_INFINITY;
	for (let index = Math.max(0, startIndex); index < dayKeys.length; index++) {
		const dayKey = dayKeys[index];
		if (!dayKey) {
			continue;
		}
		const minutes = (projectedMinutes.get(dayKey) || 0) + itemLoad;
		const count = (projectedCount.get(dayKey) || 0) + 1;
		const overload =
			Math.max(0, minutes - stretchMinutes) +
			Math.max(0, count - stretchCount) * 3;
		const score = minutes + count * 2 + overload * 10;
		if (score < bestScore) {
			bestScore = score;
			bestKey = dayKey;
		}
	}
	return bestKey;
}

export function recordLoadDeferral(input: {
	item: IRPlannedScheduleItem;
	fromDateKey: string;
	toDateKey: string;
	fromNextRepDate: number;
	toNextRepDate: number;
	action?: IRLoadDeferAction;
}): IRLoadDeferralRecord {
	return {
		itemId: input.item.id,
		sourceType: input.item.sourceType,
		fromDateKey: input.fromDateKey,
		toDateKey: input.toDateKey,
		fromNextRepDate: input.fromNextRepDate,
		toNextRepDate: input.toNextRepDate,
		action: input.action ?? "load_defer",
	};
}

/**
 * 批量导入时将相同 due 扎堆项均摊到 horizon（导入管线可选调用）。
 */
export function spreadBunchedDueDates<T extends { nextRepDate: number }>(
	items: T[],
	horizonDays: number,
	anchorMs: number,
): T[] {
	if (items.length <= 1 || horizonDays <= 1) {
		return items;
	}
	const start = startOfDay(new Date(anchorMs));
	return items.map((item, index) => {
		const offset = index % horizonDays;
		const target = addDays(start, offset);
		return {
			...item,
			nextRepDate: target.getTime(),
		};
	});
}
