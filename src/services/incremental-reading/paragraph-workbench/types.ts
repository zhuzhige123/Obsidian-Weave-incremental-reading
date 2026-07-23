export type ParagraphWorkbenchSourceType =
	| "epub"
	| "markdown"
	| "canvas"
	| "ir-point";

export interface ParagraphWorkbenchSegment {
	id: string;
	index: number;
	title?: string;
	chapterTitle?: string;
	text: string;
	html?: string;
	sourceLink?: string;
	metadata?: Record<string, unknown>;
}

export interface ParagraphWorkbenchSession {
	sourceType: ParagraphWorkbenchSourceType;
	sourcePath: string;
	displayTitle?: string;
	topicId?: string;
	topicName?: string;
	pointId?: string;
	segments: ParagraphWorkbenchSegment[];
	currentIndex: number;
	bookPercent?: number;
	remainingMs?: number;
	queueDone?: number;
	queueTotal?: number;
}

export interface ParagraphWorkbenchOpenInput {
	sourceType: ParagraphWorkbenchSourceType;
	sourcePath: string;
	segmentIndex?: number;
	topicId?: string;
	topicName?: string;
	pointId?: string;
	canvasNodeId?: string;
	/** EPUB-only: CFI range for initial paragraph anchor. */
	epubCfi?: string;
}

/** Prefill payload for AddReadingTargetModal from the current workbench segment. */
export interface ParagraphWorkbenchReadingTargetDraft {
	link: string;
	title: string;
	deckId?: string;
	canvasTextCandidates?: string[];
}

export interface ParagraphWorkbenchDisplay {
	bookPercent: number;
	segmentIndex: number;
	segmentTotal: number;
	estimatedBookMinutes?: number;
	estimatedBlockMinutes?: number;
	topicName?: string;
	queueDone?: number;
	queueTotal?: number;
	postponeMinutes?: number;
}

export interface EpubParagraphWorkbenchSnapshot {
	filePath: string;
	bookTitle?: string;
	chapterTitle?: string;
	paragraphIndex: number;
	paragraphTotal: number;
	paragraphId: string;
	paragraphText: string;
	paragraphHtml?: string;
	cfiRange?: string;
	chapterHref?: string;
	bookPercent: number;
	remainingBookMs?: number;
}

export interface EpubParagraphWorkbenchBridge {
	getSnapshot: (filePath: string) => EpubParagraphWorkbenchSnapshot | null;
	navigateRelative: (filePath: string, direction: -1 | 1) => Promise<boolean>;
	isParagraphModeActive: (filePath: string) => boolean;
}
