import { describe, expect, it } from "vitest";
import {
	buildMonthCalendarDays,
	formatCalendarDateKey,
	getIRCalendarDisplayDays,
	resolveIRCalendarViewMode,
	toCalendarDateKey,
} from "../ir-calendar-date";

describe("resolveIRCalendarViewMode", () => {
	it("accepts supported modes and falls back otherwise", () => {
		expect(resolveIRCalendarViewMode("one-row")).toBe("one-row");
		expect(resolveIRCalendarViewMode("two-row")).toBe("two-row");
		expect(resolveIRCalendarViewMode("full")).toBe("full");
		expect(resolveIRCalendarViewMode("legacy")).toBe("full");
		expect(resolveIRCalendarViewMode(undefined, "two-row")).toBe("two-row");
	});
});

describe("getIRCalendarDisplayDays", () => {
	const currentDate = new Date(2026, 6, 1);
	const today = new Date(2026, 6, 14);
	const selectedDate = new Date(2026, 6, 18);
	const days = buildMonthCalendarDays(2026, 6);

	it("returns the full strip for full and one-row modes", () => {
		expect(
			getIRCalendarDisplayDays({
				days,
				viewMode: "full",
				currentDate,
				today,
				selectedDate,
			}),
		).toHaveLength(42);
		expect(
			getIRCalendarDisplayDays({
				days,
				viewMode: "one-row",
				currentDate,
				today,
				selectedDate,
			}),
		).toHaveLength(42);
	});

	it("returns a two-row window anchored around today in the current month", () => {
		const visible = getIRCalendarDisplayDays({
			days,
			viewMode: "two-row",
			currentDate,
			today,
			selectedDate,
		});
		expect(visible).toHaveLength(14);
		expect(visible[0].date.getDate()).toBe(13);
		expect(visible[13].date.getDate()).toBe(26);
	});
});

describe("toCalendarDateKey", () => {
	it("formats local calendar days from Date and ms timestamps", () => {
		const local = new Date(2026, 6, 16, 23, 30, 0);
		expect(toCalendarDateKey(local)).toBe("2026-07-16");
		expect(toCalendarDateKey(local.getTime())).toBe("2026-07-16");
		expect(formatCalendarDateKey(local)).toBe("2026-07-16");
	});

	it("converts timed ISO strings via local calendar day", () => {
		expect(toCalendarDateKey("2026-07-16")).toBe("2026-07-16");
		const localFromUtc = toCalendarDateKey("2026-07-15T16:00:00.000Z");
		expect(localFromUtc).toBe(
			formatCalendarDateKey(new Date("2026-07-15T16:00:00.000Z")),
		);
	});

	it("returns empty for invalid values", () => {
		expect(toCalendarDateKey(0)).toBe("");
		expect(toCalendarDateKey("")).toBe("");
		expect(toCalendarDateKey(null)).toBe("");
		expect(toCalendarDateKey("not-a-date")).toBe("");
	});
});
