import { type App, TFile, normalizePath } from "obsidian";
import { i18n } from "../../../utils/i18n";
import { logger } from "../../../utils/logger";
import type { ParagraphWorkbenchSegment } from "./types";

/** Obsidian 官方块 ID 行内标记：^block-id（含 IR 管理的 IR- 前缀） */
export const OBSIDIAN_BLOCK_ID_LINE_REGEX = /\^([A-Za-z0-9_-]+)/;

const WIKI_LINK_INNER_REGEX = /!?\[\[([^\]]+)\]\]/;

export interface SegmentTitleDraft {
	title: string;
	titleDetected: boolean;
}

export function cleanParagraphBlockTitle(rawTitle: string): string {
	return String(rawTitle || "")
		.replace(/\r\n?/g, " ")
		.replace(/^\s*#{1,6}\s+/, "")
		.replace(/\s+/g, " ")
		.trim();
}

export function deriveSegmentTitleDraft(
	segment: ParagraphWorkbenchSegment | null | undefined,
): SegmentTitleDraft {
	if (!segment) {
		return {
			title: i18n.t("irSidebar.calendar.untitledPoint"),
			titleDetected: false,
		};
	}

	const headingTitle = cleanParagraphBlockTitle(
		String(segment.title || segment.chapterTitle || ""),
	);
	if (headingTitle) {
		return { title: headingTitle, titleDetected: true };
	}

	const normalized = String(segment.text || "")
		.replace(/\r\n?/g, "\n")
		.trim();
	const lines = normalized.split("\n");
	const firstNonEmptyLine =
		lines.find((line) => line.trim().length > 0) || normalized;
	const headingMatch = firstNonEmptyLine.trim().match(/^#{1,6}\s+(.+)$/);
	if (headingMatch?.[1]) {
		const title = cleanParagraphBlockTitle(headingMatch[1]);
		if (title) {
			return { title, titleDetected: true };
		}
	}

	const cleanedLine = cleanParagraphBlockTitle(firstNonEmptyLine);
	return {
		title:
			cleanedLine.length > 80
				? `${cleanedLine.slice(0, 80).trim()}...`
				: cleanedLine || i18n.t("irSidebar.calendar.untitledPoint"),
		titleDetected: false,
	};
}

export function normalizeObsidianBlockId(
	raw: string | null | undefined,
): string | null {
	const value = String(raw || "").trim();
	if (!value) {
		return null;
	}
	const withoutCaret = value.startsWith("^") ? value.slice(1) : value;
	const match = withoutCaret.match(/^([A-Za-z0-9_-]+)$/);
	return match?.[1] ? match[1] : null;
}

export function formatObsidianBlockId(blockId: string): string {
	const normalized = normalizeObsidianBlockId(blockId);
	return normalized ? `^${normalized}` : "";
}

export function extractObsidianBlockIdFromText(text: string): string | null {
	const match = String(text || "").match(OBSIDIAN_BLOCK_ID_LINE_REGEX);
	return match?.[1] ? match[1] : null;
}

export function extractObsidianBlockIdFromSegment(
	segment: ParagraphWorkbenchSegment | null | undefined,
): string | null {
	if (!segment) {
		return null;
	}
	const fromMeta = normalizeObsidianBlockId(
		typeof segment.metadata?.obsidianBlockId === "string"
			? segment.metadata.obsidianBlockId
			: null,
	);
	if (fromMeta) {
		return fromMeta;
	}
	const fromContent = extractObsidianBlockIdFromText(segment.text);
	if (fromContent) {
		return fromContent;
	}
	// segment.id may be a paragraph index ("0") or "line-12" — never treat those as block ids.
	const fromId = normalizeObsidianBlockId(segment.id);
	if (
		fromId &&
		(/^(IR-|ir_|we-)/i.test(fromId) ||
			extractObsidianBlockIdFromText(segment.text) === fromId)
	) {
		return fromId;
	}
	return null;
}

/** IR 段落锚点默认前缀（Obsidian 块 ID：^IR-xxxxxxxx） */
export const IR_OBSIDIAN_BLOCK_ID_PREFIX = "IR-";

export function generateObsidianBlockId(
	prefix = IR_OBSIDIAN_BLOCK_ID_PREFIX,
): string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
	let suffix = "";
	for (let i = 0; i < 8; i++) {
		suffix += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	const normalizedPrefix =
		String(prefix || IR_OBSIDIAN_BLOCK_ID_PREFIX).trim() ||
		IR_OBSIDIAN_BLOCK_ID_PREFIX;
	if (normalizedPrefix.endsWith("-") || normalizedPrefix.endsWith("_")) {
		return `${normalizedPrefix}${suffix}`;
	}
	return `${normalizedPrefix}-${suffix}`;
}

export function extractWikiLinkTarget(raw: string): string {
	const match = String(raw || "")
		.trim()
		.match(WIKI_LINK_INNER_REGEX);
	if (!match?.[1]) {
		return "";
	}
	return match[1].split("|")[0]?.trim() || "";
}

export function buildObsidianBlockResumeLink(
	sourcePath: string,
	blockId: string,
	alias?: string,
): string {
	return buildObsidianBlockWikiLink(sourcePath, blockId, alias);
}

export function resolveLegacyBlockResumeLink(block: {
	filePath?: string;
	notes?: string;
}): string | undefined {
	const fromNotes = extractWikiLinkTarget(String(block.notes || ""));
	if (fromNotes.includes("#^")) {
		return fromNotes;
	}
	const filePath = normalizePath(String(block.filePath || "").trim());
	return filePath || undefined;
}

export function buildObsidianBlockWikiLink(
	sourcePath: string,
	blockId: string,
	alias?: string,
): string {
	const normalizedPath = normalizePath(String(sourcePath || "").trim());
	const normalizedBlockId = formatObsidianBlockId(blockId);
	if (!normalizedPath || !normalizedBlockId) {
		return "";
	}
	const base = `${normalizedPath}${
		normalizedBlockId.startsWith("#") ? "" : `#${normalizedBlockId}`
	}`;
	const trimmedAlias = String(alias || "").trim();
	return trimmedAlias ? `[[${base}|${trimmedAlias}]]` : `[[${base}]]`;
}

export function buildObsidianEmbedBlockWikiLink(
	sourcePath: string,
	blockId: string,
	alias?: string,
): string {
	const link = buildObsidianBlockWikiLink(sourcePath, blockId, alias);
	return link ? `!${link}` : "";
}

export function buildCanvasNodeWikiLink(
	canvasPath: string,
	nodeId: string,
	alias?: string,
): string {
	const normalizedPath = normalizePath(String(canvasPath || "").trim());
	const normalizedNodeId = String(nodeId || "").trim();
	if (!normalizedPath || !normalizedNodeId) {
		return "";
	}
	const base = `${normalizedPath}?node=${encodeURIComponent(normalizedNodeId)}`;
	const trimmedAlias = String(alias || "").trim();
	return trimmedAlias ? `[[${base}|${trimmedAlias}]]` : `[[${base}]]`;
}

export function buildCanvasNodeEmbedWikiLink(
	canvasPath: string,
	nodeId: string,
	alias?: string,
): string {
	const link = buildCanvasNodeWikiLink(canvasPath, nodeId, alias);
	return link ? `!${link}` : "";
}

export function blockReferencesObsidianId(
	block: { notes?: string },
	blockId: string,
): boolean {
	const normalized = normalizeObsidianBlockId(blockId);
	if (!normalized) {
		return false;
	}
	const notes = String(block.notes || "");
	return notes.includes(`#^${normalized}`) || notes.includes(`^${normalized}`);
}

export function findDuplicateBlockForSegment(
	blocks: Array<{
		id: string;
		startLine?: number;
		endLine?: number;
		notes?: string;
	}>,
	segment: ParagraphWorkbenchSegment,
	obsidianBlockId?: string | null,
):
	| { id: string; startLine?: number; endLine?: number; notes?: string }
	| undefined {
	const normalizedBlockId = normalizeObsidianBlockId(
		obsidianBlockId || extractObsidianBlockIdFromSegment(segment),
	);
	if (normalizedBlockId) {
		const byBlockId = blocks.find((block) =>
			blockReferencesObsidianId(block, normalizedBlockId),
		);
		if (byBlockId) {
			return byBlockId;
		}
	}

	const startLine =
		typeof segment.metadata?.startLine === "number"
			? Number(segment.metadata.startLine)
			: 0;
	const endLine =
		typeof segment.metadata?.endLine === "number"
			? Number(segment.metadata.endLine)
			: startLine;

	return blocks.find(
		(block) =>
			block.startLine === startLine &&
			(typeof block.endLine !== "number" || block.endLine === endLine),
	);
}

function readSegmentLineRange(segment: ParagraphWorkbenchSegment): {
	startLine: number;
	endLine: number;
} {
	const startLine =
		typeof segment.metadata?.startLine === "number"
			? Number(segment.metadata.startLine)
			: 0;
	const endLine =
		typeof segment.metadata?.endLine === "number"
			? Number(segment.metadata.endLine)
			: startLine;
	return {
		startLine: Math.max(0, startLine),
		endLine: Math.max(startLine, endLine),
	};
}

/**
 * Expand a line selection to the enclosing Obsidian block
 * (contiguous non-blank lines between blank-line separators).
 */
export function resolveObsidianBlockRangeAroundLines(
	lines: string[],
	fromLine: number,
	toLine: number,
): { startLine: number; endLine: number } {
	if (lines.length === 0) {
		return { startLine: 0, endLine: 0 };
	}
	let start = Math.max(0, Math.min(fromLine, toLine, lines.length - 1));
	let end = Math.max(
		0,
		Math.min(Math.max(fromLine, toLine), lines.length - 1),
	);

	while (start > 0 && String(lines[start - 1] || "").trim() !== "") {
		start -= 1;
	}
	while (end < lines.length - 1 && String(lines[end + 1] || "").trim() !== "") {
		end += 1;
	}
	while (start < end && String(lines[start] || "").trim() === "") {
		start += 1;
	}
	while (end > start && String(lines[end] || "").trim() === "") {
		end -= 1;
	}
	return { startLine: start, endLine: end };
}

export interface EnsureBlockIdOnMarkdownSelectionResult {
	nextContent: string;
	blockId: string;
	changed: boolean;
	anchorLineIndex: number;
	alreadyExisted: boolean;
}

/**
 * Ensure the Obsidian block that contains the given line range has a block id.
 * Writes ` ^IR-…` on the block's last content line when missing.
 */
export function ensureBlockIdOnMarkdownSelection(
	content: string,
	fromLine: number,
	toLine: number,
): EnsureBlockIdOnMarkdownSelectionResult {
	const newline = content.includes("\r\n") ? "\r\n" : "\n";
	const lines = content.split(/\r\n|\n|\r/);
	const range = resolveObsidianBlockRangeAroundLines(lines, fromLine, toLine);
	const existing =
		extractObsidianBlockIdFromText(
			lines[findSegmentLastContentLineIndex(lines, range)] || "",
		) || null;
	const blockId = existing || generateObsidianBlockId();
	const applied = applyObsidianBlockIdToLines(lines, range, blockId);
	const nextContent = applied.lines.join(newline);
	return {
		nextContent,
		blockId: applied.blockId,
		changed: nextContent !== content,
		anchorLineIndex: applied.anchorLineIndex,
		alreadyExisted: applied.alreadyExisted,
	};
}

/**
 * Find the last non-empty content line inside an inclusive segment range.
 * Obsidian block ids must hang off that line (`text ^id`), never sit alone on a blank line.
 */
export function findSegmentLastContentLineIndex(
	lines: string[],
	range: { startLine: number; endLine: number },
): number {
	if (lines.length === 0) {
		return 0;
	}
	const start = Math.max(0, Math.min(range.startLine, lines.length - 1));
	const end = Math.max(
		start,
		Math.min(range.endLine, Math.max(lines.length - 1, 0)),
	);
	for (let index = end; index >= start; index -= 1) {
		if (String(lines[index] || "").trim().length > 0) {
			return index;
		}
	}
	return start;
}

export interface ApplyObsidianBlockIdResult {
	lines: string[];
	blockId: string;
	/** Line that now carries ` ^blockId` */
	anchorLineIndex: number;
	alreadyExisted: boolean;
	insertedTrailingBlank: boolean;
}

/**
 * Apply Obsidian block-id rules:
 * - append ` ^id` to the last non-empty line of the block (same line, not a new line)
 * - ensure exactly one blank line after that block (Obsidian block = content between blank lines)
 */
export function applyObsidianBlockIdToLines(
	lines: string[],
	range: { startLine: number; endLine: number },
	blockId: string,
): ApplyObsidianBlockIdResult {
	const nextLines = lines.slice();
	const anchorLineIndex = findSegmentLastContentLineIndex(nextLines, range);
	const currentLine = nextLines[anchorLineIndex] ?? "";

	const existing = extractObsidianBlockIdFromText(currentLine);
	if (existing) {
		const insertedTrailingBlank = ensureBlankLineAfterBlock(
			nextLines,
			anchorLineIndex,
		);
		return {
			lines: nextLines,
			blockId: existing,
			anchorLineIndex,
			alreadyExisted: true,
			insertedTrailingBlank,
		};
	}

	const trimmedLine = currentLine.replace(/\s+$/, "");
	nextLines[anchorLineIndex] = trimmedLine
		? `${trimmedLine} ^${blockId}`
		: `^${blockId}`;
	const insertedTrailingBlank = ensureBlankLineAfterBlock(
		nextLines,
		anchorLineIndex,
	);
	return {
		lines: nextLines,
		blockId,
		anchorLineIndex,
		alreadyExisted: false,
		insertedTrailingBlank,
	};
}

/** Ensure the line after the block-id line is blank (insert one if needed). */
function ensureBlankLineAfterBlock(
	lines: string[],
	anchorLineIndex: number,
): boolean {
	const nextIndex = anchorLineIndex + 1;
	if (nextIndex >= lines.length) {
		lines.push("");
		return true;
	}
	if (String(lines[nextIndex] || "").trim().length === 0) {
		return false;
	}
	lines.splice(nextIndex, 0, "");
	return true;
}

export async function ensureSegmentBlockIdInSourceFile(
	app: App,
	sourcePath: string,
	segment: ParagraphWorkbenchSegment,
): Promise<{ blockId: string; anchorLineIndex: number }> {
	const normalizedPath = normalizePath(String(sourcePath || "").trim());
	const file = app.vault.getAbstractFileByPath(normalizedPath);
	if (!(file instanceof TFile)) {
		throw new Error("paragraph-workbench-source-file-missing");
	}

	const range = readSegmentLineRange(segment);
	const content = await app.vault.read(file);
	const newline = content.includes("\r\n") ? "\r\n" : "\n";
	const lines = content.split(/\r\n|\n|\r/);

	const existing = extractObsidianBlockIdFromSegment(segment);
	if (existing) {
		const applied = applyObsidianBlockIdToLines(lines, range, existing);
		if (applied.insertedTrailingBlank) {
			await app.vault.modify(file, applied.lines.join(newline));
		}
		return { blockId: existing, anchorLineIndex: applied.anchorLineIndex };
	}

	const blockId = generateObsidianBlockId();
	const applied = applyObsidianBlockIdToLines(lines, range, blockId);
	const nextContent = applied.lines.join(newline);
	if (nextContent !== content) {
		await app.vault.modify(file, nextContent);
	}

	logger.debug(
		`[paragraph-block-reference] inserted block id ^${applied.blockId} at ${normalizedPath}:${
			applied.anchorLineIndex + 1
		}`,
	);
	return {
		blockId: applied.blockId,
		anchorLineIndex: applied.anchorLineIndex,
	};
}

export function resolveParagraphWorkbenchSourcePath(
	sessionSourcePath: string,
	editorSourcePath?: string | null,
): string {
	const sessionPath = normalizePath(String(sessionSourcePath || "").trim());
	if (sessionPath) {
		return sessionPath;
	}
	return normalizePath(String(editorSourcePath || "").trim());
}
