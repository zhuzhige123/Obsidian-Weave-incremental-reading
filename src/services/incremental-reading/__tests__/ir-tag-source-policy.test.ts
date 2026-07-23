import {
	DEFAULT_MARKDOWN_TAGS_YAML_KEY,
	LEGACY_MARKDOWN_TAGS_YAML_KEY,
	normalizeIRTagSourcePolicy,
	normalizeMarkdownTagsYamlKey,
	readTagsFromFrontmatterRecord,
	shouldClearLegacyWeaveTagsAfterWrite,
} from "../ir-tag-source-policy";

describe("normalizeMarkdownTagsYamlKey", () => {
	it("defaults empty or invalid keys to safe weave_tags", () => {
		expect(normalizeMarkdownTagsYamlKey("")).toBe(LEGACY_MARKDOWN_TAGS_YAML_KEY);
		expect(normalizeMarkdownTagsYamlKey("bad key")).toBe(
			LEGACY_MARKDOWN_TAGS_YAML_KEY,
		);
		expect(normalizeMarkdownTagsYamlKey("tags:oops")).toBe(
			LEGACY_MARKDOWN_TAGS_YAML_KEY,
		);
	});

	it("accepts Obsidian tags, legacy weave_tags, and custom keys", () => {
		expect(normalizeMarkdownTagsYamlKey("tags")).toBe("tags");
		expect(normalizeMarkdownTagsYamlKey("weave_tags")).toBe(
			LEGACY_MARKDOWN_TAGS_YAML_KEY,
		);
		expect(normalizeMarkdownTagsYamlKey("keywords")).toBe("keywords");
		expect(normalizeMarkdownTagsYamlKey("frontmatter.tags")).toBe("tags");
	});
});

describe("normalizeIRTagSourcePolicy", () => {
	it("defaults to legacy weave_tags for existing-install safety", () => {
		expect(normalizeIRTagSourcePolicy(null)).toEqual({
			markdownYamlKey: LEGACY_MARKDOWN_TAGS_YAML_KEY,
		});
	});

	it("keeps an explicit tags choice", () => {
		expect(normalizeIRTagSourcePolicy({ markdownYamlKey: "tags" })).toEqual({
			markdownYamlKey: DEFAULT_MARKDOWN_TAGS_YAML_KEY,
		});
	});
});

describe("readTagsFromFrontmatterRecord", () => {
	it("reads the configured primary key first", () => {
		expect(
			readTagsFromFrontmatterRecord(
				{ tags: ["Paper", "#Deep"], weave_tags: ["legacy"] },
				"tags",
			),
		).toEqual(["Paper", "Deep"]);
	});

	it("falls back to weave_tags when primary key is empty", () => {
		expect(
			readTagsFromFrontmatterRecord(
				{ tags: [], weave_tags: ["Legacy", "legacy"] },
				"tags",
			),
		).toEqual(["Legacy"]);
	});

	it("does not fall back when primary key is already weave_tags", () => {
		expect(
			readTagsFromFrontmatterRecord({ weave_tags: [] }, "weave_tags"),
		).toEqual([]);
	});

	it("supports comma-separated string values", () => {
		expect(
			readTagsFromFrontmatterRecord({ keywords: "a, #b, a" }, "keywords"),
		).toEqual(["a", "b"]);
	});
});

describe("shouldClearLegacyWeaveTagsAfterWrite", () => {
	it("never clears when writing weave_tags itself", () => {
		expect(
			shouldClearLegacyWeaveTagsAfterWrite({
				primaryKey: "weave_tags",
				writtenTags: ["a"],
				legacyTags: ["a"],
			}),
		).toBe(false);
	});

	it("clears when legacy is empty", () => {
		expect(
			shouldClearLegacyWeaveTagsAfterWrite({
				primaryKey: "tags",
				writtenTags: ["paper"],
				legacyTags: [],
			}),
		).toBe(true);
	});

	it("clears when legacy equals written tags", () => {
		expect(
			shouldClearLegacyWeaveTagsAfterWrite({
				primaryKey: "tags",
				writtenTags: ["Paper"],
				legacyTags: ["paper"],
			}),
		).toBe(true);
	});

	it("keeps divergent weave_tags when writing Obsidian tags", () => {
		expect(
			shouldClearLegacyWeaveTagsAfterWrite({
				primaryKey: "tags",
				writtenTags: ["graph-tag"],
				legacyTags: ["ir-only"],
			}),
		).toBe(false);
	});
});
