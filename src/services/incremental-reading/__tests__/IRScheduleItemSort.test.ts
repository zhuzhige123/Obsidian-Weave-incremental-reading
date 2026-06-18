import { describe, expect, test } from "vitest";
import {
	assembleScheduleItemsForDailyQueue,
	compareScheduleItemsForDailyQueue,
	getScheduleItemEffectivePriority,
	patchScheduleItemsInMapByDate,
} from "../IRScheduleItemSort";
import type { IRScheduleSortableItem } from "../IRScheduleItemSort";

function createSortableItem(input: {
	id: string;
	priority: number;
	effectivePriority?: number;
	overdueDays?: number;
	compositeScore?: number;
	sourceSequenceGroup?: string;
	sourceSequenceOrder?: number;
	sourceSequenceLocked?: boolean;
	sourceSequenceAnchorDateKey?: string;
}): IRScheduleSortableItem {
	return {
		id: input.id,
		priority: input.priority,
		nextRepDate: 0,
		explanation: {
			primaryReason: "test",
			secondaryReasons: [],
			isOverdue: (input.overdueDays ?? 0) > 0,
			overdueDays: input.overdueDays ?? 0,
			hasManualSchedule: false,
			estimatedMinutes: 5,
			scoreBreakdown: {} as never,
			compositeScore: input.compositeScore ?? 5,
			effectivePriority: input.effectivePriority ?? input.priority,
		},
		sourceSequenceGroup: input.sourceSequenceGroup,
		sourceSequenceOrder: input.sourceSequenceOrder,
		sourceSequenceLocked: input.sourceSequenceLocked,
		sourceSequenceAnchorDateKey: input.sourceSequenceAnchorDateKey,
	};
}

describe("IRScheduleItemSort", () => {
	test("更高优先级应排在前面，即使导入顺序更靠后", () => {
		const dayKey = "2026-06-18";
		const highPriorityLateImport = createSortableItem({
			id: "high",
			priority: 8.5,
			sourceSequenceGroup: "feed:demo",
			sourceSequenceOrder: 24,
			sourceSequenceLocked: true,
			sourceSequenceAnchorDateKey: dayKey,
		});
		const lowPriorityEarlyImport = createSortableItem({
			id: "low",
			priority: 5,
			sourceSequenceGroup: "feed:demo",
			sourceSequenceOrder: 20,
			sourceSequenceLocked: true,
			sourceSequenceAnchorDateKey: dayKey,
		});

		expect(
			compareScheduleItemsForDailyQueue(highPriorityLateImport, lowPriorityEarlyImport, dayKey)
		).toBeLessThan(0);
	});

	test("同优先级时保留同组导入顺序", () => {
		const dayKey = "2026-06-18";
		const first = createSortableItem({
			id: "first",
			priority: 5,
			sourceSequenceGroup: "feed:demo",
			sourceSequenceOrder: 1,
			sourceSequenceLocked: true,
			sourceSequenceAnchorDateKey: dayKey,
		});
		const second = createSortableItem({
			id: "second",
			priority: 5,
			sourceSequenceGroup: "feed:demo",
			sourceSequenceOrder: 2,
			sourceSequenceLocked: true,
			sourceSequenceAnchorDateKey: dayKey,
		});

		expect(compareScheduleItemsForDailyQueue(first, second, dayKey)).toBeLessThan(0);
	});

	test("effectivePriority 优先于 priority 字段", () => {
		const item = createSortableItem({
			id: "item",
			priority: 5,
			effectivePriority: 8.5,
		});

		expect(getScheduleItemEffectivePriority(item)).toBe(8.5);
	});

	test("手动优先级应优先于有效优先级用于展示排序", () => {
		const dayKey = "2026-06-18";
		const manualHigh = createSortableItem({
			id: "manual-high",
			priority: 8.5,
			effectivePriority: 5,
		});
		const effHigh = createSortableItem({
			id: "eff-high",
			priority: 5,
			effectivePriority: 8.5,
		});

		expect(compareScheduleItemsForDailyQueue(manualHigh, effHigh, dayKey)).toBeLessThan(0);
	});

	test("patchScheduleItemsInMapByDate 只重排优先级，不改变条目所属日期", () => {
		const dayKey = "2026-06-18";
		const materialsByDate = new Map([
			[
				dayKey,
				[
					createSortableItem({
						id: "low",
						priority: 5,
						sourceSequenceOrder: 1,
					}),
					createSortableItem({
						id: "high",
						priority: 5,
						sourceSequenceOrder: 2,
					}),
				],
			],
		]);

		const patched = patchScheduleItemsInMapByDate(
			materialsByDate,
			"high",
			8.5,
			8.5,
			[dayKey]
		);

		expect(patched.get(dayKey)?.map((item) => item.id)).toEqual(["high", "low"]);
		expect(patched.get(dayKey)?.[0]?.priority).toBe(8.5);
	});

	test("已完成阅读点应排在当天队列末尾", () => {
		const dayKey = "2026-06-18";
		const items = [
			createSortableItem({ id: "a", priority: 8 }),
			createSortableItem({ id: "b", priority: 7 }),
			createSortableItem({ id: "c", priority: 6 }),
		];

		const assembled = assembleScheduleItemsForDailyQueue(items, dayKey, {
			completedIds: ["b"],
			completedIdOrder: ["b"],
		});

		expect(assembled.map((item) => item.id)).toEqual(["a", "c", "b"]);
	});
});
