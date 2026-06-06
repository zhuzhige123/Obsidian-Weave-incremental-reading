/**
 * 提示块工具
 *
 * 默认使用原始引用提示语法：
 * >hint: 提示内容
 * > 第二行提示
 *
 * 同时兼容历史 we_tip callout 语法，避免旧卡片提示丢失。
 */

interface HintBlockMatch {
	hint: string;
	markdown: string;
	startLine: number;
	endLine: number;
}

const HINT_CALLOUT_TYPES = new Set(["we_tip", "we-tip"]);
const LEGACY_HINT_HEADER_REGEX = /^\s*>hint:\s*/i;
const HINT_CALLOUT_HEADER_REGEX = /^\s*>\s*\[!([\w-]+)\]([+-])?(?:\s+(.*))?\s*$/i;
const BLOCKQUOTE_LINE_REGEX = /^\s*>/;
const BLOCKQUOTE_CONTENT_REGEX = /^\s*>\s?/;

function normalizeLineEndings(text: string): string {
	return (text || "").replace(/\r\n?/g, "\n");
}

function isHintCalloutType(type: string): boolean {
	return HINT_CALLOUT_TYPES.has(type.toLowerCase());
}

function collectQuotedBlock(
	lines: string[],
	startLine: number
): { rawLines: string[]; endLine: number } {
	let endLine = startLine + 1;
	while (endLine < lines.length && BLOCKQUOTE_LINE_REGEX.test(lines[endLine])) {
		endLine++;
	}

	return {
		rawLines: lines.slice(startLine, endLine),
		endLine,
	};
}

function stripQuotePrefix(line: string): string {
	return line.replace(BLOCKQUOTE_CONTENT_REGEX, "");
}

function findHintBlock(content: string): HintBlockMatch | null {
	const normalized = normalizeLineEndings(content);
	const lines = normalized.split("\n");

	for (let index = 0; index < lines.length; index++) {
		if (LEGACY_HINT_HEADER_REGEX.test(lines[index])) {
			const { rawLines, endLine } = collectQuotedBlock(lines, index);
			const hint = rawLines
				.map((line, lineIndex) => {
					if (lineIndex === 0) {
						return line.replace(LEGACY_HINT_HEADER_REGEX, "").trim();
					}
					return stripQuotePrefix(line);
				})
				.join("\n")
				.trim();

			return {
				hint,
				markdown: buildHintBlock(hint),
				startLine: index,
				endLine,
			};
		}

		const calloutMatch = lines[index].match(HINT_CALLOUT_HEADER_REGEX);
		if (!calloutMatch || !isHintCalloutType(calloutMatch[1])) {
			continue;
		}

		const { rawLines, endLine } = collectQuotedBlock(lines, index);
		const hint = rawLines.slice(1).map(stripQuotePrefix).join("\n").trim();

		return {
			hint,
			markdown: buildHintBlock(hint),
			startLine: index,
			endLine,
		};
	}

	return null;
}

export function buildHintBlock(hint: string): string {
	const normalized = normalizeLineEndings(hint).trim();
	if (!normalized) {
		return "";
	}

	const lines = normalized.split("\n");
	const [firstLine, ...restLines] = lines;
	const quotedTail = restLines.map((line) => (line.length > 0 ? `> ${line}` : ">"));

	return [`>hint: ${firstLine}`, ...quotedTail].join("\n");
}

export function appendHintBlock(content: string, hint: string): string {
	const block = buildHintBlock(hint);
	const base = normalizeLineEndings(content).trim();

	if (!block) {
		return base;
	}

	if (!base) {
		return block;
	}

	return `${base}\n\n${block}`;
}

export function extractHintText(content: string): string {
	return findHintBlock(content)?.hint || "";
}

export function extractHintMarkdown(content: string): string {
	return findHintBlock(content)?.markdown || "";
}

export function stripHintBlock(content: string): string {
	const normalized = normalizeLineEndings(content);
	const match = findHintBlock(normalized);

	if (!match) {
		return normalized;
	}

	const lines = normalized.split("\n");
	return [...lines.slice(0, match.startLine), ...lines.slice(match.endLine)]
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.replace(/^\n+/, "")
		.replace(/\n+$/, "");
}
