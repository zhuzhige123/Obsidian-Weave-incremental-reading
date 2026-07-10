import { describe, expect, it, vi } from "vitest";
import { buildScheduleItemFromPdfTask } from "../../IRCalendarScheduleItem";
import {
	canEditReadingPointLink,
	resolveReadingPointLinkInputFromParts,
	resolveSavedResumeLink,
	summarizeReadingPointLink,
} from "../IRReadingPointEditLinkResolver";

const mockApp = {
	vault: {
		getAbstractFileByPath: vi.fn(),
	},
} as never;

describe("IRReadingPointEditLinkResolver", () => {
	it("prefers persisted pdf task link over stale schedule projection", () => {
		const material = buildScheduleItemFromPdfTask({
			id: "pdfbm-1",
			title: "Chapter",
			link: "[[Doc.pdf#page=2]]",
			pdfPath: "Doc.pdf",
			status: "new",
			priorityUi: 5,
			priorityEff: 5,
			intervalDays: 1,
			nextRepDate: 0,
			createdAt: 0,
			updatedAt: 0,
		} as any);

		expect(
			resolveReadingPointLinkInputFromParts(mockApp, {
				material: { ...material, resumeLink: "[[Doc.pdf#page=3]]" },
				pdfTask: { link: "[[Doc.pdf#page=2]]" } as any,
			}),
		).toBe("[[Doc.pdf#page=2]]");
	});

	it("prefers chunk meta resumeLink over stale schedule projection", () => {
		expect(
			resolveReadingPointLinkInputFromParts(mockApp, {
				material: {
					id: "chunk-1",
					sourceType: "chunk",
					sourceFile: "Notes/chunk.md",
					resumeLink: "old-link",
				} as any,
				chunk: {
					chunkId: "chunk-1",
					filePath: "Notes/chunk.md",
					meta: { resumeLink: "new-link" },
				} as any,
			}),
		).toBe("new-link");
	});

	it("prefers persisted snapshot metadata resumeLink over stale schedule projection", () => {
		expect(
			resolveReadingPointLinkInputFromParts(mockApp, {
				material: {
					id: "epubbm-1",
					sourceType: "epub",
					sourceFile: "Books/demo.epub",
					resumeLink: "old-epub-link",
				} as any,
				epubTask: {
					meta: { resumeLink: "stale-epub-link" },
				} as any,
				snapshot: {
					point: {
						metadata: { resumeLink: "Notes/demo.md#^new-block" },
						trace: { locator: { resumeLink: "Books/demo.epub#chapter-1" } },
					},
				} as any,
			}),
		).toBe("Notes/demo.md#^new-block");
	});

	it("prefers persisted snapshot metadata resumeLink over stale chunk projection", () => {
		expect(
			resolveReadingPointLinkInputFromParts(mockApp, {
				material: {
					id: "chunk-1",
					sourceType: "chunk",
					sourceFile: "Notes/chunk.md",
					resumeLink: "old-link",
				} as any,
				snapshot: {
					point: {
						metadata: { resumeLink: "stored-link" },
						trace: { locator: { resumeLink: "locator-link" } },
					},
				} as any,
			}),
		).toBe("stored-link");
	});

	it("falls back to raw link input when parsed resumeLink is empty", () => {
		expect(
			resolveSavedResumeLink("附件/book.epub", {
				kind: "unknown",
				rawInput: "附件/book.epub",
				resumeLink: "",
			}),
		).toBe("附件/book.epub");
	});

	it("summarizes long links", () => {
		const longLink = "x".repeat(120);
		expect(summarizeReadingPointLink(longLink)).toMatch(/…$/);
	});

	it("allows link editing when source file exists", () => {
		const material = buildScheduleItemFromPdfTask({
			id: "pdfbm-2",
			title: "Chapter",
			link: "",
			pdfPath: "Doc.pdf",
			status: "new",
			priorityUi: 5,
			priorityEff: 5,
			intervalDays: 1,
			nextRepDate: 0,
			createdAt: 0,
			updatedAt: 0,
		} as any);

		expect(canEditReadingPointLink(material)).toBe(true);
	});
});
