import { describe, expect, it } from "vitest";
import type { ScheduleItem } from "../IRCalendarScheduleItem";
import {
	buildWebReadingPointMarkdown,
	deriveWebPageTitleFromUrl,
	resolveScheduleItemWebUrl,
} from "../ir-web-reading-point";

describe("ir-web-reading-point", () => {
	it("derives a readable title from URL host and path", () => {
		expect(
			deriveWebPageTitleFromUrl("https://www.example.com/docs/guide"),
		).toBe("example.com/docs/guide");
	});

	it("prefers resumeLink when it is an http(s) URL", () => {
		const app = {
			metadataCache: {
				getCache: () => null,
			},
		} as any;
		const material = {
			resumeLink: "https://obsidian.md/blog",
			sourceFile: "weave/incremental-reading/IR/page.md",
		} as ScheduleItem;

		expect(resolveScheduleItemWebUrl(app, material)).toBe(
			"https://obsidian.md/blog",
		);
	});

	it("falls back to weave-ir-web-url frontmatter", () => {
		const app = {
			metadataCache: {
				getCache: (path: string) =>
					path === "weave/incremental-reading/IR/page.md"
						? {
								frontmatter: {
									"weave-ir-web-url": "https://example.org/article",
								},
						  }
						: null,
			},
		} as any;
		const material = {
			resumeLink: "[[weave/incremental-reading/IR/page]]",
			sourceFile: "weave/incremental-reading/IR/page.md",
		} as ScheduleItem;

		expect(resolveScheduleItemWebUrl(app, material)).toBe(
			"https://example.org/article",
		);
	});

	it("builds markdown with selected excerpt section", () => {
		const markdown = buildWebReadingPointMarkdown(
			"Article",
			"https://example.com/post",
			{
				selectedText: "Important quote",
			},
		);
		expect(markdown).toContain("## 选区摘录");
		expect(markdown).toContain("Important quote");
	});
});
