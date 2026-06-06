import { App, TFile, normalizePath } from "obsidian";
import { ParagraphParser } from "../ParagraphParser";
import { normalizeCanvasNodeId } from "../../ui/canvas-source-locate";
import {
	getEpubParagraphSnapshot,
	navigateEpubParagraphRelative,
} from "./epub-paragraph-bridge";
import type {
	ParagraphWorkbenchOpenInput,
	ParagraphWorkbenchSegment,
	ParagraphWorkbenchSession,
} from "./types";

type CanvasNodeRecord = {
	id?: string;
	type?: string;
	text?: string;
};

function normalizeSegmentIndex(index: number, total: number): number {
	if (total <= 0) {
		return 0;
	}
	return Math.max(0, Math.min(index, total - 1));
}

async function loadMarkdownSegments(app: App, filePath: string): Promise<ParagraphWorkbenchSegment[]> {
	const file = app.vault.getAbstractFileByPath(normalizePath(filePath));
	if (!(file instanceof TFile)) {
		return [];
	}
	const content = await app.vault.read(file);
	const parser = new ParagraphParser();
	const paragraphs = parser.parseDocument(content);
	return paragraphs.map((paragraph) => ({
		id: String(paragraph.anchorId || paragraph.index),
		index: paragraph.index,
		title: paragraph.headingText,
		text: paragraph.content,
		sourceLink: `${filePath}#${paragraph.anchorId || `line-${paragraph.startLine + 1}`}`,
		metadata: {
			startLine: paragraph.startLine,
			endLine: paragraph.endLine,
		},
	}));
}

async function loadCanvasSegments(
	app: App,
	filePath: string,
	canvasNodeId?: string
): Promise<ParagraphWorkbenchSegment[]> {
	const file = app.vault.getAbstractFileByPath(normalizePath(filePath));
	if (!(file instanceof TFile)) {
		return [];
	}
	let parsed: { nodes?: CanvasNodeRecord[] } | null = null;
	try {
		parsed = JSON.parse(await app.vault.read(file)) as { nodes?: CanvasNodeRecord[] };
	} catch {
		return [];
	}
	const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
	const textNodes = nodes.filter((node) => node?.type === "text" && String(node.text || "").trim());
	const segments = textNodes.map((node, index) => ({
		id: normalizeCanvasNodeId(node.id) || String(index),
		index,
		title: undefined,
		text: String(node.text || "").trim(),
		sourceLink: `${filePath}?node=${encodeURIComponent(normalizeCanvasNodeId(node.id) || String(index))}`,
		metadata: {
			canvasNodeId: normalizeCanvasNodeId(node.id),
		},
	}));
	if (!canvasNodeId) {
		return segments;
	}
	const normalizedTarget = normalizeCanvasNodeId(canvasNodeId);
	const targetIndex = segments.findIndex(
		(segment) => normalizeCanvasNodeId(String(segment.metadata?.canvasNodeId || segment.id)) === normalizedTarget
	);
	if (targetIndex <= 0) {
		return segments;
	}
	return [...segments.slice(targetIndex), ...segments.slice(0, targetIndex)].map((segment, index) => ({
		...segment,
		index,
	}));
}

async function loadEpubSession(
	app: App,
	input: ParagraphWorkbenchOpenInput
): Promise<ParagraphWorkbenchSession | null> {
	const snapshot = getEpubParagraphSnapshot(app, input.sourcePath);
	if (!snapshot) {
		return null;
	}
	const segments: ParagraphWorkbenchSegment[] = Array.from({ length: snapshot.paragraphTotal }, (_, index) => {
		const isCurrent = index === snapshot.paragraphIndex;
		return {
			id: isCurrent ? snapshot.paragraphId : `epub-segment-${index}`,
			index,
			chapterTitle: snapshot.chapterTitle,
			title: snapshot.chapterTitle,
			text: isCurrent ? snapshot.paragraphText : "",
			html: isCurrent ? snapshot.paragraphHtml : undefined,
			sourceLink: snapshot.cfiRange,
			metadata: {
				cfiRange: isCurrent ? snapshot.cfiRange : undefined,
				chapterHref: snapshot.chapterHref,
			},
		};
	});
	return {
		sourceType: "epub",
		sourcePath: input.sourcePath,
		displayTitle: snapshot.bookTitle || input.sourcePath.split("/").pop(),
		topicId: input.topicId,
		topicName: input.topicName,
		pointId: input.pointId,
		segments,
		currentIndex: normalizeSegmentIndex(input.segmentIndex ?? snapshot.paragraphIndex, segments.length),
		bookPercent: snapshot.bookPercent,
		remainingMs: snapshot.remainingBookMs,
	};
}

export async function createParagraphWorkbenchSession(
	app: App,
	input: ParagraphWorkbenchOpenInput
): Promise<ParagraphWorkbenchSession | null> {
	const sourcePath = normalizePath(String(input.sourcePath || "").trim());
	if (!sourcePath) {
		return null;
	}

	if (input.sourceType === "epub") {
		return loadEpubSession(app, { ...input, sourcePath });
	}

	let segments: ParagraphWorkbenchSegment[] = [];
	if (input.sourceType === "markdown" || input.sourceType === "ir-point") {
		segments = await loadMarkdownSegments(app, sourcePath);
	} else if (input.sourceType === "canvas") {
		segments = await loadCanvasSegments(app, sourcePath, input.canvasNodeId);
	}

	if (segments.length === 0) {
		return null;
	}

	return {
		sourceType: input.sourceType,
		sourcePath,
		displayTitle: sourcePath.split("/").pop(),
		topicId: input.topicId,
		topicName: input.topicName,
		pointId: input.pointId,
		segments,
		currentIndex: normalizeSegmentIndex(input.segmentIndex ?? 0, segments.length),
		bookPercent: Math.round(((input.segmentIndex ?? 0) + 1) / segments.length * 100),
	};
}

export async function navigateParagraphWorkbenchSession(
	app: App,
	session: ParagraphWorkbenchSession,
	direction: -1 | 1
): Promise<ParagraphWorkbenchSession | null> {
	if (session.sourceType === "epub") {
		const moved = await navigateEpubParagraphRelative(app, session.sourcePath, direction);
		if (!moved) {
			return null;
		}
		return createParagraphWorkbenchSession(app, {
			sourceType: session.sourceType,
			sourcePath: session.sourcePath,
			topicId: session.topicId,
			topicName: session.topicName,
			pointId: session.pointId,
			segmentIndex: session.currentIndex + direction,
		});
	}

	const nextIndex = session.currentIndex + direction;
	if (nextIndex < 0 || nextIndex >= session.segments.length) {
		return null;
	}
	return {
		...session,
		currentIndex: nextIndex,
		bookPercent: Math.round(((nextIndex + 1) / session.segments.length) * 100),
	};
}

export function getCurrentWorkbenchSegment(
	session: ParagraphWorkbenchSession | null
): ParagraphWorkbenchSegment | null {
	if (!session || session.segments.length === 0) {
		return null;
	}
	return session.segments[normalizeSegmentIndex(session.currentIndex, session.segments.length)] ?? null;
}
