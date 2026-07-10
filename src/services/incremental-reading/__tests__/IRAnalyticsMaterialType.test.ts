import { describe, expect, it } from "vitest";
import {
	buildAnalyticsMaterialTypeBreakdown,
	buildAnalyticsMaterialTypeOutcome,
	resolveAnalyticsMaterialType,
	type IRAnalyticsMaterialTypeUnit,
} from "../IRAnalyticsMaterialType";

const LABELS = {
	md: "Markdown",
	canvas: "Canvas",
	epub: "EPUB",
	pdf: "PDF",
	link: "网页链接",
	other: "其它",
} as const;

function makeUnit(
	partial: Partial<IRAnalyticsMaterialTypeUnit> &
		Pick<IRAnalyticsMaterialTypeUnit, "id" | "sourceDocumentKey" | "materialType">,
): IRAnalyticsMaterialTypeUnit {
	return {
		sourceKind: partial.sourceKind ?? "markdown",
		sourcePath: partial.sourcePath ?? "Notes/Test.md",
		stats: partial.stats ?? {},
		...partial,
	};
}

describe("resolveAnalyticsMaterialType", () => {
	it("detects web links from resumeLink and webUrl", () => {
		expect(
			resolveAnalyticsMaterialType({
				id: "chunk-1",
				sourceKind: "markdown",
				sourcePath: "IR/Web Point.md",
				resumeLink: "https://example.com/article",
			}),
		).toBe("link");
		expect(
			resolveAnalyticsMaterialType({
				id: "chunk-2",
				sourceKind: "markdown",
				sourcePath: "IR/Web Point.md",
				webUrl: "https://example.com/page",
			}),
		).toBe("link");
	});

	it("detects pdf, epub, canvas, and md from paths and task ids", () => {
		expect(
			resolveAnalyticsMaterialType({
				id: "pdfbm-1",
				sourceKind: "pdf",
				sourcePath: "Books/A.pdf",
			}),
		).toBe("pdf");
		expect(
			resolveAnalyticsMaterialType({
				id: "epubbm-1",
				sourceKind: "epub",
				sourcePath: "Books/A.epub",
			}),
		).toBe("epub");
		expect(
			resolveAnalyticsMaterialType({
				id: "chunk-1",
				sourceKind: "markdown",
				sourcePath: "Maps/Topic.canvas",
			}),
		).toBe("canvas");
		expect(
			resolveAnalyticsMaterialType({
				id: "chunk-2",
				sourceKind: "markdown",
				sourcePath: "Notes/Topic.md",
			}),
		).toBe("md");
	});
});

describe("buildAnalyticsMaterialTypeBreakdown", () => {
	it("deduplicates parent documents and computes share by hours and documents", () => {
		const units = [
			makeUnit({
				id: "chunk-1",
				sourceDocumentKey: "notes/source.md",
				materialType: "md",
				stats: { extracts: 2 },
			}),
			makeUnit({
				id: "chunk-2",
				sourceDocumentKey: "notes/source.md",
				materialType: "md",
				stats: { cardsCreated: 1 },
			}),
			makeUnit({
				id: "pdfbm-1",
				sourceDocumentKey: "books/a.pdf",
				materialType: "pdf",
				sourceKind: "pdf",
				sourcePath: "Books/A.pdf",
			}),
		];
		const readingHoursByUnitId = new Map([
			["chunk-1", 2],
			["chunk-2", 1],
			["pdfbm-1", 3],
		]);

		const breakdown = buildAnalyticsMaterialTypeBreakdown({
			units,
			readingHoursByUnitId,
			labelByType: LABELS,
		});

		expect(breakdown.totalPoints).toBe(3);
		expect(breakdown.totalDocuments).toBe(2);
		expect(breakdown.totalReadingHours).toBe(6);
		expect(breakdown.slices).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "md",
					pointCount: 2,
					documentCount: 1,
					readingHours: 3,
					pointShare: 66.7,
					documentShare: 50,
					hoursShare: 50,
				}),
				expect.objectContaining({
					type: "pdf",
					pointCount: 1,
					documentCount: 1,
					readingHours: 3,
					pointShare: 33.3,
					documentShare: 50,
					hoursShare: 50,
				}),
			]),
		);
	});
});

describe("buildAnalyticsMaterialTypeOutcome", () => {
	it("aggregates outcomes per material type and computes outcomes per hour", () => {
		const units = [
			makeUnit({
				id: "chunk-1",
				sourceDocumentKey: "notes/source.md",
				materialType: "md",
				stats: { extracts: 2, cardsCreated: 1, notesWritten: 1 },
			}),
			makeUnit({
				id: "pdfbm-1",
				sourceDocumentKey: "books/a.pdf",
				materialType: "pdf",
				sourceKind: "pdf",
				sourcePath: "Books/A.pdf",
				stats: { extracts: 1 },
			}),
		];
		const readingHoursByUnitId = new Map([
			["chunk-1", 2],
			["pdfbm-1", 4],
		]);

		const outcome = buildAnalyticsMaterialTypeOutcome({
			units,
			readingHoursByUnitId,
			labelByType: LABELS,
		});

		expect(outcome).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "md",
					readingHours: 2,
					extracts: 2,
					cardsCreated: 1,
					notesWritten: 1,
					outcomesPerHour: 2,
				}),
				expect.objectContaining({
					type: "pdf",
					readingHours: 4,
					extracts: 1,
					outcomesPerHour: 0.3,
				}),
			]),
		);
	});
});
