import { describe, expect, it, vi } from "vitest";
import type { App, TFile } from "obsidian";
import {
	extractFocusFragmentFromResumeLink,
	resolveBlankLineSeparatedBlockAtLine,
	resolveMarkdownBlockFocusRange,
	resolveSemanticBlockRangeAtLine,
} from "../markdown-block-focus-range";

function createApp(cache: Record<string, unknown> | null): App {
	return {
		metadataCache: {
			getFileCache: vi.fn(() => cache),
		},
	} as unknown as App;
}

function createFile(path = "Notes/demo.md"): TFile {
	return { path, extension: "md" } as TFile;
}

describe("markdown-block-focus-range", () => {
	it("extracts fragment from resume links", () => {
		expect(
			extractFocusFragmentFromResumeLink("Notes/demo.md#^abc123"),
		).toBe("^abc123");
		expect(
			extractFocusFragmentFromResumeLink("[[Notes/demo.md#Heading|alias]]"),
		).toBe("Heading");
		expect(extractFocusFragmentFromResumeLink("Notes/demo.md")).toBe("");
	});

	it("resolves block id ranges from metadata cache", () => {
		const app = createApp({
			blocks: {
				abc123: {
					position: {
						start: { line: 4, col: 0, offset: 0 },
						end: { line: 6, col: 0, offset: 0 },
					},
				},
			},
		});
		expect(
			resolveMarkdownBlockFocusRange(app, createFile(), {
				blockId: "abc123",
			}),
		).toEqual({ fromLine: 4, toLine: 6 });
	});

	it("resolves heading sections until the next same-level heading", () => {
		const app = createApp({
			headings: [
				{
					heading: "Intro",
					level: 2,
					position: {
						start: { line: 0, col: 0, offset: 0 },
						end: { line: 0, col: 0, offset: 0 },
					},
				},
				{
					heading: "Focus me",
					level: 2,
					position: {
						start: { line: 5, col: 0, offset: 0 },
						end: { line: 5, col: 0, offset: 0 },
					},
				},
				{
					heading: "Nested",
					level: 3,
					position: {
						start: { line: 8, col: 0, offset: 0 },
						end: { line: 8, col: 0, offset: 0 },
					},
				},
				{
					heading: "Next",
					level: 2,
					position: {
						start: { line: 12, col: 0, offset: 0 },
						end: { line: 12, col: 0, offset: 0 },
					},
				},
			],
		});
		expect(
			resolveMarkdownBlockFocusRange(app, createFile(), {
				fragment: "Focus me",
			}),
		).toEqual({ fromLine: 5, toLine: 11 });
	});

	it("resolves explicit line ranges and line-number fragments", () => {
		const app = createApp(null);
		expect(
			resolveMarkdownBlockFocusRange(
				app,
				createFile(),
				{ startLine: 2, endLine: 4 },
				10,
			),
		).toEqual({ fromLine: 2, toLine: 4 });
		expect(
			resolveMarkdownBlockFocusRange(
				app,
				createFile(),
				{ fragment: "3-5" },
				10,
			),
		).toEqual({ fromLine: 2, toLine: 4 });
	});

	it("resolves semantic section ranges at a line", () => {
		const app = createApp({
			sections: [
				{
					type: "paragraph",
					position: {
						start: { line: 0, col: 0, offset: 0 },
						end: { line: 1, col: 0, offset: 0 },
					},
				},
				{
					type: "paragraph",
					position: {
						start: { line: 3, col: 0, offset: 0 },
						end: { line: 5, col: 0, offset: 0 },
					},
				},
			],
		});
		expect(
			resolveSemanticBlockRangeAtLine(app, createFile(), 4, { lineCount: 8 }),
		).toEqual({ fromLine: 3, toLine: 5 });
	});

	it("expands heading sections when the cursor is on a heading", () => {
		const app = createApp({
			sections: [
				{
					type: "heading",
					position: {
						start: { line: 2, col: 0, offset: 0 },
						end: { line: 2, col: 0, offset: 0 },
					},
				},
			],
			headings: [
				{
					heading: "A",
					level: 2,
					position: {
						start: { line: 2, col: 0, offset: 0 },
						end: { line: 2, col: 0, offset: 0 },
					},
				},
				{
					heading: "B",
					level: 2,
					position: {
						start: { line: 7, col: 0, offset: 0 },
						end: { line: 7, col: 0, offset: 0 },
					},
				},
			],
		});
		expect(
			resolveSemanticBlockRangeAtLine(app, createFile(), 2, { lineCount: 10 }),
		).toEqual({ fromLine: 2, toLine: 6 });
	});

	it("falls back to blank-line separated paragraphs", () => {
		const content = ["one", "two", "", "three", "four", "", "five"].join("\n");
		expect(resolveBlankLineSeparatedBlockAtLine(content, 3)).toEqual({
			fromLine: 3,
			toLine: 4,
		});
		expect(
			resolveSemanticBlockRangeAtLine(createApp(null), createFile(), 1, {
				lineCount: 7,
				content,
			}),
		).toEqual({ fromLine: 0, toLine: 1 });
	});
});
