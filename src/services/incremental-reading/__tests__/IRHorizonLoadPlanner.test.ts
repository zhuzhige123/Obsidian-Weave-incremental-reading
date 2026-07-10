import { describe, expect, test } from "vitest";
import {
	buildHorizonLoadPolicy,
	smoothHorizonLoad,
	spreadBunchedDueDates,
} from "../IRHorizonLoadPlanner";
import type { IRPlannedScheduleItem } from "../IRScheduleKernel";

function createPlannedItem(input: {
	id: string;
	dayOffset: number;
	priority: number;
	estimatedMinutes?: number;
	anchor?: Date;
}): IRPlannedScheduleItem {
	const today = input.anchor ? new Date(input.anchor) : new Date();
	today.setHours(0, 0, 0, 0);
	const review = new Date(today);
	review.setDate(review.getDate() + input.dayOffset);
	return {
		id: input.id,
		sourceType: "chunk",
		priority: input.priority,
		estimatedMinutes: input.estimatedMinutes ?? 10,
		nextReviewDate: review,
		nextRepDate: review.getTime(),
		explanation: {
			manualPriority: input.priority,
			effectivePriority: input.priority,
			hasManualSchedule: false,
			estimatedMinutes: input.estimatedMinutes ?? 10,
			compositeScore: input.priority,
			scoreBreakdown: {},
		},
	};
}

describe("IRHorizonLoadPlanner", () => {
	test("spreadBunchedDueDates distributes items across horizon days", () => {
		const anchor = new Date("2026-06-18T00:00:00").getTime();
		const items = [
			{ nextRepDate: anchor },
			{ nextRepDate: anchor },
			{ nextRepDate: anchor },
		];
		const spread = spreadBunchedDueDates(items, 3, anchor);

		expect(spread.map((item) => item.nextRepDate)).toEqual([
			anchor,
			new Date("2026-06-19T00:00:00").getTime(),
			new Date("2026-06-20T00:00:00").getTime(),
		]);
	});

	test("smoothHorizonLoad moves low-priority items off overloaded peak day", () => {
		const today = new Date("2026-06-18T00:00:00");
		const policy = buildHorizonLoadPolicy({
			baselineMinutes: 40,
			flowStretchPercent: 15,
			enableLoadBasedDefer: true,
			enableHorizonSmoothing: true,
			horizonDays: 3,
			dailyReadingPointCap: 15,
		});
		const items = [
			createPlannedItem({
				id: "high",
				dayOffset: 0,
				priority: 9,
				estimatedMinutes: 20,
				anchor: today,
			}),
			createPlannedItem({
				id: "mid",
				dayOffset: 0,
				priority: 7,
				estimatedMinutes: 20,
				anchor: today,
			}),
			createPlannedItem({
				id: "low",
				dayOffset: 0,
				priority: 3,
				estimatedMinutes: 20,
				anchor: today,
			}),
		];

		const result = smoothHorizonLoad(items, today, policy);

		expect(result.spreadRecords.length).toBeGreaterThan(0);
		const lowItem = result.items.find((item) => item.id === "low");
		expect(lowItem?.nextReviewDate?.getDate()).not.toBe(18);
	});
});
