import type { App, CachedMetadata, TFile } from "obsidian";

export interface MarkdownBlockFocusRange {
	/** Inclusive, 0-based editor line. */
	fromLine: number;
	/** Inclusive, 0-based editor line. */
	toLine: number;
}

export interface MarkdownBlockFocusTarget {
	blockId?: string | null;
	/** Heading / line / block fragment from resume link (without leading #/^). */
	fragment?: string | null;
	startLine?: number | null;
	endLine?: number | null;
}

function clampLine(line: number, lineCount: number): number {
	if (!Number.isFinite(line)) {
		return 0;
	}
	const floored = Math.max(0, Math.floor(line));
	// When lineCount is unknown/underestimated, keep the metadata line as-is.
	if (lineCount <= 1) {
		return floored;
	}
	return Math.min(lineCount - 1, floored);
}

function normalizeHeadingKey(value: string): string {
	return String(value || "")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, " ");
}

function rangesEqual(
	a: MarkdownBlockFocusRange | null | undefined,
	b: MarkdownBlockFocusRange | null | undefined,
): boolean {
	if (!a && !b) {
		return true;
	}
	if (!a || !b) {
		return false;
	}
	return a.fromLine === b.fromLine && a.toLine === b.toLine;
}

function resolveBlockIdRange(
	cache: CachedMetadata | null | undefined,
	blockId: string,
	lineCount: number,
): MarkdownBlockFocusRange | null {
	const normalizedId = String(blockId || "").trim();
	if (!normalizedId || !cache?.blocks) {
		return null;
	}
	const block =
		cache.blocks[normalizedId] ||
		cache.blocks[normalizedId.toLowerCase()] ||
		null;
	if (!block?.position) {
		return null;
	}
	const fromLine = clampLine(block.position.start.line, lineCount);
	const toLine = clampLine(block.position.end.line, lineCount);
	return {
		fromLine: Math.min(fromLine, toLine),
		toLine: Math.max(fromLine, toLine),
	};
}

function resolveHeadingRange(
	cache: CachedMetadata | null | undefined,
	headingText: string,
	lineCount: number,
): MarkdownBlockFocusRange | null {
	const target = normalizeHeadingKey(headingText);
	if (!target || !cache?.headings?.length) {
		return null;
	}

	const headings = cache.headings;
	let index = headings.findIndex(
		(heading) => normalizeHeadingKey(heading.heading) === target,
	);
	if (index < 0) {
		index = headings.findIndex((heading) =>
			normalizeHeadingKey(heading.heading).includes(target),
		);
	}
	if (index < 0) {
		return null;
	}

	return resolveHeadingIndexRange(cache, index, lineCount);
}

function resolveHeadingIndexRange(
	cache: CachedMetadata,
	index: number,
	lineCount: number,
): MarkdownBlockFocusRange | null {
	const headings = cache.headings;
	if (!headings?.length || index < 0 || index >= headings.length) {
		return null;
	}
	const current = headings[index];
	const fromLine = clampLine(current.position.start.line, lineCount);
	let toLine = Math.max(0, lineCount - 1);
	for (let i = index + 1; i < headings.length; i += 1) {
		const next = headings[i];
		if (next.level <= current.level) {
			toLine = clampLine(next.position.start.line - 1, lineCount);
			break;
		}
	}
	if (lineCount <= 1) {
		const lastSectionEnd = cache.sections?.at(-1)?.position.end.line;
		if (typeof lastSectionEnd === "number") {
			toLine = Math.max(toLine, lastSectionEnd);
		}
	}
	return {
		fromLine: Math.min(fromLine, toLine),
		toLine: Math.max(fromLine, toLine),
	};
}

function resolveHeadingRangeAtLine(
	cache: CachedMetadata | null | undefined,
	line: number,
	lineCount: number,
): MarkdownBlockFocusRange | null {
	const headings = cache?.headings;
	if (!headings?.length || !cache) {
		return null;
	}
	let index = -1;
	for (let i = 0; i < headings.length; i += 1) {
		if (headings[i].position.start.line <= line) {
			index = i;
		} else {
			break;
		}
	}
	if (index < 0) {
		return null;
	}
	return resolveHeadingIndexRange(cache, index, lineCount);
}

function resolveExplicitLineRange(
	startLine: number | null | undefined,
	endLine: number | null | undefined,
	lineCount: number,
): MarkdownBlockFocusRange | null {
	if (typeof startLine !== "number" || !Number.isFinite(startLine)) {
		return null;
	}
	const fromLine = clampLine(startLine, lineCount);
	const toLine = clampLine(
		typeof endLine === "number" && Number.isFinite(endLine)
			? endLine
			: startLine,
		lineCount,
	);
	return {
		fromLine: Math.min(fromLine, toLine),
		toLine: Math.max(fromLine, toLine),
	};
}

function resolveLineNumberFragment(
	fragment: string,
	lineCount: number,
): MarkdownBlockFocusRange | null {
	const match = String(fragment || "")
		.trim()
		.match(/^L?(\d+)(?:-L?(\d+))?$/i);
	if (!match) {
		return null;
	}
	const start = Number(match[1]) - 1;
	const end = match[2] ? Number(match[2]) - 1 : start;
	return resolveExplicitLineRange(start, end, lineCount);
}

/**
 * Blank-line separated paragraph around a line (fallback when metadata is thin).
 */
export function resolveBlankLineSeparatedBlockAtLine(
	content: string,
	line: number,
): MarkdownBlockFocusRange {
	const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
	if (lines.length === 0) {
		return { fromLine: 0, toLine: 0 };
	}
	let anchor = Math.max(0, Math.min(lines.length - 1, Math.floor(line)));
	if (!lines[anchor]?.trim()) {
		let below = anchor + 1;
		while (below < lines.length && !lines[below]?.trim()) {
			below += 1;
		}
		if (below < lines.length) {
			anchor = below;
		} else {
			let above = anchor - 1;
			while (above >= 0 && !lines[above]?.trim()) {
				above -= 1;
			}
			if (above >= 0) {
				anchor = above;
			} else {
				return { fromLine: anchor, toLine: anchor };
			}
		}
	}

	let fromLine = anchor;
	while (fromLine > 0 && lines[fromLine - 1]?.trim()) {
		fromLine -= 1;
	}
	let toLine = anchor;
	while (toLine < lines.length - 1 && lines[toLine + 1]?.trim()) {
		toLine += 1;
	}
	return { fromLine, toLine };
}

/**
 * Resolve the semantic markdown block (section / heading section / paragraph)
 * that contains the given 0-based line.
 */
export function resolveSemanticBlockRangeAtLine(
	app: App,
	file: TFile,
	line: number,
	options?: {
		lineCount?: number;
		content?: string;
	},
): MarkdownBlockFocusRange | null {
	const cache = app.metadataCache.getFileCache(file);
	const lineCount =
		typeof options?.lineCount === "number" && Number.isFinite(options.lineCount)
			? Math.max(0, Math.floor(options.lineCount))
			: Math.max(
					(cache?.sections?.at(-1)?.position.end.line ?? 0) + 1,
					(cache?.headings?.at(-1)?.position.end.line ?? 0) + 1,
					1,
			  );
	const targetLine = clampLine(line, lineCount);

	const sections = cache?.sections;
	if (sections?.length) {
		const section = sections.find(
			(entry) =>
				entry.position.start.line <= targetLine &&
				entry.position.end.line >= targetLine,
		);
		if (section) {
			if (section.type === "heading") {
				const headingRange = resolveHeadingRangeAtLine(
					cache,
					targetLine,
					lineCount,
				);
				if (headingRange) {
					return headingRange;
				}
			}
			// Keep callout / list / code / paragraph as their own focus unit.
			const fromLine = clampLine(section.position.start.line, lineCount);
			const toLine = clampLine(section.position.end.line, lineCount);
			return {
				fromLine: Math.min(fromLine, toLine),
				toLine: Math.max(fromLine, toLine),
			};
		}
	}

	const headingRange = resolveHeadingRangeAtLine(cache, targetLine, lineCount);
	if (headingRange) {
		return headingRange;
	}

	if (typeof options?.content === "string") {
		return resolveBlankLineSeparatedBlockAtLine(options.content, targetLine);
	}

	return { fromLine: targetLine, toLine: targetLine };
}

/**
 * Resolve the inclusive line range that should stay fully visible in focus mode.
 */
export function resolveMarkdownBlockFocusRange(
	app: App,
	file: TFile,
	target: MarkdownBlockFocusTarget,
	lineCountHint?: number,
): MarkdownBlockFocusRange | null {
	const lineCount =
		typeof lineCountHint === "number" && Number.isFinite(lineCountHint)
			? Math.max(0, Math.floor(lineCountHint))
			: 0;
	const cache = app.metadataCache.getFileCache(file);

	const explicit = resolveExplicitLineRange(
		target.startLine,
		target.endLine,
		Math.max(lineCount, (cache?.sections?.at(-1)?.position.end.line ?? 0) + 1),
	);
	if (explicit) {
		return explicit;
	}

	const effectiveLineCount = Math.max(
		lineCount,
		(cache?.sections?.at(-1)?.position.end.line ?? 0) + 1,
		(cache?.headings?.at(-1)?.position.end.line ?? 0) + 1,
		1,
	);

	if (target.blockId) {
		const byBlock = resolveBlockIdRange(
			cache,
			target.blockId,
			effectiveLineCount,
		);
		if (byBlock) {
			return byBlock;
		}
	}

	const fragment = String(target.fragment || "").trim();
	if (!fragment) {
		return null;
	}

	if (fragment.startsWith("^")) {
		return resolveBlockIdRange(cache, fragment.slice(1), effectiveLineCount);
	}

	const byLine = resolveLineNumberFragment(fragment, effectiveLineCount);
	if (byLine) {
		return byLine;
	}

	return resolveHeadingRange(cache, fragment, effectiveLineCount);
}

export function extractFocusFragmentFromResumeLink(resumeLink: string): string {
	const raw = String(resumeLink || "").trim();
	if (!raw) {
		return "";
	}
	const hashIndex = raw.indexOf("#");
	if (hashIndex < 0) {
		return "";
	}
	return raw
		.slice(hashIndex + 1)
		.split("|")[0]
		.trim();
}

export { rangesEqual };
