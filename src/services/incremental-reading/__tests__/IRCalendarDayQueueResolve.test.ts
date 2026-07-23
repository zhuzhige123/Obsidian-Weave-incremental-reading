import { describe, expect, it } from "vitest";
import type { ScheduleItem } from "../IRCalendarScheduleItem";
import {
	dayQueueHasPendingCoverage,
	resolveDayQueueForDisplay,
	resolveDayQueueFromDateMaps,
	resolvePinnedRoleForDateKey,
	selectPinnedItemsForDayQueue,
} from "../IRCalendarDayQueueResolve";
import { isPastCalendarDateKey } from "../IRCalendarHistoryUtils";

function item(id: string, priority = 5): ScheduleItem {
	return {
		id,
		title: id,
		priority,
		nextRepDate: 0,
		explanation: {
			manualPriority: priority,
			effectivePriority: priority,
		},
	} as ScheduleItem;
}

describe("resolveDayQueueForDisplay", () => {
	it("keeps pending items when one id is completed (full day queue)", () => {
		const queue = resolveDayQueueForDisplay({
			dateKey: "2026-07-16",
			materials: [item("a", 2), item("b", 1), item("c", 3)],
			pinned: [item("b", 1)],
			completedIds: ["b"],
			pinnedRole: "ignore",
		});
		// ignore pinned：materials 已含全日队列
		expect(queue.map((entry) => entry.id)).toEqual(["c", "a", "b"]);
	});

	it("active ignore role does not let pinned-only completed mask a wiped materials list as intentional", () => {
		const queue = resolveDayQueueForDisplay({
			dateKey: "2026-07-16",
			materials: [],
			pinned: [item("done-1")],
			completedIds: ["done-1"],
			pinnedRole: "ignore",
		});
		expect(queue).toEqual([]);
	});

	it("completed_gapfill only adds missing completed entities", () => {
		const queue = resolveDayQueueForDisplay({
			dateKey: "2026-07-16",
			materials: [item("pending-1"), item("pending-2")],
			pinned: [item("done-1"), item("pending-ghost")],
			completedIds: ["done-1"],
			pinnedRole: "completed_gapfill",
		});
		expect(queue.map((entry) => entry.id)).toEqual([
			"pending-1",
			"pending-2",
			"done-1",
		]);
	});

	it("history merge keeps pinned completed when materials empty", () => {
		const queue = resolveDayQueueForDisplay({
			dateKey: "2026-07-10",
			materials: [],
			pinned: [item("done-1"), item("done-2")],
			completedIds: ["done-1", "done-2"],
			pinnedRole: "merge",
		});
		expect(queue.map((entry) => entry.id)).toEqual(["done-1", "done-2"]);
	});

	it("applies itemOverrides over materials", () => {
		const queue = resolveDayQueueForDisplay({
			dateKey: "2026-07-16",
			materials: [item("a", 5)],
			pinned: [],
			completedIds: [],
			pinnedRole: "ignore",
			itemOverrides: new Map([["a", { ...item("a", 1), title: "over" }]]),
		});
		expect(queue).toHaveLength(1);
		expect(queue[0]?.title).toBe("over");
		expect(queue[0]?.priority).toBe(1);
	});

	it("resolveDayQueueFromDateMaps applies deck filter", () => {
		const materialsByDate = new Map([
			[
				"2026-07-16",
				[
					{ ...item("a"), deckId: "deck-a" },
					{ ...item("b"), deckId: "deck-b" },
				],
			],
		]);
		const pinnedByDate = new Map<string, ScheduleItem[]>();
		const queue = resolveDayQueueFromDateMaps({
			dateKey: "2026-07-16",
			materialsByDate,
			pinnedByDate,
			completedIdsByDate: {},
			pinnedRole: "ignore",
			itemFilter: (entry) => entry.deckId === "deck-a",
		});
		expect(queue.map((entry) => entry.id)).toEqual(["a"]);
	});
});

describe("selectPinnedItemsForDayQueue / resolvePinnedRoleForDateKey", () => {
	it("maps past dates to merge and active dates to ignore", () => {
		const today = new Date(2026, 6, 16);
		expect(
			resolvePinnedRoleForDateKey("2026-07-15", today, isPastCalendarDateKey),
		).toBe("merge");
		expect(
			resolvePinnedRoleForDateKey("2026-07-16", today, isPastCalendarDateKey),
		).toBe("ignore");
	});

	it("gapfill filters pinned to missing completed only", () => {
		const selected = selectPinnedItemsForDayQueue({
			materials: [item("a")],
			pinned: [item("a"), item("done-1"), item("extra")],
			completedIds: ["done-1"],
			pinnedRole: "completed_gapfill",
		});
		expect(selected.map((entry) => entry.id)).toEqual(["done-1"]);
	});
});

describe("dayQueueHasPendingCoverage", () => {
	it("detects missing pending after incomplete reconcile", () => {
		expect(
			dayQueueHasPendingCoverage({
				queue: [item("done-1")],
				baselinePendingIds: ["pending-1", "pending-2"],
				completedIds: ["done-1"],
			}),
		).toBe(false);
		expect(
			dayQueueHasPendingCoverage({
				queue: [item("pending-1"), item("pending-2"), item("done-1")],
				baselinePendingIds: ["pending-1", "pending-2"],
				completedIds: ["done-1"],
			}),
		).toBe(true);
	});
});
