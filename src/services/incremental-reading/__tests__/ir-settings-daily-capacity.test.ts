import { describe, expect, it } from "vitest";
import { normalizeIncrementalReadingSettings } from "../ir-settings";

describe("normalizeIncrementalReadingSettings daily capacity migration", () => {
	it("keeps explicit dailyReadingPointCap and drops legacy new/review limits", () => {
		const normalized = normalizeIncrementalReadingSettings({
			dailyReadingPointCap: 22,
			dailyNewLimit: 35,
			dailyReviewLimit: 80,
		} as never);

		expect(normalized.dailyReadingPointCap).toBe(22);
		expect(
			Object.prototype.hasOwnProperty.call(normalized, "dailyNewLimit"),
		).toBe(false);
		expect(
			Object.prototype.hasOwnProperty.call(normalized, "dailyReviewLimit"),
		).toBe(false);
	});

	it("migrates customized legacy new limit into dailyReadingPointCap when cap absent", () => {
		const normalized = normalizeIncrementalReadingSettings({
			dailyNewLimit: 30,
		} as never);

		expect(normalized.dailyReadingPointCap).toBe(30);
	});

	it("does not migrate default legacy limits into a custom cap", () => {
		const normalized = normalizeIncrementalReadingSettings({
			dailyNewLimit: 20,
			dailyReviewLimit: 50,
		} as never);

		expect(normalized.dailyReadingPointCap).toBe(15);
	});
});
