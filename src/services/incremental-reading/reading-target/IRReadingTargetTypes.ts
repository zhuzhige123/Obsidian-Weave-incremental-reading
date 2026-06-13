export type IRReadingTargetKind =
	| "web"
	| "vault-block"
	| "vault-link"
	| "vault-file"
	| "pdf"
	| "pdf-batch"
	| "epub"
	| "unknown";

export interface ParsedReadingTarget {
	kind: IRReadingTargetKind;
	rawInput: string;
	resumeLink: string;
	displayLink?: string;
	sourceFilePath?: string;
	blockId?: string;
	alias?: string;
	titleHint?: string;
	webUrl?: string;
	pdfPath?: string;
	pdfPoints?: Array<{ title: string; resumeLink: string; pdfPath: string }>;
	epubCfi?: string;
	epubSourceId?: string;
	epubChapter?: number;
	epubTocHref?: string;
	epubResumeLink?: string;
	validationError?: string;
}

export interface IRReadingTargetSchedulePin {
	nextRepDate: number;
	dateKey: string;
}

export interface IRReadingTargetAddInput {
	title: string;
	deckId: string;
	target: ParsedReadingTarget;
	scheduleDate: Date;
	priorityUi?: number;
	createNote?: boolean;
	appendSourceBacklink?: boolean;
	noteFolderPath?: string;
}

export interface IRReadingTargetAddResult {
	createdIds: string[];
	kind: IRReadingTargetKind;
	deckName: string;
}

export interface IRReadingTargetAddPreferences {
	inboxDeckId?: string;
	lastDeckId?: string;
	appendSourceBacklink?: boolean;
	defaultNoteBacked?: boolean;
	selectionQuickCreateLastFolder?: string;
}
