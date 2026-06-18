import { describe, expect, test } from "vitest";
import {
	allocateDailyLoadByPriority,
	buildDailyLoadPolicy,
	computeDayOverloadLevel,
	computeStretchCeilingMinutes,
	isItemLoadDeferPinned,
} from "../IRDailyLoadAllocator";
import type { IRScheduleSortableItem } from "../IRScheduleItemSort";

function createSortableItem(input: {
	id: string;
	priority: number;
	estimatedMinutes?: number;
	hasManualSchedule?: boolean;
	manualSchedulePinnedDateKey?: string;
	sourceSequenceGroup?: string;
	sourceSequenceOrder?: number;
	sourceSequenceLocked?: boolean;
	sourceSequenceAnchorDateKey?: string;
}): IRScheduleSortableItem & { estimatedMinutes: number } {
	return {
		id: input.id,
		priority: input.priority,
		estimatedMinutes: input.estimatedMinutes ?? 10,
		nextRepDate: Date.now(),
		manualSchedulePinnedDateKey: input.manualSchedulePinnedDateKey,
		explanation: {
			manualPriority: input.priority,
			effectivePriority: input.priority,
			hasManualSchedule: Boolean(input.manualSchedulePinnedDateKey),
			estimatedMinutes: input.estimatedMinutes ?? 10,
			compositeScore: input.priority,
		},
		sourceSequenceGroup: input.sourceSequenceGroup,
		sourceSequenceOrder: input.sourceSequenceOrder,
		sourceSequenceLocked: input.sourceSequenceLocked,
		sourceSequenceAnchorDateKey: input.sourceSequenceAnchorDateKey,
	};
}

describe("IRDailyLoadAllocator", () => {
	test("computeStretchCeilingMinutes uses baseline and stretch percent", () => {
		expect(computeStretchCeilingMinutes(40, 15)).toBe(46);
		expect(computeStretchCeilingMinutes(45, 0)).toBe(45);
	});

	test("assigns all items when total load is within stretch ceiling", () => {
		const policy = buildDailyLoadPolicy({
			baselineMinutes: 45,
			flowStretchPercent: 15,
			enableLoadBasedDefer: true,
		});
		const result = allocateDailyLoadByPriority(
			[
				createSortableItem({ id: "a", priority: 8, estimatedMinutes: 15 }),
				createSortableItem({ id: "b", priority: 6, estimatedMinutes: 15 }),
				createSortableItem({ id: "c", priority: 4, estimatedMinutes: 15 }),
			],
			"2026-06-18",
			policy
		);

		expect(result.assigned.map((item) => item.id)).toEqual(["a", "b", "c"]);
		expect(result.deferred).toHaveLength(0);
		expect(result.stats.overloadLevel).toBe("normal");
	});

	test("defers low-priority tail when total exceeds stretch ceiling", () => {
		const policy = buildDailyLoadPolicy({
			baselineMinutes: 45,
			flowStretchPercent: 15,
			enableLoadBasedDefer: true,
		});
		const result = allocateDailyLoadByPriority(
			[
				createSortableItem({ id: "high", priority: 9, estimatedMinutes: 20 }),
				createSortableItem({ id: "mid", priority: 7, estimatedMinutes: 20 }),
				createSortableItem({ id: "low", priority: 3, estimatedMinutes: 20 }),
			],
			"2026-06-18",
			policy
		);

		expect(result.assigned.map((item) => item.id)).toEqual(["high", "mid"]);
		expect(result.deferred.map((item) => item.id)).toEqual(["low"]);
		expect(result.stats.deferredCount).toBe(1);
		expect(result.stats.overloadLevel).toBe("overloaded");
	});

	test("keeps pinned manual-schedule items even when exceeding stretch ceiling", () => {
		const policy = buildDailyLoadPolicy({
			baselineMinutes: 45,
			flowStretchPercent: 15,
			enableLoadBasedDefer: true,
			maxEstimatedMinutesPerItem: 30,
		});
		const pinned = createSortableItem({
			id: "pinned",
			priority: 2,
			estimatedMinutes: 30,
			manualSchedulePinnedDateKey: "2026-06-18",
		});
		const result = allocateDailyLoadByPriority(
			[
				createSortableItem({ id: "high", priority: 9, estimatedMinutes: 25 }),
				pinned,
			],
			"2026-06-18",
			policy
		);

		expect(result.assigned.map((item) => item.id)).toEqual(["high", "pinned"]);
		expect(result.deferred).toHaveLength(0);
		expect(result.stats.overloadLevel).toBe("overloaded");
	});

	test("warning band covers baseline to stretch ceiling", () => {
		expect(
			computeDayOverloadLevel({
				assignedMinutes: 46,
				baselineMinutes: 45,
				stretchCeilingMinutes: 52,
				assignedCount: 10,
				baselineCount: 15,
				stretchCountCeiling: 17,
				deferredCount: 0,
			})
		).toBe("warning");
		expect(
			computeDayOverloadLevel({
				assignedMinutes: 45,
				baselineMinutes: 45,
				stretchCeilingMinutes: 52,
				assignedCount: 15,
				baselineCount: 15,
				stretchCountCeiling: 17,
				deferredCount: 0,
			})
		).toBe("normal");
	});

	test("defers low-priority items when count exceeds stretch cap", () => {
		const policy = buildDailyLoadPolicy({
			baselineMinutes: 120,
			flowStretchPercent: 15,
			enableLoadBasedDefer: true,
			dailyReadingPointCap: 5,
		});
		const result = allocateDailyLoadByPriority(
			[
				createSortableItem({ id: "1", priority: 9, estimatedMinutes: 2 }),
				createSortableItem({ id: "2", priority: 8, estimatedMinutes: 2 }),
				createSortableItem({ id: "3", priority: 7, estimatedMinutes: 2 }),
				createSortableItem({ id: "4", priority: 6, estimatedMinutes: 2 }),
				createSortableItem({ id: "5", priority: 5, estimatedMinutes: 2 }),
				createSortableItem({ id: "6", priority: 4, estimatedMinutes: 2 }),
				createSortableItem({ id: "7", priority: 1, estimatedMinutes: 2 }),
			],
			"2026-06-18",
			policy
		);

		expect(result.assigned).toHaveLength(6);
		expect(result.deferred.map((item) => item.id)).toEqual(["7"]);
		expect(result.stats.overloadLevel).toBe("overloaded");
	});

	test("isItemLoadDeferPinned respects sequence lock on same day", () => {
		const item = createSortableItem({
			id: "seq",
			priority: 5,
			sourceSequenceLocked: true,
			sourceSequenceGroup: "import-batch",
			sourceSequenceOrder: 1,
			sourceSequenceAnchorDateKey: "2026-06-18",
		});
		expect(isItemLoadDeferPinned(item, "2026-06-18")).toBe(true);
		expect(isItemLoadDeferPinned(item, "2026-06-19")).toBe(false);
	});
});
