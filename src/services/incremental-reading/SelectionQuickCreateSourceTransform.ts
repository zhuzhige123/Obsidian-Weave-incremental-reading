export interface SelectionQuickCreateRange {
	from: { line: number; ch: number };
	to: { line: number; ch: number };
}

type OrderedSelectionQuickCreateRange = {
	start: { line: number; ch: number };
	end: { line: number; ch: number };
};

function normalizeMarkdownContent(content: string): string {
	return String(content || "").replace(/\r\n?/g, "\n");
}

function compareEditorPosition(
	left: { line: number; ch: number },
	right: { line: number; ch: number }
): number {
	if (left.line !== right.line) {
		return left.line - right.line;
	}
	return left.ch - right.ch;
}

function orderSelectionRange(
	selectionRange: SelectionQuickCreateRange
): OrderedSelectionQuickCreateRange {
	return compareEditorPosition(selectionRange.from, selectionRange.to) <= 0
		? { start: selectionRange.from, end: selectionRange.to }
		: { start: selectionRange.to, end: selectionRange.from };
}

export function editorPositionToOffset(
	content: string,
	position: { line: number; ch: number }
): number {
	const normalized = normalizeMarkdownContent(content);
	const lines = normalized.split("\n");
	if (lines.length === 0) {
		return 0;
	}

	const targetLine = Math.max(0, Math.min(position.line, lines.length - 1));
	let offset = 0;
	for (let lineIndex = 0; lineIndex < targetLine; lineIndex++) {
		offset += lines[lineIndex].length + 1;
	}

	const lineText = lines[targetLine] ?? "";
	return Math.min(
		offset + Math.max(0, Math.min(position.ch, lineText.length)),
		normalized.length
	);
}

function replaceWholeLineSelectionInMarkdownContent(
	content: string,
	selectionRange: SelectionQuickCreateRange,
	replacement: string
): string {
	const normalized = normalizeMarkdownContent(content);
	const lines = normalized.split("\n");
	if (lines.length === 0) {
		return normalized;
	}

	const { start, end } = orderSelectionRange(selectionRange);
	const startLine = Math.max(0, Math.min(start.line, lines.length - 1));
	const endLine = Math.max(0, Math.min(end.line, lines.length - 1));
	const startLineText = lines[startLine] ?? "";
	const endLineText = lines[endLine] ?? "";

	const blockStartOffset = editorPositionToOffset(normalized, { line: startLine, ch: 0 });
	let blockEndOffset = editorPositionToOffset(normalized, {
		line: endLine,
		ch: endLineText.length,
	});
	if (normalized[blockEndOffset] === "\n") {
		blockEndOffset += 1;
	}

	const before = normalized.slice(0, blockStartOffset).replace(/\n{3,}$/g, "\n\n");
	const after = normalized.slice(blockEndOffset).replace(/^\n{3,}/g, "\n\n");
	const lineIndent = (startLineText.match(/^\s*/) || [""])[0];
	const replacementLine = `${lineIndent}${String(replacement || "").trim()}`;

	let nextContent = before;
	if (nextContent && !nextContent.endsWith("\n")) {
		nextContent += "\n";
	}

	nextContent += replacementLine;

	if (after) {
		if (!after.startsWith("\n")) {
			nextContent += "\n";
		}
		nextContent += after;
	}

	return nextContent;
}

export function replaceSelectionInMarkdownContent(
	content: string,
	selectionRange: SelectionQuickCreateRange | null,
	replacement: string
): string {
	const normalized = normalizeMarkdownContent(content);
	if (!selectionRange) {
		return normalized;
	}

	const lines = normalized.split("\n");
	const { start, end } = orderSelectionRange(selectionRange);
	const endLineText = lines[Math.max(0, Math.min(end.line, lines.length - 1))] ?? "";
	const isWholeLineSelection = start.ch === 0 && end.ch >= endLineText.length;

	if (isWholeLineSelection) {
		return replaceWholeLineSelectionInMarkdownContent(normalized, selectionRange, replacement);
	}

	const startOffset = editorPositionToOffset(normalized, start);
	const endOffset = editorPositionToOffset(normalized, end);

	return `${normalized.slice(0, startOffset)}${replacement}${normalized.slice(endOffset)}`;
}
