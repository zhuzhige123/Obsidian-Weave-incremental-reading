import { describe, expect, test } from "vitest";
import { buildReadingTargetPreviewMarkdown } from "../IRReadingTargetCurrentLocation";
import type { ParsedReadingTarget } from "../IRReadingTargetTypes";

describe("buildReadingTargetPreviewMarkdown", () => {
	test("PDF 链接预览保留嵌入以显示选区片段", () => {
		const target: ParsedReadingTarget = {
			kind: "pdf",
			rawInput:
				"![[附件/book.pdf#page=203&rect=1,2,3,4|人格心理学, p.188]]",
			resumeLink: "附件/book.pdf#page=203&rect=1,2,3,4",
			displayLink: "[[附件/book.pdf#page=203&rect=1,2,3,4|人格心理学, p.188]]",
			sourceFilePath: "附件/book.pdf",
			pdfPath: "附件/book.pdf",
			alias: "人格心理学, p.188",
		};

		const preview = buildReadingTargetPreviewMarkdown(target, "人格心理学");

		expect(preview).toContain("![[");
		expect(preview).toContain("page=203");
		expect(preview).toContain("rect=");
	});
});
