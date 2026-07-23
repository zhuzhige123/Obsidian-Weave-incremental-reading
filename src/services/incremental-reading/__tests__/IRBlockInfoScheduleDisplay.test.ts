import { describe, expect, it } from "vitest";
import {
	buildIRBlockInfoScheduleDisplay,
	hasCompletedReadingPoint,
} from "../IRBlockInfoScheduleDisplay";

describe("IRBlockInfoScheduleDisplay", () => {
	it("treats reviewCount or lastReview as completed", () => {
		expect(hasCompletedReadingPoint({ reviewCount: 0 })).toBe(false);
		expect(hasCompletedReadingPoint({ reviewCount: 1 })).toBe(true);
		expect(
			hasCompletedReadingPoint({
				reviewCount: 0,
				lastReview: "2026-07-01T00:00:00.000Z",
			}),
		).toBe(true);
	});

	it("marks next review pending before first completion and exposes first schedule", () => {
		const display = buildIRBlockInfoScheduleDisplay(
			{
				nextRepDate: Date.parse("2026-07-20T00:00:00"),
				scheduleStatus: "queued",
				reviewCount: 0,
			},
			"2026-07-14",
		);

		expect(display.hasCompletedReview).toBe(false);
		expect(display.nextReviewPending).toBe(true);
		expect(display.nextReviewTimestamp).toBeNull();
		expect(display.firstScheduleTimestamp).toBe(
			Date.parse("2026-07-20T00:00:00"),
		);
		expect(display.listAppearDateKey).toBe("2026-07-20");
		expect(display.rolledIntoToday).toBe(false);
	});

	it("rolls overdue committed due into today for list appear day", () => {
		const display = buildIRBlockInfoScheduleDisplay(
			{
				nextRepDate: Date.parse("2026-07-10T00:00:00"),
				scheduleStatus: "queued",
				reviewCount: 2,
			},
			"2026-07-14",
		);

		expect(display.committedDateKey).toBe("2026-07-10");
		expect(display.listAppearDateKey).toBe("2026-07-14");
		expect(display.rolledIntoToday).toBe(true);
		expect(display.rolledFromDateKey).toBe("2026-07-10");
		expect(display.nextReviewOverdue).toBe(true);
		expect(display.nextReviewTimestamp).toBe(
			Date.parse("2026-07-10T00:00:00"),
		);
		expect(display.nextReviewPending).toBe(false);
	});

	it("prefers overdue disk due over past pin for rolled-from hint", () => {
		const display = buildIRBlockInfoScheduleDisplay(
			{
				nextRepDate: Date.parse("2026-07-19T00:00:00"),
				scheduleStatus: "queued",
				reviewCount: 1,
				sourceSequenceLocked: true,
				sourceSequenceAnchorDateKey: "2026-04-30",
			},
			"2026-07-23",
		);

		expect(display.listAppearDateKey).toBe("2026-07-23");
		expect(display.committedDateKey).toBe("2026-04-30");
		expect(display.rolledIntoToday).toBe(true);
		expect(display.rolledFromDateKey).toBe("2026-07-19");
		expect(display.scheduleAnchorDateKey).toBe("2026-04-30");
		expect(display.nextReviewOverdue).toBe(true);
		expect(display.nextReviewTimestamp).toBe(
			Date.parse("2026-07-19T00:00:00"),
		);
	});

	it("prefers sequence anchor for list appear when locked, even if nextRep is later", () => {
		const display = buildIRBlockInfoScheduleDisplay(
			{
				nextRepDate: Date.parse("2026-07-20T00:00:00"),
				scheduleStatus: "queued",
				reviewCount: 0,
				sourceSequenceLocked: true,
				sourceSequenceAnchorDateKey: "2026-07-14",
			},
			"2026-07-14",
		);

		expect(display.committedDateKey).toBe("2026-07-14");
		expect(display.listAppearDateKey).toBe("2026-07-14");
		expect(display.scheduleAnchorDateKey).toBeNull();
		expect(display.firstScheduleTimestamp).toBe(
			Date.parse("2026-07-20T00:00:00"),
		);
		expect(display.nextReviewPending).toBe(true);
	});

	it("prefers manual pin over nextRep for list appear day", () => {
		const display = buildIRBlockInfoScheduleDisplay(
			{
				nextRepDate: Date.parse("2026-07-20T00:00:00"),
				scheduleStatus: "queued",
				reviewCount: 1,
				manualSchedulePinnedDateKey: "2026-07-18",
			},
			"2026-07-14",
		);

		expect(display.listAppearDateKey).toBe("2026-07-18");
		expect(display.committedDateKey).toBe("2026-07-18");
		expect(display.scheduleAnchorDateKey).toBeNull();
		expect(display.nextReviewTimestamp).toBe(
			Date.parse("2026-07-20T00:00:00"),
		);
	});
});
