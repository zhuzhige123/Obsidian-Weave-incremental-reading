import { type App, TFile, normalizePath } from "obsidian";
import type { ParagraphWorkbenchSegment } from "./types";

export interface SegmentSourceRange {
	startLine: number;
	endLine: number;
}

export interface SegmentSourceWriteResult extends SegmentSourceRange {
	text: string;
	lineDelta: number;
}

function detectNewline(content: string): string {
	return content.includes("\r\n") ? "\r\n" : "\n";
}

function splitMarkdownLines(content: string): string[] {
	return content.split(/\r\n|\n|\r/);
}

export function readSegmentSourceRange(
	segment: ParagraphWorkbenchSegment | null | undefined,
): SegmentSourceRange | null {
	if (!segment) {
		return null;
	}
	const startLine =
		typeof segment.metadata?.startLine === "number"
			? Number(segment.metadata.startLine)
			: NaN;
	const endLine =
		typeof segment.metadata?.endLine === "number"
			? Number(segment.metadata.endLine)
			: startLine;
	if (!Number.isFinite(startLine) || startLine < 0) {
		return null;
	}
	return {
		startLine: Math.max(0, Math.floor(startLine)),
		endLine: Math.max(Math.floor(startLine), Math.floor(endLine)),
	};
}

/**
 * Replace a 0-based inclusive line range in markdown content with new segment text.
 */
export function replaceSegmentRangeInContent(
	content: string,
	range: SegmentSourceRange,
	nextText: string,
): { content: string; result: SegmentSourceWriteResult } {
	const newline = detectNewline(content);
	const lines = splitMarkdownLines(content);
	const startLine = Math.max(0, Math.min(range.startLine, lines.length));
	const endLine =
		lines.length === 0
			? -1
			: Math.min(Math.max(range.endLine, startLine), lines.length - 1);

	const normalizedText = String(nextText ?? "").replace(/\r\n?/g, "\n");
	const replacement =
		normalizedText === "" ? [""] : normalizedText.split("\n");

	const before = lines.slice(0, startLine);
	const after = endLine < 0 ? [] : lines.slice(endLine + 1);
	const nextContent = [...before, ...replacement, ...after].join(newline);
	const nextEndLine = startLine + replacement.length - 1;
	const previousLineCount =
		endLine < 0 ? 0 : Math.max(0, endLine - startLine + 1);

	return {
		content: nextContent,
		result: {
			startLine,
			endLine: Math.max(startLine, nextEndLine),
			text: replacement.join("\n"),
			lineDelta: replacement.length - previousLineCount,
		},
	};
}

export function extractSegmentTextFromContent(
	content: string,
	range: SegmentSourceRange,
): string {
	const lines = splitMarkdownLines(content);
	if (lines.length === 0) {
		return "";
	}
	const startLine = Math.min(Math.max(range.startLine, 0), lines.length - 1);
	const endLine = Math.min(
		Math.max(range.endLine, startLine),
		lines.length - 1,
	);
	return lines.slice(startLine, endLine + 1).join("\n");
}

export async function writeSegmentTextToSourceFile(
	app: App,
	sourcePath: string,
	segment: ParagraphWorkbenchSegment,
	nextText: string,
): Promise<SegmentSourceWriteResult> {
	const normalizedPath = normalizePath(String(sourcePath || "").trim());
	const file = app.vault.getAbstractFileByPath(normalizedPath);
	if (!(file instanceof TFile)) {
		throw new Error("paragraph-workbench-source-file-missing");
	}
	const range = readSegmentSourceRange(segment);
	if (!range) {
		throw new Error("paragraph-workbench-segment-range-missing");
	}

	const current = await app.vault.read(file);
	const { content, result } = replaceSegmentRangeInContent(
		current,
		range,
		nextText,
	);
	if (content !== current) {
		await app.vault.modify(file, content);
	}
	return result;
}

export async function readSegmentTextFromSourceFile(
	app: App,
	sourcePath: string,
	segment: ParagraphWorkbenchSegment,
): Promise<string> {
	const normalizedPath = normalizePath(String(sourcePath || "").trim());
	const file = app.vault.getAbstractFileByPath(normalizedPath);
	if (!(file instanceof TFile)) {
		throw new Error("paragraph-workbench-source-file-missing");
	}
	const range = readSegmentSourceRange(segment);
	if (!range) {
		return String(segment.text || "");
	}
	const content = await app.vault.read(file);
	return extractSegmentTextFromContent(content, range);
}

export function applySegmentWriteResultToSegment(
	segment: ParagraphWorkbenchSegment,
	result: SegmentSourceWriteResult,
	extraMetadata?: Record<string, unknown>,
): ParagraphWorkbenchSegment {
	return {
		...segment,
		text: result.text,
		metadata: {
			...(segment.metadata || {}),
			startLine: result.startLine,
			endLine: result.endLine,
			...(extraMetadata || {}),
		},
	};
}
