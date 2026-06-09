import type { App } from "obsidian";
import { Notice } from "obsidian";
import { resolveEpubHost } from "../../epub-integration/epub-host";
import { IRParagraphAddToTopicModal } from "../../../modals/IRParagraphAddToTopicModal";
import { IRDeckManager } from "../IRDeckManager";
import { IREpubBookmarkTaskService } from "../IREpubBookmarkTaskService";
import { IRPointStorageService } from "../IRPointStorageService";
import { IRPointWriteService } from "../IRPointWriteService";
import { recomputeAndBroadcastIRData } from "../IRScheduleRefreshService";
import { IRStorageAdapterV4 } from "../IRStorageAdapterV4";
import { IRStorageService } from "../IRStorageService";
import { IRV4SchedulerService } from "../IRV4SchedulerService";
import { createDefaultIRBlock, generateIRBlockId, migrateToIRBlockV4 } from "../../../types/ir-types";
import { generateReadingUUID } from "../../../utils/reading-utils";
import {
	buildCanvasNodeEmbedWikiLink,
	buildObsidianEmbedBlockWikiLink,
	cleanParagraphBlockTitle,
	deriveSegmentTitleDraft,
	ensureSegmentBlockIdInSourceFile,
	extractObsidianBlockIdFromSegment,
	findDuplicateBlockForSegment,
	formatObsidianBlockId,
	resolveParagraphWorkbenchSourcePath,
} from "./paragraph-block-reference";
import {
	isWeaveMemoryHostAvailable,
	resolveWeaveMemoryHost,
} from "../../weave-integration/weave-memory-host";
import {
	estimateSegmentReadingSeconds,
	recordLegacyBlockInteraction,
	resolveTopicQueueProgress,
} from "./paragraph-workbench-queue";
import {
	buildParagraphWorkbenchDisplay,
	clampParagraphPriorityUi,
	normalizeParagraphScheduleIntervalDays,
	type ParagraphScheduleIntervalDays,
} from "./paragraph-reading-shell";
import {
	createParagraphWorkbenchSession,
	getCurrentWorkbenchSegment,
	navigateParagraphWorkbenchSession,
	reloadParagraphWorkbenchSession,
} from "./paragraph-content-providers";
import type { ParagraphWorkbenchOpenInput, ParagraphWorkbenchSession } from "./types";
import { logger } from "../../../utils/logger";
import { readString } from "../../../utils/unknown-record";
import { isDetachedEditorTempFilePath } from "../../editor/editor-temp-file-policy";

export class ParagraphWorkbenchService {
	private session: ParagraphWorkbenchSession | null = null;
	private priorityUi = 5;
	private scheduleIntervalDays: ParagraphScheduleIntervalDays = 7;
	private registeredPointId: string | null = null;

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

	getPriorityUi(): number {
		return this.priorityUi;
	}

	getScheduleIntervalDays(): ParagraphScheduleIntervalDays {
		return this.scheduleIntervalDays;
	}

	setPriorityUi(value: unknown): void {
		this.priorityUi = clampParagraphPriorityUi(value, this.priorityUi);
	}

	setScheduleIntervalDays(days: unknown): void {
		this.scheduleIntervalDays = normalizeParagraphScheduleIntervalDays(days, this.scheduleIntervalDays);
	}

	async open(input: ParagraphWorkbenchOpenInput): Promise<ParagraphWorkbenchSession | null> {
		this.session = await createParagraphWorkbenchSession(this.app, input);
		this.registeredPointId = input.pointId ?? null;
		await this.refreshSessionQueueProgress();
		if (!this.registeredPointId) {
			await this.resolvePointForCurrentSegment();
		}
		await this.syncPriorityFromRegisteredPoint();
		return this.session;
	}

	async navigateRelative(direction: -1 | 1): Promise<ParagraphWorkbenchSession | null> {
		if (!this.session) {
			return null;
		}
		const next = await navigateParagraphWorkbenchSession(this.app, this.session, direction);
		if (next) {
			this.session = next;
			this.registeredPointId = next.pointId ?? null;
			await this.resolvePointForCurrentSegment();
			await this.syncPriorityFromRegisteredPoint();
			await this.refreshSessionQueueProgress();
		}
		return this.session;
	}

	async pushNextSegment(): Promise<ParagraphWorkbenchSession | null> {
		await this.recordCurrentSegmentProgress();
		const next = await this.navigateRelative(1);
		if (next) {
			await recomputeAndBroadcastIRData(this.app, "complete_block", {
				deckIds: this.session?.topicId ? [this.session.topicId] : undefined,
			});
		}
		return this.session;
	}

	getCurrentSegmentText(): string {
		return getCurrentWorkbenchSegment(this.session)?.text ?? "";
	}

	getSelectedTextFromWorkbench(
		rootEl: HTMLElement | null,
		viewportEl?: HTMLElement | null
	): string {
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
			return "";
		}

		const range = selection.getRangeAt(0);
		const containers = [viewportEl, rootEl].filter(Boolean) as HTMLElement[];
		const isInsideWorkbench = containers.some((container) => {
			if (container.contains(range.commonAncestorContainer)) {
				return true;
			}
			const anchorNode = selection.anchorNode;
			const focusNode = selection.focusNode;
			return Boolean(
				(anchorNode && container.contains(anchorNode))
				|| (focusNode && container.contains(focusNode))
			);
		});
		if (!isInsideWorkbench) {
			return "";
		}

		return String(selection.toString() || "").replace(/\r\n?/g, "\n").trim();
	}

	async openAddToTopicModal(): Promise<ParagraphWorkbenchSession | null> {
		if (!this.session) {
			new Notice("请先打开段落阅读内容", 3000);
			return this.session;
		}

		const segment = getCurrentWorkbenchSegment(this.session);
		if (!segment) {
			new Notice("当前没有可添加的段落", 3000);
			return this.session;
		}

		try {
			const storage = new IRStorageService(this.app);
			await storage.initialize();
			const deckManager = new IRDeckManager(this.app, storage);
			const decks = Object.values(await storage.getAllDecks())
				.filter((deck) => !deck.archivedAt)
				.sort((left, right) => left.name.localeCompare(right.name));
			const draft = deriveSegmentTitleDraft(segment);

			await new Promise<void>((resolve) => {
				const modal = new IRParagraphAddToTopicModal(this.app, {
					deckOptions: decks,
					initialDeckId: this.session?.topicId,
					initialTitle: draft.title,
					titleDetected: draft.titleDetected,
					onCreateDeck: async (name) => await deckManager.createDeck(name),
					onSubmit: async (payload) => {
						await this.addCurrentSegmentToTopic(payload.deckId, payload.title);
					},
				});
				const originalOnClose = modal.onClose.bind(modal);
				modal.onClose = () => {
					originalOnClose();
					resolve();
				};
				modal.open();
			});
		} catch (error) {
			logger.error("[ParagraphWorkbenchService] openAddToTopicModal failed:", error);
			new Notice("打开专题选择失败，请重试", 3000);
		}

		return this.session;
	}

	async addCurrentSegmentToTopic(deckId: string, rawTitle: string): Promise<void> {
		if (!this.session) {
			throw new Error("paragraph-workbench-session-missing");
		}

		const segment = getCurrentWorkbenchSegment(this.session);
		if (!segment) {
			throw new Error("paragraph-workbench-segment-missing");
		}

		const sourcePath = resolveParagraphWorkbenchSourcePath(this.session.sourcePath);
		if (!sourcePath || isDetachedEditorTempFilePath(sourcePath)) {
			throw new Error("paragraph-workbench-invalid-source-path");
		}

		const title = cleanParagraphBlockTitle(rawTitle);
		if (!title) {
			new Notice("请输入阅读点标题", 3000);
			throw new Error("paragraph-workbench-title-empty");
		}

		const storage = new IRStorageService(this.app);
		await storage.initialize();
		const deck = await storage.getDeckById(deckId);
		if (!deck || deck.archivedAt) {
			new Notice("所选专题不存在或已归档", 3000);
			throw new Error("paragraph-workbench-deck-missing");
		}

		if (this.session.sourceType === "canvas") {
			await this.addCanvasSegmentToTopic(storage, deckId, deck.name, sourcePath, segment, title);
			return;
		}
		if (this.session.sourceType === "epub") {
			await this.addEpubSegmentToTopic(deckId, deck.name, sourcePath, segment, title);
			return;
		}

		const startLine =
			typeof segment.metadata?.startLine === "number" ? Number(segment.metadata.startLine) : 0;
		const endLine =
			typeof segment.metadata?.endLine === "number"
				? Number(segment.metadata.endLine)
				: startLine;

		let obsidianBlockId = extractObsidianBlockIdFromSegment(segment);
		const existingBlocks = await storage.getBlocksByFile(sourcePath);
		const duplicate = findDuplicateBlockForSegment(existingBlocks, segment, obsidianBlockId);
		if (duplicate) {
			await storage.addBlocksToDeck(deckId, [duplicate.id]);
			this.applyTopicToSession(deckId, deck.name, duplicate.id);
			await this.syncPriorityFromRegisteredPoint();
			await this.refreshSessionQueueProgress();
			new Notice(`当前段落已在专题「${deck.name}」中`, 3000);
			await recomputeAndBroadcastIRData(this.app, "import_materials", { deckIds: [deckId] });
			return;
		}

		obsidianBlockId = await ensureSegmentBlockIdInSourceFile(this.app, sourcePath, segment);
		await this.reloadCurrentSessionSegments();

		const blockRefLink = buildObsidianEmbedBlockWikiLink(sourcePath, obsidianBlockId, title);
		const blockId = generateIRBlockId();
		const headingPath = title ? [title] : [];
		const block = createDefaultIRBlock(blockId, sourcePath, headingPath, 0, startLine);
		block.endLine = endLine;
		block.headingText = title;
		block.contentPreview = String(segment.text || "")
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, 160);
		block.deckPath = deckId;
		block.notes = blockRefLink;
		block.priority = this.mapPriorityUiToLegacyPriority(this.priorityUi);
		block.priorityUi = this.priorityUi;
		block.priorityEff = this.priorityUi;

		await storage.saveBlock(block);
		await this.attachBlockToDeck(storage, deckId, sourcePath, block.id);

		this.applyTopicToSession(deckId, deck.name, block.id);
		await this.syncPriorityFromRegisteredPoint();
		await this.refreshSessionQueueProgress();
		await recomputeAndBroadcastIRData(this.app, "import_materials", { deckIds: [deckId] });
		new Notice(`已添加到专题「${deck.name}」`, 2500);
	}

	async createMemoryCardFromSelection(selectedText: string): Promise<boolean> {
		if (!this.session) {
			new Notice("请先打开段落阅读内容", 3000);
			return false;
		}

		const normalizedSelection = String(selectedText || "").replace(/\r\n?/g, "\n").trim();
		if (!normalizedSelection) {
			new Notice("请先选中要摘录的文本", 3000);
			return false;
		}

		if (!isWeaveMemoryHostAvailable(this.app)) {
			new Notice("请先安装并启用 Weave 主插件以创建记忆卡片", 4000);
			return false;
		}

		const sourcePath = resolveParagraphWorkbenchSourcePath(this.session.sourcePath);
		if (!sourcePath || isDetachedEditorTempFilePath(sourcePath)) {
			new Notice("无法识别源文档路径，制卡已取消", 3500);
			return false;
		}

		const segment = getCurrentWorkbenchSegment(this.session);
		if (!segment) {
			new Notice("当前段落不可用，制卡已取消", 3000);
			return false;
		}

		try {
			let obsidianBlockId = extractObsidianBlockIdFromSegment(segment);
			if (!obsidianBlockId && this.session.sourceType === "markdown") {
				obsidianBlockId = await ensureSegmentBlockIdInSourceFile(this.app, sourcePath, segment);
				await this.reloadCurrentSessionSegments();
			}

			const host = resolveWeaveMemoryHost(this.app);
			if (!host) {
				new Notice("请先安装并启用 Weave 主插件以创建记忆卡片", 4000);
				return false;
			}
			const cardMetadata: { sourceFile: string; sourceBlock?: string } = {
				sourceFile: sourcePath,
			};
			const formattedBlockId = formatObsidianBlockId(obsidianBlockId || "");
			if (formattedBlockId) {
				cardMetadata.sourceBlock = formattedBlockId;
			}

			await host.openCreateCardModal({
				initialContent: normalizedSelection,
				cardMetadata,
				onSuccess: () => {
					void (async () => {
						if (this.registeredPointId) {
							await this.incrementExtractStat(this.registeredPointId);
						}
						new Notice("记忆卡片已创建", 2500);
					})();
				},
			});

			return true;
		} catch (error) {
			logger.error("[ParagraphWorkbenchService] createMemoryCardFromSelection failed:", error);
			new Notice("创建记忆卡片失败，请重试", 3000);
			return false;
		}
	}

	async applyPostpone(noticeSuccess: string, noticeFailed: string): Promise<boolean> {
		if (!this.session || this.session.sourceType !== "epub") {
			new Notice(noticeFailed);
			return false;
		}
		const segment = getCurrentWorkbenchSegment(this.session);
		const cfi = readString(segment?.metadata?.cfiRange) || readString(segment?.sourceLink);
		if (!cfi) {
			new Notice(noticeFailed);
			return false;
		}
		try {
			const host = resolveEpubHost(this.app);
			await host?.markEpubResumePointFromReader?.({
				filePath: this.session.sourcePath,
				cfi,
				chapterHref: readString(segment?.metadata?.chapterHref),
				chapterTitle: readString(segment?.chapterTitle),
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

	async applyPriority(notice: string): Promise<void> {
		if (!this.registeredPointId || !this.session?.topicId) {
			new Notice("请先将当前段落添加到专题", 3000);
			return;
		}
		try {
			const storage = new IRStorageService(this.app);
			await storage.initialize();
			const blockRecord = await storage.getBlock(this.registeredPointId);
			if (!blockRecord) {
				new Notice(notice);
				return;
			}
			const adapter = new IRStorageAdapterV4(this.app, storage);
			const scheduler = new IRV4SchedulerService(this.app);
			await scheduler.initialize();
			const blockV4 =
				(await adapter.getBlockV4(this.registeredPointId)) || migrateToIRBlockV4(blockRecord);
			await scheduler.updatePriorityWithPreviewV4(
				blockV4,
				this.priorityUi,
				"paragraph_workbench",
				this.session.topicId
			);
			await recomputeAndBroadcastIRData(this.app, "change_priority", {
				deckIds: [this.session.topicId],
			});
			new Notice(notice);
		} catch (error) {
			logger.warn("[ParagraphWorkbenchService] applyPriority failed:", error);
			new Notice(notice);
		}
	}

	async applyScheduleInterval(notice: string): Promise<void> {
		if (!this.registeredPointId || !this.session?.topicId) {
			new Notice(notice);
			return;
		}
		try {
			const storage = new IRStorageService(this.app);
			await storage.initialize();
			const blockRecord = await storage.getBlock(this.registeredPointId);
			if (!blockRecord) {
				new Notice(notice);
				return;
			}
			const adapter = new IRStorageAdapterV4(this.app, storage);
			const scheduler = new IRV4SchedulerService(this.app);
			await scheduler.initialize();
			const blockV4 =
				(await adapter.getBlockV4(this.registeredPointId)) || migrateToIRBlockV4(blockRecord);
			const nextDate = new Date();
			nextDate.setHours(9, 0, 0, 0);
			nextDate.setDate(nextDate.getDate() + this.scheduleIntervalDays);
			await scheduler.manualRescheduleBlockWithPreviewV4(
				blockV4,
				{
					nextRepDate: nextDate.getTime(),
					intervalDays: this.scheduleIntervalDays,
					scheduleStatus: "queued",
				},
				this.session.topicId
			);
			await recomputeAndBroadcastIRData(this.app, "manual_reschedule", {
				deckIds: [this.session.topicId],
			});
			new Notice(notice);
		} catch (error) {
			logger.warn("[ParagraphWorkbenchService] applyScheduleInterval failed:", error);
			new Notice(notice);
		}
	}

	async archive(notice: string): Promise<void> {
		if (!this.registeredPointId) {
			new Notice(notice);
			return;
		}
		try {
			const storage = new IRStorageService(this.app);
			await storage.initialize();
			const blockRecord = await storage.getBlock(this.registeredPointId);
			if (!blockRecord) {
				new Notice(notice);
				return;
			}
			const adapter = new IRStorageAdapterV4(this.app, storage);
			const scheduler = new IRV4SchedulerService(this.app);
			await scheduler.initialize();
			const blockV4 =
				(await adapter.getBlockV4(this.registeredPointId)) || migrateToIRBlockV4(blockRecord);
			await scheduler.archiveBlockWithPreviewV4(blockV4, this.session?.topicId || "");
			if (this.session?.topicId) {
				await recomputeAndBroadcastIRData(this.app, "archive_block", {
					deckIds: [this.session.topicId],
				});
			}
			new Notice(notice);
		} catch (error) {
			logger.warn("[ParagraphWorkbenchService] archive failed:", error);
			new Notice(notice);
		}
	}

	private async addCanvasSegmentToTopic(
		storage: IRStorageService,
		deckId: string,
		deckName: string,
		sourcePath: string,
		segment: NonNullable<ReturnType<typeof getCurrentWorkbenchSegment>>,
		title: string
	): Promise<void> {
		const nodeId = readString(segment.metadata?.canvasNodeId) || readString(segment.id);
		if (!nodeId) {
			throw new Error("paragraph-workbench-canvas-node-missing");
		}

		const existingBlocks = await storage.getBlocksByFile(sourcePath);
		const duplicate = existingBlocks.find((block) => block.notes?.includes(`node=${encodeURIComponent(nodeId)}`));
		if (duplicate) {
			await storage.addBlocksToDeck(deckId, [duplicate.id]);
			this.applyTopicToSession(deckId, deckName, duplicate.id);
			await this.refreshSessionQueueProgress();
			new Notice(`当前 Canvas 节点已在专题「${deckName}」中`, 3000);
			await recomputeAndBroadcastIRData(this.app, "import_materials", { deckIds: [deckId] });
			return;
		}

		const blockRefLink = buildCanvasNodeEmbedWikiLink(sourcePath, nodeId, title);
		const blockId = generateIRBlockId();
		const block = createDefaultIRBlock(blockId, sourcePath, [title], 0, 0);
		block.headingText = title;
		block.contentPreview = String(segment.text || "")
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, 160);
		block.deckPath = deckId;
		block.notes = blockRefLink;
		block.priority = this.mapPriorityUiToLegacyPriority(this.priorityUi);
		block.priorityUi = this.priorityUi;
		block.priorityEff = this.priorityUi;
		await storage.saveBlock(block);
		await this.attachBlockToDeck(storage, deckId, sourcePath, block.id);

		const pointStorage = new IRPointStorageService(this.app);
		await pointStorage.syncLegacyPoint({
			id: block.id,
			topicId: deckId,
			topicName: deckName,
			title,
			status: "new",
			sourceType: "legacy-block",
			sourcePath,
			locatorType: "canvas-node",
			locator: {
				canvasPath: sourcePath,
				nodeId,
				sourcePath,
			},
			metadata: { canvasNodeId: nodeId },
		});

		this.applyTopicToSession(deckId, deckName, block.id);
		await this.refreshSessionQueueProgress();
		await recomputeAndBroadcastIRData(this.app, "import_materials", { deckIds: [deckId] });
		new Notice(`已添加到专题「${deckName}」`, 2500);
	}

	private async addEpubSegmentToTopic(
		deckId: string,
		deckName: string,
		sourcePath: string,
		segment: NonNullable<ReturnType<typeof getCurrentWorkbenchSegment>>,
		title: string
	): Promise<void> {
		const cfi = readString(segment.metadata?.cfiRange) || readString(segment.sourceLink);
		const chapterHref = readString(segment.metadata?.chapterHref);
		if (!cfi && !chapterHref) {
			new Notice("无法识别 EPUB 段落定位信息", 3500);
			throw new Error("paragraph-workbench-epub-locator-missing");
		}

		const epubService = new IREpubBookmarkTaskService(this.app);
		await epubService.initialize();
		const existing = await epubService.getTasksByEpub(sourcePath);
		const duplicate = existing.find((task) => {
			if (cfi && task.resumeCfi === cfi) {
				return true;
			}
			return Boolean(chapterHref && task.tocHref === chapterHref && task.title === title);
		});
		if (duplicate) {
			await new IRStorageService(this.app).addBlocksToDeck(deckId, [duplicate.id]);
			this.applyTopicToSession(deckId, deckName, duplicate.id);
			await this.refreshSessionQueueProgress();
			new Notice(`当前 EPUB 段落已在专题「${deckName}」中`, 3000);
			await recomputeAndBroadcastIRData(this.app, "import_materials", { deckIds: [deckId] });
			return;
		}

		const pointWriteService = new IRPointWriteService(this.app);
		const created = await pointWriteService.createEpubPoint({
			deckId,
			epubFilePath: sourcePath,
			title,
			tocHref: chapterHref || sourcePath,
			tocLevel: 1,
			priorityUi: this.priorityUi,
		});
		if (cfi) {
			await epubService.setResumePoint(created.id, cfi);
		}

		const storage = new IRStorageService(this.app);
		await storage.initialize();
		await this.attachBlockToDeck(storage, deckId, sourcePath, created.id);
		this.applyTopicToSession(deckId, deckName, created.id);
		await this.refreshSessionQueueProgress();
		await recomputeAndBroadcastIRData(this.app, "import_materials", { deckIds: [deckId] });
		new Notice(`已添加到专题「${deckName}」`, 2500);
	}

	private async attachBlockToDeck(
		storage: IRStorageService,
		deckId: string,
		sourcePath: string,
		blockId: string
	): Promise<void> {
		const latestDeck = await storage.getDeckById(deckId);
		if (!latestDeck) {
			return;
		}
		const blockIds = new Set(latestDeck.blockIds || []);
		blockIds.add(blockId);
		const sourceFiles = new Set(latestDeck.sourceFiles || []);
		sourceFiles.add(sourcePath);
		latestDeck.blockIds = Array.from(blockIds);
		latestDeck.sourceFiles = Array.from(sourceFiles);
		latestDeck.updatedAt = new Date().toISOString();
		await storage.saveDeck(latestDeck);
	}

	private async reloadCurrentSessionSegments(): Promise<void> {
		if (!this.session) {
			return;
		}
		const reloaded = await reloadParagraphWorkbenchSession(this.app, this.session);
		if (reloaded) {
			this.session = reloaded;
		}
	}

	private async refreshSessionQueueProgress(): Promise<void> {
		if (!this.session?.topicId) {
			return;
		}
		const progress = await resolveTopicQueueProgress(this.app, this.session.topicId);
		if (!progress || !this.session) {
			return;
		}
		this.session = {
			...this.session,
			queueDone: progress.queueDone,
			queueTotal: progress.queueTotal,
		};
	}

	private async resolvePointForCurrentSegment(): Promise<void> {
		if (!this.session?.topicId) {
			return;
		}
		const segment = getCurrentWorkbenchSegment(this.session);
		if (!segment) {
			return;
		}
		const sourcePath = resolveParagraphWorkbenchSourcePath(this.session.sourcePath);
		const storage = new IRStorageService(this.app);
		await storage.initialize();
		const blocks = await storage.getBlocksByFile(sourcePath);
		const obsidianBlockId = extractObsidianBlockIdFromSegment(segment);
		const matched = findDuplicateBlockForSegment(blocks, segment, obsidianBlockId);
		if (!matched) {
			return;
		}
		const matchedBlock = blocks.find((block) => block.id === matched.id);
		const deck = await storage.getDeckById(this.session.topicId);
		const inDeck =
			deck?.blockIds?.includes(matched.id) || matchedBlock?.deckPath === this.session.topicId;
		if (!inDeck) {
			return;
		}
		this.registeredPointId = matched.id;
		this.session = {
			...this.session,
			pointId: matched.id,
		};
		await this.syncPriorityFromRegisteredPoint();
	}

	private async syncPriorityFromRegisteredPoint(): Promise<void> {
		if (!this.registeredPointId) {
			return;
		}
		const storage = new IRStorageService(this.app);
		await storage.initialize();
		const block = await storage.getBlock(this.registeredPointId);
		if (!block) {
			return;
		}
		if (typeof block.priorityUi === "number") {
			this.priorityUi = clampParagraphPriorityUi(block.priorityUi);
			return;
		}
		if (typeof block.priorityEff === "number") {
			this.priorityUi = clampParagraphPriorityUi(block.priorityEff);
		}
	}

	private async recordCurrentSegmentProgress(): Promise<void> {
		if (!this.session?.topicId || !this.registeredPointId) {
			return;
		}
		const segment = getCurrentWorkbenchSegment(this.session);
		const readingTimeSeconds = estimateSegmentReadingSeconds(segment?.text || "");
		try {
			const storage = new IRStorageService(this.app);
			await storage.initialize();
			const block = await storage.getBlock(this.registeredPointId);
			if (!block) {
				return;
			}

			const scheduler = new IRV4SchedulerService(this.app);
			await scheduler.initialize();
			await scheduler.completeBlockFromV3(
				block,
				{
					rating: 3,
					readingTimeSeconds,
					priorityUi: block.priorityUi ?? this.priorityUi,
					createdCardCount: 0,
					createdExtractCount: 0,
					createdNoteCount: 0,
				},
				this.session.topicId
			);
			await this.refreshSessionQueueProgress();
		} catch (error) {
			logger.warn("[ParagraphWorkbenchService] complete on push failed, fallback interaction:", error);
			await recordLegacyBlockInteraction(this.app, this.registeredPointId, readingTimeSeconds);
			await this.refreshSessionQueueProgress();
		}
	}

	private applyTopicToSession(deckId: string, deckName: string, pointId: string): void {
		if (!this.session) {
			return;
		}
		this.session = {
			...this.session,
			topicId: deckId,
			topicName: deckName,
			pointId,
		};
		this.registeredPointId = pointId;
	}

	private mapPriorityUiToLegacyPriority(ui: number): 1 | 2 | 3 {
		if (ui >= 7) {
			return 1;
		}
		if (ui <= 3) {
			return 3;
		}
		return 2;
	}

	private async incrementExtractStat(pointId: string): Promise<void> {
		const storage = new IRStorageService(this.app);
		await storage.initialize();
		const block = await storage.getBlock(pointId);
		if (!block) {
			return;
		}
		const cards = Array.isArray(block.extractedCards) ? [...block.extractedCards] : [];
		const excerptMarker = generateReadingUUID();
		cards.push(excerptMarker);
		block.extractedCards = cards;
		block.updatedAt = new Date().toISOString();
		await storage.saveBlock(block);
	}

}
