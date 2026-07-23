import { describe, expect, it } from "vitest";
import { mergeSearchAvailableTags } from "../ir-calendar-search-tags";

describe("mergeSearchAvailableTags", () => {
	it("uses catalog tags even when material tag map is empty (search cancel race)", () => {
		expect(mergeSearchAvailableTags(["测试标签", "alpha"], {})).toEqual(
			expect.arrayContaining(["测试标签", "alpha"]),
		);
		expect(mergeSearchAvailableTags(["测试标签", "alpha"], {})).toHaveLength(2);
	});

	it("unions catalog and per-material tags without duplicates", () => {
		expect(
			mergeSearchAvailableTags(["alpha"], {
				a: ["alpha", "beta"],
				b: ["gamma"],
			}),
		).toEqual(["alpha", "beta", "gamma"]);
	});
});
