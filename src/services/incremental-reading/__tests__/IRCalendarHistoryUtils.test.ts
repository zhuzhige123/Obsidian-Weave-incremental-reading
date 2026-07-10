import { describe, expect, it } from "vitest";
import {
	buildHistoryDaySummaries,
	buildPastDateCompletionCounts,
	isPastCalendarDate,
	isPastCalendarDateKey,
	parseCalendarDateKey,
} from "../IRCalendarHistoryUtils";

describe("IRCalendarHistoryUtils", () => {
	const today = new Date(2026, 5, 26);

	it("detects past calendar dates", () => {
		expect(isPastCalendarDate(new Date(2026, 5, 25), today)).toBe(true);
		expect(isPastCalendarDate(new Date(2026, 5, 26), today)).toBe(false);
		expect(isPastCalendarDate(new Date(2026, 5, 27), today)).toBe(false);
		expect(isPastCalendarDateKey("2026-06-25", today)).toBe(true);
		expect(isPastCalendarDateKey("2026-06-26", today)).toBe(false);
	});

	it("parses valid date keys at local midnight", () => {
		const parsed = parseCalendarDateKey("2026-06-25");
		expect(parsed?.getFullYear()).toBe(2026);
		expect(parsed?.getMonth()).toBe(5);
		expect(parsed?.getDate()).toBe(25);
		expect(parsed?.getHours()).toBe(0);
	});

	it("builds past completion counts scoped to month", () => {
		const byDate = {
			"2026-06-20": ["a", "b"],
			"2026-06-26": ["today"],
			"2026-07-01": ["future-month"],
			"2026-05-30": ["old"],
		};
		const counts = buildPastDateCompletionCounts(byDate, {
			monthKey: "2026-06",
			today,
		});
		expect(counts.get("2026-06-20")).toBe(2);
		expect(counts.has("2026-06-26")).toBe(false);
		expect(counts.has("2026-07-01")).toBe(false);
		expect(counts.has("2026-05-30")).toBe(false);
	});

	it("builds history summaries with completed counts only", () => {
		const summaries = buildHistoryDaySummaries(
			{ "2026-06-20": ["a", "a", "b"] },
			{ today },
		);
		expect(summaries.get("2026-06-20")).toEqual({
			totalCount: 2,
			completedCount: 2,
		});
	});
});
