import { describe, expect, it } from "vitest";
import type { ScheduleItem } from "../IRCalendarScheduleItem";
import {
	incomingMissesExistingIds,
	isStrictIdSubsetOfExisting,
	mergeDayQueueItemsById,
	mergeMaterialsByDateMaps,
} from "../IRCalendarDayQueueMerge";

function item(id: string): ScheduleItem {
	return { id, title: id } as ScheduleItem;
}

describe("IRCalendarDayQueueMerge", () => {
	it("detects strict id subsets", () => {
		expect(
			isStrictIdSubsetOfExisting([item("a"), item("b"), item("c")], [item("a")]),
		).toBe(true);
		expect(
			isStrictIdSubsetOfExisting([item("a"), item("b")], [item("a"), item("c")]),
		).toBe(false);
		expect(isStrictIdSubsetOfExisting([item("a")], [item("a")])).toBe(false);
	});

	it("detects incoming missing existing ids including overlapping sets", () => {
		expect(
			incomingMissesExistingIds(
				[item("a"), item("b"), item("c")],
				[item("a"), item("c"), item("e")],
			),
		).toBe(true);
		expect(
			incomingMissesExistingIds([item("a"), item("b")], [item("a"), item("b")]),
		).toBe(false);
		expect(
			incomingMissesExistingIds(
				[item("a"), item("b")],
				[item("a"), item("b"), item("c")],
			),
		).toBe(false);
	});

	it("merges by id without dropping existing pending items", () => {
		const merged = mergeDayQueueItemsById(
			[item("a"), item("b"), item("c")],
			[{ ...item("b"), title: "B2" }],
		);
		expect(merged.map((entry) => entry.id).sort()).toEqual(["a", "b", "c"]);
		expect(merged.find((entry) => entry.id === "b")?.title).toBe("B2");
	});

	it("protectAgainstShrink refuses empty force-replace wipe", () => {
		const base = new Map([["2026-07-16", [item("a"), item("b"), item("c")]]]);
		const updates = new Map([["2026-07-16", [] as ScheduleItem[]]]);
		const merged = mergeMaterialsByDateMaps(base, updates, {
			forceReplaceDateKeys: ["2026-07-16"],
			protectAgainstShrink: true,
		});
		expect(merged.get("2026-07-16")).toHaveLength(3);
	});

	it("protectAgainstShrink id-merges strict subset force-replace", () => {
		const base = new Map([
			["2026-07-16", [item("pending-1"), item("pending-2"), item("done-1")]],
		]);
		const updates = new Map([["2026-07-16", [item("pending-1")]]]);
		const merged = mergeMaterialsByDateMaps(base, updates, {
			forceReplaceDateKeys: ["2026-07-16"],
			protectAgainstShrink: true,
			completedIdsByDate: { "2026-07-16": ["done-1"] },
		});
		const queue = merged.get("2026-07-16") || [];
		const ids = collectIds(queue);
		expect(ids.has("pending-1")).toBe(true);
		expect(ids.has("pending-2")).toBe(true);
		expect(ids.has("done-1")).toBe(true);
		expect(queue[queue.length - 1]?.id).toBe("done-1");
	});

	it("protectAgainstShrink id-merges overlapping non-subset force-replace", () => {
		const base = new Map([
			[
				"2026-07-16",
				[item("pending-1"), item("pending-2"), item("done-1"), item("done-2")],
			],
		]);
		// committed-due 交叉集：缺 pending-2/done-2，多出 overdue-new
		const updates = new Map([
			["2026-07-16", [item("pending-1"), item("done-1"), item("overdue-new")]],
		]);
		const merged = mergeMaterialsByDateMaps(base, updates, {
			forceReplaceDateKeys: ["2026-07-16"],
			protectAgainstShrink: true,
			completedIdsByDate: { "2026-07-16": ["done-1", "done-2"] },
		});
		const queue = merged.get("2026-07-16") || [];
		const ids = collectIds(queue);
		expect(ids.has("pending-1")).toBe(true);
		expect(ids.has("pending-2")).toBe(true);
		expect(ids.has("done-1")).toBe(true);
		expect(ids.has("done-2")).toBe(true);
		expect(ids.has("overdue-new")).toBe(true);
		expect(queue.slice(-2).map((entry) => entry.id)).toEqual([
			"done-1",
			"done-2",
		]);
	});

	it("protectAgainstShrink allows replace when incoming covers all existing ids", () => {
		const base = new Map([["2026-07-16", [item("a"), item("b")]]]);
		const updates = new Map([
			["2026-07-16", [item("a"), item("b"), item("c")]],
		]);
		const merged = mergeMaterialsByDateMaps(base, updates, {
			forceReplaceDateKeys: ["2026-07-16"],
			protectAgainstShrink: true,
		});
		expect(collectIds(merged.get("2026-07-16") || [])).toEqual(
			new Set(["a", "b", "c"]),
		);
	});

	it("without protect, force-replace empty still wipes (legacy)", () => {
		const base = new Map([["2026-07-16", [item("a")]]]);
		const updates = new Map([["2026-07-16", [] as ScheduleItem[]]]);
		const merged = mergeMaterialsByDateMaps(base, updates, {
			forceReplaceDateKeys: ["2026-07-16"],
		});
		expect(merged.get("2026-07-16")).toEqual([]);
	});
});

function collectIds(items: ScheduleItem[]): Set<string> {
	return new Set(items.map((entry) => entry.id));
}
