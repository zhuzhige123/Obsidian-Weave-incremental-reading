import { describe, expect, it } from "vitest";
import {
	buildParagraphWorkbenchDisplay,
	normalizeParagraphPriorityLevel,
	normalizeParagraphScheduleIntervalDays,
	resolveParagraphPostponeMinutes,
} from "../paragraph-reading-shell";

describe("paragraph-reading-shell", () => {
	it("builds incremental display with segment and book estimates", () => {
		const display = buildParagraphWorkbenchDisplay({
			bookPercent: 42,
			segmentIndex: 2,
			segmentTotal: 10,
			remainingMs: 120_000,
			topicName: "Topic A",
			queueDone: 3,
			queueTotal: 8,
		});

		expect(display.segmentIndex).toBe(3);
		expect(display.segmentTotal).toBe(10);
		expect(display.bookPercent).toBe(42);
		expect(display.estimatedBookMinutes).toBe(2);
		expect(display.topicName).toBe("Topic A");
		expect(display.queueDone).toBe(3);
		expect(display.queueTotal).toBe(8);
	});

	it("resolves postpone minutes from block estimate first", () => {
		const display = buildParagraphWorkbenchDisplay({
			bookPercent: 10,
			segmentIndex: 0,
			segmentTotal: 5,
			remainingMs: 300_000,
		});
		expect(resolveParagraphPostponeMinutes(display)).toBeGreaterThan(0);
	});

	it("normalizes schedule and priority values", () => {
		expect(normalizeParagraphScheduleIntervalDays(14)).toBe(14);
		expect(normalizeParagraphScheduleIntervalDays("bad")).toBe(7);
		expect(normalizeParagraphPriorityLevel(3)).toBe(3);
		expect(normalizeParagraphPriorityLevel("bad")).toBe(2);
	});
});
