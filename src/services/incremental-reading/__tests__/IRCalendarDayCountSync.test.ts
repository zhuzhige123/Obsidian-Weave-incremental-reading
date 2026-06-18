import type { ScheduleItem } from "../IRCalendarScheduleItem";
import {
	buildVisibleDayCountsByDate,
	mergeCalendarDayCountMaps,
} from "../IRCalendarDayCountSync";

function item(id: string, deckId = "deck-a"): ScheduleItem {
	return {
		id,
		deckId,
		sourceType: "chunk-entry",
		sourceFile: "note.md",
		nextRepDate: 0,
		priority: 5,
	} as ScheduleItem;
}

describe("IRCalendarDayCountSync", () => {
	it("builds counts from materials and pinned maps with deck filter", () => {
		const materialsByDate = new Map<string, ScheduleItem[]>([
			["2026-06-18", [item("a"), item("b", "deck-b")]],
		]);
		const pinnedByDate = new Map<string, ScheduleItem[]>([
			["2026-06-18", [item("c")]],
		]);

		const counts = buildVisibleDayCountsByDate(
			materialsByDate,
			pinnedByDate,
			(material) => material.deckId === "deck-a"
		);

		expect(counts.get("2026-06-18")).toBe(2);
	});

	it("merges day count maps without dropping unrelated dates", () => {
		const merged = mergeCalendarDayCountMaps(
			new Map([
				["2026-06-17", 3],
				["2026-06-18", 5],
			]),
			new Map([["2026-06-18", 2]])
		);

		expect(merged.get("2026-06-17")).toBe(3);
		expect(merged.get("2026-06-18")).toBe(2);
	});
});
