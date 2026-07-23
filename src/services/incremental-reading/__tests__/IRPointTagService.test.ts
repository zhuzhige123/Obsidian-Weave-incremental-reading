import type { IRTagGroup } from "../../../types/ir-types";
import {
	normalizeReadingPointTags,
	resolveReadingPointTags,
} from "../IRPointTagService";
import {
	matchTagGroupByTags,
	normalizeTagGroupCandidateTags,
} from "../IRTagGroupService";

describe("normalizeReadingPointTags", () => {
	it("trims tags, preserves first display casing, and deduplicates case-insensitively", () => {
		expect(
			normalizeReadingPointTags([
				"  Research  ",
				"research",
				"Deep Work",
				"",
				"  ",
			]),
		).toEqual(["Research", "Deep Work"]);
	});

	it("strips leading hashtags so storage matches tag-suggest and search keys", () => {
		expect(normalizeReadingPointTags(["#Paper", "#paper", "Paper"])).toEqual([
			"Paper",
		]);
	});
});

describe("resolveReadingPointTags", () => {
	it("prefers unified point userData tags over chunk tags when snapshot exists", async () => {
		const tags = await resolveReadingPointTags({
			materialId: "chunk-abc",
			sourceType: "chunk",
			hasPointSnapshot: true,
			pointUserDataTags: ["from-point"],
			getChunkTags: async () => ["from-chunk"],
		});
		expect(tags).toEqual(["from-point"]);
	});

	it("returns empty when point snapshot exists with no tags and no chunk fallback", async () => {
		const tags = await resolveReadingPointTags({
			materialId: "chunk-abc",
			sourceType: "chunk",
			hasPointSnapshot: true,
			pointUserDataTags: [],
		});
		expect(tags).toEqual([]);
	});

	it("falls back to chunk tags when point snapshot has empty tags (heal pre-fix dual-write)", async () => {
		const tags = await resolveReadingPointTags({
			materialId: "chunk-abc",
			sourceType: "chunk",
			hasPointSnapshot: true,
			pointUserDataTags: [],
			getChunkTags: async () => ["from-chunk"],
		});
		expect(tags).toEqual(["from-chunk"]);
	});

	it("falls back to chunk tags when no point snapshot exists", async () => {
		const tags = await resolveReadingPointTags({
			materialId: "chunk-abc",
			sourceType: "chunk",
			hasPointSnapshot: false,
			getChunkTags: async () => ["from-chunk"],
		});
		expect(tags).toEqual(["from-chunk"]);
	});

	it("reads pdf task tags for pdf bookmark ids", async () => {
		const tags = await resolveReadingPointTags({
			materialId: "pdfbm-test-1",
			pdfTaskTags: ["pdf-tag"],
			hasPointSnapshot: true,
			pointUserDataTags: ["ignored"],
		});
		expect(tags).toEqual(["pdf-tag"]);
	});
});

describe("normalizeTagGroupCandidateTags", () => {
	it("normalizes whitespace, strips leading hashtag, lowercases, and deduplicates", () => {
		expect(
			normalizeTagGroupCandidateTags([
				"  #Paper  ",
				"paper",
				"Topic/A",
				"topic/a",
			]),
		).toEqual(["paper", "topic/a"]);
	});
});

describe("matchTagGroupByTags", () => {
	const groups: Pick<IRTagGroup, "id" | "matchAnyTags" | "matchPriority">[] = [
		{ id: "default", matchAnyTags: [], matchPriority: 999 },
		{ id: "novel", matchAnyTags: ["??", "fiction"], matchPriority: 20 },
		{ id: "paper", matchAnyTags: ["#Paper", "??"], matchPriority: 10 },
	];

	it("matches by reading-point tags instead of document tags and honors priority", () => {
		expect(matchTagGroupByTags(groups, [" fiction ", "Paper"])).toBe("paper");
	});

	it("falls back to default when no reading-point tag matches", () => {
		expect(matchTagGroupByTags(groups, ["weekly", "backlog"])).toBe("default");
	});

	it("supports empty tag sets without false positives", () => {
		expect(matchTagGroupByTags(groups, [])).toBe("default");
	});
});
