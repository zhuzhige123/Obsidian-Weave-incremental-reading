import type { App } from "obsidian";
import { Notice } from "obsidian";
import { resolveEpubHost } from "../../epub-integration/epub-host";
import {
	buildParagraphWorkbenchDisplay,
	normalizeParagraphPriorityLevel,
	normalizeParagraphScheduleIntervalDays,
	type ParagraphPriorityLevel,
	type ParagraphScheduleIntervalDays,
} from "./paragraph-reading-shell";
import {
	createParagraphWorkbenchSession,
	getCurrentWorkbenchSegment,
	navigateParagraphWorkbenchSession,
} from "./paragraph-content-providers";
import type { ParagraphWorkbenchOpenInput, ParagraphWorkbenchSession } from "./types";
import { logger } from "../../../utils/logger";

export class ParagraphWorkbenchService {
	private session: ParagraphWorkbenchSession | null = null;
	private priorityLevel: ParagraphPriorityLevel = 2;
	private scheduleIntervalDays: ParagraphScheduleIntervalDays = 7;

	constructor(private readonly app: App) {}

	getSession(): ParagraphWorkbenchSession | null {
		return this.session;
	}

	getDisplay() {
		if (!this.session) {
			return null;
		}
		return buildParagraphWorkbenchDisplay({
			bookPercent: this.session.bookPercent ?? 0,
			segmentIndex: this.session.currentIndex,
			segmentTotal: this.session.segments.length,
			remainingMs: this.session.remainingMs,
			topicName: this.session.topicName,
			queueDone: this.session.queueDone,
			queueTotal: this.session.queueTotal,
		});
	}

	getPriorityLevel(): ParagraphPriorityLevel {
		return this.priorityLevel;
	}

	getScheduleIntervalDays(): ParagraphScheduleIntervalDays {
		return this.scheduleIntervalDays;
	}

	setPriorityLevel(level: unknown): void {
		this.priorityLevel = normalizeParagraphPriorityLevel(level, this.priorityLevel);
	}

	setScheduleIntervalDays(days: unknown): void {
		this.scheduleIntervalDays = normalizeParagraphScheduleIntervalDays(days, this.scheduleIntervalDays);
	}

	async open(input: ParagraphWorkbenchOpenInput): Promise<ParagraphWorkbenchSession | null> {
		this.session = await createParagraphWorkbenchSession(this.app, input);
		return this.session;
	}

	async navigateRelative(direction: -1 | 1): Promise<ParagraphWorkbenchSession | null> {
		if (!this.session) {
			return null;
		}
		const next = await navigateParagraphWorkbenchSession(this.app, this.session, direction);
		if (next) {
			this.session = next;
		}
		return this.session;
	}

	async pushNextSegment(): Promise<ParagraphWorkbenchSession | null> {
		return this.navigateRelative(1);
	}

	getCurrentSegmentText(): string {
		return getCurrentWorkbenchSegment(this.session)?.text ?? "";
	}

	async applyPostpone(noticeSuccess: string, noticeFailed: string): Promise<boolean> {
		if (!this.session || this.session.sourceType !== "epub") {
			new Notice(noticeFailed);
			return false;
		}
		const segment = getCurrentWorkbenchSegment(this.session);
		const cfi = String(segment?.metadata?.cfiRange || segment?.sourceLink || "").trim();
		if (!cfi) {
			new Notice(noticeFailed);
			return false;
		}
		try {
			const host = resolveEpubHost(this.app);
			await host?.markEpubResumePointFromReader?.({
				filePath: this.session.sourcePath,
				cfi,
				chapterHref: String(segment?.metadata?.chapterHref || ""),
				chapterTitle: String(segment?.chapterTitle || ""),
				deckId: this.session.topicId,
			});
			new Notice(noticeSuccess);
			return true;
		} catch (error) {
			logger.warn("[ParagraphWorkbenchService] postpone failed:", error);
			new Notice(noticeFailed);
			return false;
		}
	}

	applyPriority(notice: string): void {
		new Notice(notice);
	}

	applyScheduleInterval(notice: string): void {
		new Notice(notice);
	}

	archive(notice: string): void {
		new Notice(notice);
	}
}
