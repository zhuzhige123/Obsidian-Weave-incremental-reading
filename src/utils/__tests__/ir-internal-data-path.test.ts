import { describe, expect, it } from "vitest";
import {
	basenameWithoutExtension,
	isIRDeckFilePath,
	isIRInternalScheduleSourcePath,
	isValidUserReadingSourcePathShape,
	sanitizeUserReadingSourcePath,
	shouldExcludeScheduleItemBySource,
} from "../ir-internal-data-path";

describe("ir-internal-data-path", () => {
	it("detects .irdeck paths case-insensitively", () => {
		expect(
			isIRDeckFilePath("weave/incremental-reading/points/pdf.irdeck"),
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
				"weave/incremental-reading/points/pdf.irdeck",
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
});
