import { describe, expect, test } from "vitest";
import { sequenceItemsForDailyReading } from "../IRInterleaveSequencer";
import type { IRScheduleSortableItem } from "../IRScheduleItemSort";

function createItem(input: {
	id: string;
	priority: number;
	sourceFile: string;
	topicKey?: string;
	tagGroupId?: string;
}): IRScheduleSortableItem {
	return {
		id: input.id,
		priority: input.priority,
		sourceFile: input.sourceFile,
		topicKey: input.topicKey ?? input.sourceFile,
		tagGroupId: input.tagGroupId,
		nextRepDate: Date.now(),
		explanation: {
			manualPriority: input.priority,
			effectivePriority: input.priority,
			hasManualSchedule: false,
			estimatedMinutes: 5,
			compositeScore: input.priority,
		},
	};
}

describe("IRInterleaveSequencer", () => {
	test("off profile preserves input order", () => {
		const items = [
			createItem({ id: "a1", priority: 9, sourceFile: "/a.md" }),
			createItem({ id: "a2", priority: 8, sourceFile: "/a.md" }),
			createItem({ id: "b1", priority: 7, sourceFile: "/b.md" }),
		];
		expect(
			sequenceItemsForDailyReading(items, "off").map((item) => item.id),
		).toEqual(["a1", "a2", "b1"]);
	});

	test("soft profile breaks long same-topic runs", () => {
		const items = [
			createItem({ id: "a1", priority: 9, sourceFile: "/a.md" }),
			createItem({ id: "a2", priority: 8, sourceFile: "/a.md" }),
			createItem({ id: "a3", priority: 7, sourceFile: "/a.md" }),
			createItem({ id: "b1", priority: 6, sourceFile: "/b.md" }),
		];
		const sequenced = sequenceItemsForDailyReading(items, "soft", {
			maxConsecutiveSameTopic: 2,
		});
		const runAtIndex2 = sequenced[2]?.sourceFile;
		expect(runAtIndex2).toBe("/b.md");
	});
});
