import { describe, expect, it } from "vitest";
import {
	deriveAffectedDateKeysFromPlannedItems,
	mergePriorityDateKeys,
	toCalendarMonthKey,
} from "../IRCalendarProjectionUtils";

describe("IRCalendarProjectionUtils", () => {
	it("extracts month key from date key", () => {
		expect(toCalendarMonthKey("2026-05-29")).toBe("2026-05");
	});

	it("merges priority date keys uniquely", () => {
		expect(
			mergePriorityDateKeys(["2026-05-29", "2026-05-29"], ["2026-05-30"]),
		).toEqual(["2026-05-29", "2026-05-30"]);
	});

	it("derives affected date keys from rep timestamps and previous keys", () => {
		const keys = deriveAffectedDateKeysFromPlannedItems(
			[
				{
					id: "a",
					nextRepDate: new Date("2026-06-02T12:00:00").getTime(),
				},
			],
			{
				previousDateKeys: ["2026-05-29"],
				anchorDateKey: "2026-05-28",
			},
		);
		expect(keys).toContain("2026-05-29");
		expect(keys).toContain("2026-06-02");
		expect(keys).toContain("2026-05-28");
	});
});
