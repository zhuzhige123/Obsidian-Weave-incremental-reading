import { describe, expect, it } from "vitest";
import { formatDueDateKeyFromTimestamp } from "../IRDueDateIndexService";
import { collectDueDateKeysForScheduleMutation } from "../IRPatchDayQueueService";

describe("formatDueDateKeyFromTimestamp", () => {
	it("returns null for invalid timestamps", () => {
		expect(formatDueDateKeyFromTimestamp(undefined)).toBeNull();
		expect(formatDueDateKeyFromTimestamp(0)).toBeNull();
	});

	it("formats local date key", () => {
		const key = formatDueDateKeyFromTimestamp(
			Date.parse("2026-06-18T12:00:00.000Z"),
		);
		expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe("collectDueDateKeysForScheduleMutation", () => {
	it("includes pinned day and old/new due dates", () => {
		const previous = Date.parse("2026-06-10T00:00:00.000Z");
		const next = Date.parse("2026-06-20T00:00:00.000Z");
		const keys = collectDueDateKeysForScheduleMutation(
			previous,
			next,
			"2026-06-18",
		);
		expect(keys).toContain("2026-06-18");
		expect(keys).toContain(formatDueDateKeyFromTimestamp(previous));
		expect(keys).toContain(formatDueDateKeyFromTimestamp(next));
	});
});

describe("assembleScheduleItemsForDailyQueue L1 contract", () => {
	it("keeps pending items when only one id is completed", async () => {
		const { assembleScheduleItemsForDailyQueue } = await import(
			"../IRScheduleItemSort"
		);
		const items = [
			{
				id: "a",
				priority: 2,
				nextRepDate: 0,
				explanation: { manualPriority: 2, effectivePriority: 2 },
			},
			{
				id: "b",
				priority: 1,
				nextRepDate: 0,
				explanation: { manualPriority: 1, effectivePriority: 1 },
			},
			{
				id: "c",
				priority: 3,
				nextRepDate: 0,
				explanation: { manualPriority: 3, effectivePriority: 3 },
			},
		];
		const assembled = assembleScheduleItemsForDailyQueue(items, "2026-06-18", {
			completedIds: ["b"],
			completedIdOrder: ["b"],
		});
		expect(assembled.map((item) => item.id)).toEqual(["c", "a", "b"]);
		expect(assembled.filter((item) => item.id !== "b")).toHaveLength(2);
	});
});
