export type IRReadingTargetKind =
	| "web"
	| "vault-block"
	| "vault-link"
	| "vault-file"
	| "pdf"
	| "pdf-batch"
	| "epub"
	| "canvas"
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
	canvasNodeId?: string;
	canvasTextCandidates?: string[];
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
	/** Optional parent reading point for content-split hierarchy. */
	parentPointId?: string | null;
}

/** created = 新建；updated = 复用并改排期/专题；existing = 已存在且无实质变更（service 已提示） */
export type IRReadingTargetAddOutcome = "created" | "updated" | "existing";

export interface IRReadingTargetAddResult {
	createdIds: string[];
	kind: IRReadingTargetKind;
	deckName: string;
	outcome: IRReadingTargetAddOutcome;
	/** 首次阅读 pin 日期（YYYY-MM-DD），供月历定向刷新 */
	pinDateKey: string;
}

/** Vault 目标才支持「创建阅读笔记」；web 固定走笔记路径，media 走各自写路径 */
export function supportsReadingTargetCreateNote(
	kind: IRReadingTargetKind,
): boolean {
	return kind === "vault-block" || kind === "vault-link" || kind === "vault-file";
}

export interface IRReadingTargetAddPreferences {
	inboxDeckId?: string;
	lastDeckId?: string;
	appendSourceBacklink?: boolean;
	defaultNoteBacked?: boolean;
	selectionQuickCreateLastFolder?: string;
}
