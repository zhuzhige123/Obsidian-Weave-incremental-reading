import { describe, expect, it } from "vitest";
import {
	matchTagGroupByTags,
	normalizeTagGroupCandidateTags,
} from "../ir-tag-group-match";

describe("ir-tag-group-match", () => {
	it("normalizes tags and matches lowest matchPriority first", () => {
		expect(
			normalizeTagGroupCandidateTags([" #Paper ", "paper", "Fiction"]),
		).toEqual(["paper", "fiction"]);

		const groups = [
			{ id: "default", matchAnyTags: [], matchPriority: 0 },
			{ id: "paper", matchAnyTags: ["paper"], matchPriority: 10 },
			{ id: "fiction", matchAnyTags: ["fiction"], matchPriority: 20 },
		];
		expect(matchTagGroupByTags(groups, ["fiction", "paper"])).toBe("paper");
		expect(matchTagGroupByTags(groups, ["fiction"])).toBe("fiction");
		expect(matchTagGroupByTags(groups, [])).toBe("default");
	});
});
