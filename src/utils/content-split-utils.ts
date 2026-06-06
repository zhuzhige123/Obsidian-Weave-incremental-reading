/**
 * 内容拆分工具函数
 *
 * 提供规则拆分和手动标记解析功能
 *
 * @module utils/content-split-utils
 * @version 1.0.0
 */

import type { ContentBlock, RuleSplitConfig } from "../types/content-split-types";
import { SPLIT_MARKER_REGEX, generateSplitMarkerId } from "../types/content-split-types";
import { extractBodyContent, parseYAMLFromContent } from "./yaml-utils";

interface LineSegment {
	text: string;
	start: number;
	nextStart: number;
}

function normalizeSplitContent(content: string): string {
	return extractBodyContent(content).replace(/\r\n?/g, "\n");
}

function extractHeadingText(line: string): string | null {
	const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
	return headingMatch ? headingMatch[1].trim() : null;
}

function sanitizeTitleLine(line: string): string {
	const cleaned = line
		.trim()
		.replace(/^>\s*/, "")
		.replace(/^[-*+]\s+/, "")
		.replace(/^\d+[.)]\s+/, "")
		.replace(/^\[[ xX]\]\s+/, "")
		.trim();

	if (!cleaned) {
		return "(无标题)";
	}

	return cleaned.length > 50 ? `${cleaned.substring(0, 50)}...` : cleaned;
}

function buildLineSegments(content: string): LineSegment[] {
	const lines = content.split("\n");
	const segments: LineSegment[] = [];
	let offset = 0;

	for (let i = 0; i < lines.length; i++) {
		const text = lines[i];
		const start = offset;
		const nextStart = start + text.length + (i < lines.length - 1 ? 1 : 0);
		segments.push({ text, start, nextStart });
		offset = nextStart;
	}

	return segments;
}

function normalizeBlockContent(rawBlockContent: string, config: RuleSplitConfig): string {
	let blockContent = rawBlockContent.replace(/\r\n?/g, "\n");

	if (config.enableSymbolSplit && config.splitSymbol.trim()) {
		const normalizedSymbol = config.splitSymbol.trim();
		blockContent = blockContent
			.split("\n")
			.filter((line) => line.trim() !== normalizedSymbol)
			.join("\n");
	}

	return blockContent.trim();
}

function extractTitle(content: string, preserveHeading: boolean): string {
	const lines = content.split("\n");
	let headingFallback: string | null = null;

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		const headingText = extractHeadingText(trimmed);
		if (headingText) {
			if (preserveHeading) {
				return headingText;
			}
			headingFallback = headingFallback || headingText;
			continue;
		}

		return sanitizeTitleLine(trimmed);
	}

	return headingFallback || "(无标题)";
}

export function deriveFileTitleFromContent(content: string, defaultTitle?: string): string {
	const yaml = parseYAMLFromContent(content);
	const yamlTitle = typeof yaml.title === "string" ? yaml.title.trim() : "";
	if (yamlTitle) return yamlTitle;

	const body = normalizeSplitContent(content);
	const lines = body.split("\n");
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		const headingTitle = extractHeadingText(trimmed);
		if (headingTitle) {
			return headingTitle;
		}
		break;
	}

	if (defaultTitle?.trim()) return defaultTitle.trim();

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		return sanitizeTitleLine(trimmed);
	}

	return "untitled";
}

/**
 * 根据规则拆分内容
 */
export function splitByRules(
	content: string,
	config: RuleSplitConfig,
	options?: { defaultTitle?: string }
): ContentBlock[] {
	const normalizedContent = normalizeSplitContent(content);
	if (!normalizedContent.trim()) {
		return [];
	}

	// 如果启用整个文件作为一个块，直接返回整个内容
	if (config.enableWholeFile) {
		const wholeContent = normalizedContent.trim();
		const title = deriveFileTitleFromContent(content, options?.defaultTitle);
		return [
			{
				id: generateSplitMarkerId(),
				title,
				content: wholeContent,
				charCount: wholeContent.length,
				startOffset: 0,
				endOffset: normalizedContent.length,
			},
		];
	}

	const splitPoints = new Set<number>([0]);
	const lineSegments = buildLineSegments(normalizedContent);
	const normalizedSymbol = config.enableSymbolSplit ? config.splitSymbol.trim() : "";

	for (let i = 0; i < lineSegments.length; i++) {
		const segment = lineSegments[i];
		const trimmed = segment.text.trim();

		// 按标题拆分
		if (config.enableHeadingSplit && config.headingLevels.length > 0) {
			const headingMatch = trimmed.match(/^(#{1,6})\s+/);
			if (headingMatch) {
				const level = headingMatch[1].length;
				if (config.headingLevels.includes(level) && segment.start > 0) {
					splitPoints.add(segment.start);
				}
			}
		}

		// 按空行拆分：在满足阈值的空行段之后开始新块
		if (config.enableBlankLineSplit && config.blankLineCount > 0 && trimmed === "") {
			let j = i;
			while (j < lineSegments.length && lineSegments[j].text.trim() === "") {
				j++;
			}
			const blankCount = j - i;
			if (blankCount >= config.blankLineCount && j < lineSegments.length) {
				splitPoints.add(lineSegments[j].start);
			}
			i = j - 1;
			continue;
		}

		// 按符号拆分：在分隔符下一行开始新块
		if (
			normalizedSymbol &&
			trimmed === normalizedSymbol &&
			segment.nextStart < normalizedContent.length
		) {
			splitPoints.add(segment.nextStart);
		}
	}

	splitPoints.add(normalizedContent.length);
	const sortedPoints = Array.from(splitPoints).sort((a, b) => a - b);

	const blocks: ContentBlock[] = [];
	for (let i = 0; i < sortedPoints.length - 1; i++) {
		const startOffset = sortedPoints[i];
		const endOffset = sortedPoints[i + 1];
		const blockContent = normalizeBlockContent(
			normalizedContent.substring(startOffset, endOffset),
			config
		);

		if (config.filterEmptyBlocks && !blockContent) {
			continue;
		}

		if (blockContent.length < config.minBlockCharCount) {
			continue;
		}

		blocks.push({
			id: generateSplitMarkerId(),
			title: extractTitle(blockContent, config.preserveHeadingAsTitle),
			content: blockContent,
			charCount: blockContent.length,
			startOffset,
			endOffset,
		});
	}

	return blocks;
}

/**
 * 解析手动拆分标记
 */
export function parseManualSplitMarkers(content: string): ContentBlock[] {
	const normalizedContent = normalizeSplitContent(content);
	if (!normalizedContent.trim()) {
		return [];
	}

	const markers: { index: number; marker: string }[] = [];
	let match: RegExpExecArray | null;

	const regex = new RegExp(SPLIT_MARKER_REGEX.source, "g");

	while ((match = regex.exec(normalizedContent)) !== null) {
		markers.push({
			index: match.index,
			marker: match[0],
		});
	}

	const splitPoints: number[] = [0];

	for (const { index, marker } of markers) {
		splitPoints.push(index + marker.length);
	}

	splitPoints.push(normalizedContent.length);

	const blocks: ContentBlock[] = [];

	for (let i = 0; i < splitPoints.length - 1; i++) {
		const startOffset = splitPoints[i];
		let endOffset = splitPoints[i + 1];

		if (i < markers.length) {
			endOffset = markers[i].index;
		}

		let blockContent = normalizedContent.substring(startOffset, endOffset).trim();
		blockContent = blockContent.replace(SPLIT_MARKER_REGEX, "").trim();

		if (!blockContent) {
			continue;
		}

		blocks.push({
			id: generateSplitMarkerId(),
			title: extractTitle(blockContent, true),
			content: blockContent,
			charCount: blockContent.length,
			startOffset,
			endOffset,
		});
	}

	if (markers.length > 0) {
		const lastMarker = markers[markers.length - 1];
		const lastStartOffset = lastMarker.index + lastMarker.marker.length;
		const lastContent = normalizedContent.substring(lastStartOffset).trim();

		if (lastContent) {
			const alreadyAdded = blocks.some(
				(b) => b.content === lastContent || b.startOffset === lastStartOffset
			);

			if (!alreadyAdded) {
				blocks.push({
					id: generateSplitMarkerId(),
					title: extractTitle(lastContent, true),
					content: lastContent,
					charCount: lastContent.length,
					startOffset: lastStartOffset,
					endOffset: normalizedContent.length,
				});
			}
		}
	}

	return blocks;
}

/**
 * 将内容块转换为带标记的内容
 */
export function blocksToMarkedContent(originalContent: string, blocks: ContentBlock[]): string {
	if (blocks.length <= 1) {
		return originalContent;
	}

	let result = "";

	for (let i = 0; i < blocks.length; i++) {
		result += blocks[i].content;

		// 在块之间添加标记（除了最后一块）
		if (i < blocks.length - 1) {
			result += `\n\n<!-- weave-ir: ir-${blocks[i].id} -->\n\n`;
		}
	}

	return result;
}
