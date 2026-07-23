import { describe, expect, it } from "vitest";
import type { Card } from "../../../data/types";
import {
	buildIRBlockInfoCompletionStats,
} from "../IRBlockInfoCompletionStats";
import { normalizeTraceDocumentKey } from "../IRSourceTraceStats";

function createCard(
	partial: Partial<Card> &
		Pick<Card, "uuid" | "content" | "stats" | "created" | "modified">,
): Card {
	return {
		uuid: partial.uuid,
		content: partial.content,
		stats: partial.stats,
		created: partial.created,
		modified: partial.modified,
		cardPurpose: partial.cardPurpose,
		sourceFile: partial.sourceFile,
		outputKind: partial.outputKind,
		tags: partial.tags || [],
	};
}

describe("buildIRBlockInfoCompletionStats", () => {
	it("counts weave cards traced to the source document", () => {
		const sourcePath = "附件/游戏.md";
		const cards = [
			createCard({
				uuid: "memory-1",
				content: `---
we_source: '[[附件/游戏]]'
---
memory`,
				stats: { totalReviews: 0, totalTime: 0, averageTime: 0 },
				created: "2026-04-11T00:00:00.000Z",
				modified: "2026-04-11T00:00:00.000Z",
			}),
			createCard({
				uuid: "extract-1",
				content: `---
we_source: '[[附件/游戏.md]]'
---
extract`,
				stats: { totalReviews: 0, totalTime: 0, averageTime: 0 },
				created: "2026-04-11T00:00:00.000Z",
				modified: "2026-04-11T00:00:00.000Z",
				outputKind: "extract",
			}),
			createCard({
				uuid: "other",
				content: `---
we_source: '[[Notes/Other]]'
---
other`,
				stats: { totalReviews: 0, totalTime: 0, averageTime: 0 },
				created: "2026-04-11T00:00:00.000Z",
				modified: "2026-04-11T00:00:00.000Z",
			}),
		];

		expect(
			buildIRBlockInfoCompletionStats({
				sourceFilePath: sourcePath,
				relationMode: "curated",
				linkedNotePaths: ["Notes/A.md", "Notes/A", "Notes/B.md"],
				linkedCardIds: ["ignored-when-traced"],
				cards,
			}),
		).toEqual({
			cardCount: 2,
			linkedNoteCount: 2,
		});

		expect(normalizeTraceDocumentKey(sourcePath)).toBeTruthy();
	});

	it("falls back to linkedCardIds when cards are unavailable", () => {
		expect(
			buildIRBlockInfoCompletionStats({
				sourceFilePath: "Notes/Alpha.md",
				relationMode: "curated",
				linkedCardIds: ["card-1", "card-1", "card-2"],
				linkedNotePath: "Permanent/Alpha.md",
				cards: [],
			}),
		).toEqual({
			cardCount: 2,
			linkedNoteCount: 1,
		});
	});

	it("MD 出链派生模式使用 derivedOutlinkPaths 计数", () => {
		expect(
			buildIRBlockInfoCompletionStats({
				sourceFilePath: "Notes/Source.md",
				sourceType: "chunk",
				relationMode: "derived-outlinks",
				derivedOutlinkPaths: ["Notes/A.md", "Notes/B.md"],
				linkedNotePaths: ["Notes/Ignored.md"],
				cards: [],
			}),
		).toEqual({
			cardCount: 0,
			linkedNoteCount: 2,
		});
	});

	it("PDF 精选关联仍使用 linkedNotePaths", () => {
		expect(
			buildIRBlockInfoCompletionStats({
				sourceFilePath: "Books/Doc.pdf",
				sourceType: "pdf",
				relationMode: "curated",
				linkedNotePaths: ["Notes/A.md", "Notes/B.md"],
				derivedOutlinkPaths: ["Notes/ShouldIgnore.md"],
				cards: [],
			}),
		).toEqual({
			cardCount: 0,
			linkedNoteCount: 2,
		});
	});
});
