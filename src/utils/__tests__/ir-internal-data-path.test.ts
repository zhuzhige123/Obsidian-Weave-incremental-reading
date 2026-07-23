import { describe, expect, it } from "vitest";
import {
	basenameWithoutExtension,
	isIRDeckFilePath,
	isIRDeckGhostLabel,
	isIRDeckGhostPoint,
	isIRInternalScheduleSourcePath,
	isValidUserReadingSourcePathShape,
	sanitizeUserReadingSourcePath,
	shouldExcludeScheduleItemBySource,
} from "../ir-internal-data-path";

describe("ir-internal-data-path", () => {
	it("detects .irdeck paths case-insensitively", () => {
		expect(
			isIRDeckFilePath("weave Incremental reading/points/pdf.irdeck"),
		).toBe(true);
		expect(isIRDeckFilePath("Topics/游戏化思维.IRDECK")).toBe(true);
		expect(isIRDeckFilePath("Notes/article.md")).toBe(false);
	});

	it("treats irdeck as internal schedule source", () => {
		expect(isIRInternalScheduleSourcePath("points/topic.irdeck")).toBe(true);
		expect(isIRInternalScheduleSourcePath("Books/paper.pdf")).toBe(false);
	});

	it("sanitizes internal paths to empty", () => {
		expect(
			sanitizeUserReadingSourcePath(
				"weave Incremental reading/points/pdf.irdeck",
			),
		).toBe("");
		expect(sanitizeUserReadingSourcePath("Docs/Note.md")).toBe("Docs/Note.md");
	});

	it("rejects root, dot, directory, and extension-less paths", () => {
		expect(sanitizeUserReadingSourcePath("/")).toBe("");
		expect(sanitizeUserReadingSourcePath(".")).toBe("");
		expect(sanitizeUserReadingSourcePath("Inbox/")).toBe("");
		expect(sanitizeUserReadingSourcePath("Inbox/folder")).toBe("");
		expect(isValidUserReadingSourcePathShape("Books/paper.pdf")).toBe(true);
		expect(isValidUserReadingSourcePathShape("/")).toBe(false);
	});

	it("strips any extension for display basename", () => {
		expect(basenameWithoutExtension("weave/points/pdf.irdeck")).toBe("pdf");
		expect(basenameWithoutExtension("Inbox/01_Chunk.md", "fallback")).toBe(
			"01_Chunk",
		);
	});

	it("flags schedule items backed by irdeck source files", () => {
		expect(
			shouldExcludeScheduleItemBySource({ sourceFile: "points/pdf.irdeck" }),
		).toBe(true);
		expect(
			shouldExcludeScheduleItemBySource({ sourceFile: "Books/demo.pdf" }),
		).toBe(false);
	});

	it("flags schedule items whose title still looks like an irdeck filename", () => {
		expect(
			shouldExcludeScheduleItemBySource({
				sourceFile: "",
				title: "五月份的书籍阅读.irdeck",
			}),
		).toBe(true);
		expect(
			shouldExcludeScheduleItemBySource({
				sourceFile: "Books/ok.md",
				displayName: "topic.IRDECK",
			}),
		).toBe(true);
		expect(isIRDeckGhostLabel("正常阅读点")).toBe(false);
	});

	it("detects ghost points from path or title after path sanitization", () => {
		expect(
			isIRDeckGhostPoint({
				source: { path: "", title: "五月份的书籍阅读.irdeck" },
				userData: { title: "五月份的书籍阅读.irdeck" },
			}),
		).toBe(true);
		expect(
			isIRDeckGhostPoint({
				source: {
					path: "Topics/五月份的书籍阅读.irdeck",
					title: "Book",
				},
				userData: { title: "Book" },
			}),
		).toBe(true);
		expect(
			isIRDeckGhostPoint({
				source: { path: "Books/novel.md", title: "Novel" },
				userData: { title: "Novel" },
			}),
		).toBe(false);
	});
});
