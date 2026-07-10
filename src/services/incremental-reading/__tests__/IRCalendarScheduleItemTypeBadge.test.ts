import { describe, expect, it } from "vitest";
import type { ScheduleItem } from "../IRCalendarScheduleItem";
import {
	matchesScheduleItemTypeSearch,
	normalizeScheduleItemTypeSearchToken,
	resolveScheduleItemTypeBadge,
	resolveScheduleItemTypeIcon,
} from "../IRCalendarScheduleItemTypeBadge";

function makeMaterial(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
	return {
		id: "point-1",
		title: "Test",
		sourceFile: "Notes/Test.md",
		priority: 5,
		intervalDays: 1,
		scheduleStatus: "new",
		nextRepDate: 0,
		nextReviewDate: null,
		...overrides,
	};
}

describe("resolveScheduleItemTypeBadge", () => {
	it("detects web reading points as link", () => {
		const app = {
			metadataCache: {
				getCache: () => ({
					frontmatter: { "weave-ir-web-url": "https://example.com/article" },
				}),
			},
		} as any;

		expect(
			resolveScheduleItemTypeBadge(
				app,
				makeMaterial({ sourceFile: "IR/Web Point.md" }),
			),
		).toBe("link");
	});

	it("detects pdf, epub, canvas, and md from source paths", () => {
		const app = { metadataCache: { getCache: () => null } } as any;

		expect(
			resolveScheduleItemTypeBadge(
				app,
				makeMaterial({
					id: "pdf-task:1",
					sourceType: "pdf",
					sourceFile: "Books/A.pdf",
				}),
			),
		).toBe("pdf");
		expect(
			resolveScheduleItemTypeBadge(
				app,
				makeMaterial({
					id: "epubbm-1",
					sourceType: "epub",
					sourceFile: "Books/A.epub",
				}),
			),
		).toBe("epub");
		expect(
			resolveScheduleItemTypeBadge(
				app,
				makeMaterial({ sourceFile: "Maps/Topic.canvas" }),
			),
		).toBe("canvas");
		expect(
			resolveScheduleItemTypeBadge(
				app,
				makeMaterial({ sourceFile: "Notes/Topic.md" }),
			),
		).toBe("md");
	});

	it("maps type badges to Obsidian icons", () => {
		expect(resolveScheduleItemTypeIcon("canvas")).toBe("layout-grid");
		expect(resolveScheduleItemTypeIcon("epub")).toBe("book-open");
		expect(resolveScheduleItemTypeIcon("pdf")).toBe("file");
		expect(resolveScheduleItemTypeIcon("md")).toBe("file-text");
		expect(resolveScheduleItemTypeIcon("link")).toBe("globe");
	});

	it("normalizes reading point type search aliases", () => {
		expect(normalizeScheduleItemTypeSearchToken("markdown")).toBe("md");
		expect(normalizeScheduleItemTypeSearchToken("web")).toBe("link");
		expect(normalizeScheduleItemTypeSearchToken("链接")).toBe("link");
		expect(normalizeScheduleItemTypeSearchToken("unknown")).toBeNull();
	});

	it("matches schedule items by type search tokens", () => {
		const app = { metadataCache: { getCache: () => null } } as any;
		const mdMaterial = makeMaterial({ sourceFile: "Notes/Topic.md" });
		const pdfMaterial = makeMaterial({
			id: "pdf-task:1",
			sourceType: "pdf",
			sourceFile: "Books/A.pdf",
		});

		expect(matchesScheduleItemTypeSearch(app, mdMaterial, ["md"], [])).toBe(
			true,
		);
		expect(matchesScheduleItemTypeSearch(app, mdMaterial, ["pdf"], [])).toBe(
			false,
		);
		expect(matchesScheduleItemTypeSearch(app, pdfMaterial, ["pdf"], [])).toBe(
			true,
		);
		expect(matchesScheduleItemTypeSearch(app, pdfMaterial, [], ["pdf"])).toBe(
			false,
		);
		expect(
			matchesScheduleItemTypeSearch(app, mdMaterial, ["markdown", "pdf"], []),
		).toBe(true);
	});
});
