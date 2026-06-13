import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	addScheduleDays,
	assessReadingTargetDayLoad,
	computeReadingTargetDayLoadLevel,
	formatLocalDateKey,
	getNextMonday,
	getScheduleToday,
	getScheduleTomorrow,
	normalizeScheduleDate,
	parseLocalDateKey,
	recommendReadingTargetScheduleDate,
	resolveReadingTargetSchedulePin,
	toDateInputValue,
} from "../IRReadingTargetScheduleDate";
import { getProjectedScheduleSummary } from "../../IRProjectedScheduleSummary";

vi.mock("../../IRProjectedScheduleSummary", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../IRProjectedScheduleSummary")>();
	return {
		...actual,
		getProjectedScheduleSummary: vi.fn(),
	};
});

describe("IRReadingTargetScheduleDate", () => {
	it("normalizes schedule dates to local midnight", () => {
		const date = new Date(2026, 5, 13, 15, 30, 0);
		const normalized = normalizeScheduleDate(date);
		expect(normalized.getHours()).toBe(0);
		expect(normalized.getMinutes()).toBe(0);
		expect(formatLocalDateKey(normalized)).toBe("2026-06-13");
	});

	it("adds schedule days without drifting timezone", () => {
		const start = parseLocalDateKey("2026-06-13");
		expect(start).not.toBeNull();
		const next = addScheduleDays(start!, 2);
		expect(formatLocalDateKey(next)).toBe("2026-06-15");
	});

	it("resolves next Monday from Friday", () => {
		const friday = parseLocalDateKey("2026-06-12");
		expect(friday).not.toBeNull();
		const monday = getNextMonday(friday!);
		expect(formatLocalDateKey(monday)).toBe("2026-06-15");
	});

	it("resolves next Monday from Monday as the following week", () => {
		const monday = parseLocalDateKey("2026-06-15");
		expect(monday).not.toBeNull();
		const nextMonday = getNextMonday(monday!);
		expect(formatLocalDateKey(nextMonday)).toBe("2026-06-22");
	});

	it("builds schedule pin with date key and timestamp", () => {
		const pin = resolveReadingTargetSchedulePin(parseLocalDateKey("2026-06-13")!);
		expect(pin.dateKey).toBe("2026-06-13");
		expect(pin.nextRepDate).toBe(parseLocalDateKey("2026-06-13")!.getTime());
	});

	it("assesses overload levels against budget", () => {
		expect(computeReadingTargetDayLoadLevel(20, 45)).toBe("normal");
		expect(computeReadingTargetDayLoadLevel(42, 45)).toBe("warning");
		expect(computeReadingTargetDayLoadLevel(60, 45)).toBe("overloaded");
	});

	it("formats date input values", () => {
		const today = getScheduleToday();
		expect(toDateInputValue(today)).toBe(formatLocalDateKey(today));
		expect(getScheduleTomorrow(today).getTime()).toBeGreaterThan(today.getTime());
	});

	it("assesses projected day load snapshot", () => {
		const assessment = assessReadingTargetDayLoad("2026-06-13", {
			dateKey: "2026-06-13",
			items: [],
			totalEstimatedMinutes: 65,
		}, 45);
		expect(assessment.level).toBe("overloaded");
		expect(assessment.itemCount).toBe(0);
	});

	beforeEach(() => {
		vi.mocked(getProjectedScheduleSummary).mockReset();
	});

	it("recommends a lighter day when today is overloaded", async () => {
		const start = parseLocalDateKey("2026-06-12");
		expect(start).not.toBeNull();
		const dayLoads = new Map([
			[
				"2026-06-12",
				{
					dateKey: "2026-06-12",
					items: [{ id: "a" }],
					totalEstimatedMinutes: 70,
				},
			],
			[
				"2026-06-13",
				{
					dateKey: "2026-06-13",
					items: [],
					totalEstimatedMinutes: 10,
				},
			],
		]);
		vi.mocked(getProjectedScheduleSummary).mockResolvedValue({
			schedule: { days: [] },
			dayLoadsByDate: dayLoads,
			dayLoadsByDeckId: new Map([["deck-1", dayLoads]]),
		});

		const recommendation = await recommendReadingTargetScheduleDate({} as never, "deck-1", 45, {
			startDate: start!,
			horizonDays: 3,
			estimatedMinutesForNewItem: 5,
		});

		expect(recommendation.dateKey).not.toBe("2026-06-12");
		expect(recommendation.loadRatioPercent).toBeLessThan(50);
	});
});
