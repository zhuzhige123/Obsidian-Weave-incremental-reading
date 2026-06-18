import { normalizePath, TFile, type App } from "obsidian";
import { i18n } from "../../../utils/i18n";
import type { ParagraphWorkbenchSegment } from "./types";
import { logger } from "../../../utils/logger";

/** Obsidian 官方块 ID 行内标记：^block-id（含 IR 管理的 ir_ 前缀） */
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

export function deriveSegmentTitleDraft(segment: ParagraphWorkbenchSegment | null | undefined): SegmentTitleDraft {
	if (!segment) {
		return { title: i18n.t("irSidebar.calendar.untitledPoint"), titleDetected: false };
	}

	const headingTitle = cleanParagraphBlockTitle(String(segment.title || segment.chapterTitle || ""));
	if (headingTitle) {
		return { title: headingTitle, titleDetected: true };
	}

	const normalized = String(segment.text || "").replace(/\r\n?/g, "\n").trim();
	const lines = normalized.split("\n");
	const firstNonEmptyLine = lines.find((line) => line.trim().length > 0) || normalized;
	const headingMatch = firstNonEmptyLine.trim().match(/^#{1,6}\s+(.+)$/);
	if (headingMatch?.[1]) {
		const title = cleanParagraphBlockTitle(headingMatch[1]);
		if (title) {
			return { title, titleDetected: true };
		}
	}

	const cleanedLine = cleanParagraphBlockTitle(firstNonEmptyLine);
	return {
		title: cleanedLine.length > 80 ? `${cleanedLine.slice(0, 80).trim()}...` : cleanedLine || i18n.t("irSidebar.calendar.untitledPoint"),
		titleDetected: false,
	};
}

export function normalizeObsidianBlockId(raw: string | null | undefined): string | null {
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
	segment: ParagraphWorkbenchSegment | null | undefined
): string | null {
	if (!segment) {
		return null;
	}
	const fromContent = extractObsidianBlockIdFromText(segment.text);
	if (fromContent) {
		return fromContent;
	}
	return normalizeObsidianBlockId(segment.id);
}

export function generateObsidianBlockId(prefix = "ir_"): string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
	let suffix = "";
	for (let i = 0; i < 8; i++) {
		suffix += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	const normalizedPrefix = String(prefix || "ir_").trim() || "ir_";
	return normalizedPrefix.endsWith("_") ? `${normalizedPrefix}${suffix}` : `${normalizedPrefix}_${suffix}`;
}

export function extractWikiLinkTarget(raw: string): string {
	const match = String(raw || "").trim().match(WIKI_LINK_INNER_REGEX);
	if (!match?.[1]) {
		return "";
	}
	return match[1].split("|")[0]?.trim() || "";
}

export function buildObsidianBlockResumeLink(sourcePath: string, blockId: string, alias?: string): string {
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
	alias?: string
): string {
	const normalizedPath = normalizePath(String(sourcePath || "").trim());
	const normalizedBlockId = formatObsidianBlockId(blockId);
	if (!normalizedPath || !normalizedBlockId) {
		return "";
	}
	const base = `${normalizedPath}${normalizedBlockId.startsWith("#") ? "" : `#${normalizedBlockId}`}`;
	const trimmedAlias = String(alias || "").trim();
	return trimmedAlias ? `[[${base}|${trimmedAlias}]]` : `[[${base}]]`;
}

export function buildObsidianEmbedBlockWikiLink(sourcePath: string, blockId: string, alias?: string): string {
	const link = buildObsidianBlockWikiLink(sourcePath, blockId, alias);
	return link ? `!${link}` : "";
}

export function buildCanvasNodeWikiLink(
	canvasPath: string,
	nodeId: string,
	alias?: string
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

export function buildCanvasNodeEmbedWikiLink(canvasPath: string, nodeId: string, alias?: string): string {
	const link = buildCanvasNodeWikiLink(canvasPath, nodeId, alias);
	return link ? `!${link}` : "";
}

export function blockReferencesObsidianId(block: { notes?: string }, blockId: string): boolean {
	const normalized = normalizeObsidianBlockId(blockId);
	if (!normalized) {
		return false;
	}
	const notes = String(block.notes || "");
	return notes.includes(`#^${normalized}`) || notes.includes(`^${normalized}`);
}

export function findDuplicateBlockForSegment(
	blocks: Array<{ id: string; startLine?: number; endLine?: number; notes?: string }>,
	segment: ParagraphWorkbenchSegment,
	obsidianBlockId?: string | null
): { id: string; startLine?: number; endLine?: number; notes?: string } | undefined {
	const normalizedBlockId = normalizeObsidianBlockId(obsidianBlockId || extractObsidianBlockIdFromSegment(segment));
	if (normalizedBlockId) {
		const byBlockId = blocks.find((block) => blockReferencesObsidianId(block, normalizedBlockId));
		if (byBlockId) {
			return byBlockId;
		}
	}

	const startLine =
		typeof segment.metadata?.startLine === "number" ? Number(segment.metadata.startLine) : 0;
	const endLine =
		typeof segment.metadata?.endLine === "number"
			? Number(segment.metadata.endLine)
			: startLine;

	return blocks.find(
		(block) =>
			block.startLine === startLine &&
			(typeof block.endLine !== "number" || block.endLine === endLine)
	);
}

function readSegmentLineRange(segment: ParagraphWorkbenchSegment): { startLine: number; endLine: number } {
	const startLine =
		typeof segment.metadata?.startLine === "number" ? Number(segment.metadata.startLine) : 0;
	const endLine =
		typeof segment.metadata?.endLine === "number"
			? Number(segment.metadata.endLine)
			: startLine;
	return {
		startLine: Math.max(0, startLine),
		endLine: Math.max(startLine, endLine),
	};
}

export async function ensureSegmentBlockIdInSourceFile(
	app: App,
	sourcePath: string,
	segment: ParagraphWorkbenchSegment
): Promise<string> {
	const normalizedPath = normalizePath(String(sourcePath || "").trim());
	const file = app.vault.getAbstractFileByPath(normalizedPath);
	if (!(file instanceof TFile)) {
		throw new Error("paragraph-workbench-source-file-missing");
	}

	const existing = extractObsidianBlockIdFromSegment(segment);
	if (existing) {
		return existing;
	}

	const content = await app.vault.read(file);
	const lines = content.split(/\r\n?/);
	const { endLine } = readSegmentLineRange(segment);
	const targetLineIndex = Math.min(Math.max(endLine, 0), Math.max(lines.length - 1, 0));
	const blockId = generateObsidianBlockId();
	const currentLine = lines[targetLineIndex] ?? "";

	if (OBSIDIAN_BLOCK_ID_LINE_REGEX.test(currentLine)) {
		const matched = extractObsidianBlockIdFromText(currentLine);
		if (matched) {
			return matched;
		}
	}

	const trimmedLine = currentLine.replace(/\s+$/, "");
	lines[targetLineIndex] = trimmedLine ? `${trimmedLine} ^${blockId}` : `^${blockId}`;
	await app.vault.modify(file, lines.join("\n"));

	logger.debug(
		`[paragraph-block-reference] inserted block id ^${blockId} at ${normalizedPath}:${targetLineIndex + 1}`
	);
	return blockId;
}

export function resolveParagraphWorkbenchSourcePath(
	sessionSourcePath: string,
	editorSourcePath?: string | null
): string {
	const sessionPath = normalizePath(String(sessionSourcePath || "").trim());
	if (sessionPath) {
		return sessionPath;
	}
	return normalizePath(String(editorSourcePath || "").trim());
}
