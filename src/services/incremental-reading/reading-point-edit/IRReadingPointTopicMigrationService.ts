import { normalizePath, type App } from "obsidian";
import { buildPointWriteCardStub } from "../../../utils/ir-card-point-access";
import type { ScheduleItemSourceType } from "../IRCalendarScheduleItem";
import {
	IREpubBookmarkTaskService,
	isEpubBookmarkTaskId,
} from "../IREpubBookmarkTaskService";
import {
	IRPdfBookmarkTaskService,
	isPdfBookmarkTaskId,
} from "../IRPdfBookmarkTaskService";
import { IRPointDataReadService } from "../IRPointDataReadService";
import { IRPointStorageService } from "../IRPointStorageService";
import { IRPointWriteService } from "../IRPointWriteService";
import { IRStorageService } from "../IRStorageService";

export type IRReadingPointTopicMigrationKind = "pdf" | "epub" | "chunk" | "block" | "point";

export interface IRReadingPointTopicMigrationInput {
	pointId: string;
	targetDeckId: string;
	sourceTypeHint?: ScheduleItemSourceType | "unknown";
	sourceDocumentPath?: string;
}

export interface IRReadingPointTopicMigrationResult {
	changed: boolean;
	previousDeckId?: string;
	targetDeckId: string;
	kind: IRReadingPointTopicMigrationKind;
	sourceDocumentPath?: string;
}

export class IRReadingPointTopicMigrationService {
	private readonly storage: IRStorageService;
	private readonly pointRead: IRPointDataReadService;
	private readonly pointStorage: IRPointStorageService;
	private readonly pointWrite: IRPointWriteService;
	private readonly pdfService: IRPdfBookmarkTaskService;
	private readonly epubService: IREpubBookmarkTaskService;

	constructor(private readonly app: App) {
		this.storage = new IRStorageService(app);
		this.pointRead = new IRPointDataReadService(app);
		this.pointStorage = this.pointRead.getPointStorage();
		this.pointWrite = new IRPointWriteService(app);
		this.pdfService = new IRPdfBookmarkTaskService(app);
		this.epubService = new IREpubBookmarkTaskService(app);
	}

	async movePointToTopic(
		input: IRReadingPointTopicMigrationInput
	): Promise<IRReadingPointTopicMigrationResult> {
		await this.initialize();

		const pointId = String(input.pointId || "").trim();
		const targetDeckId = String(input.targetDeckId || "").trim();
		if (!pointId) {
			throw new Error("reading-point-edit-missing-id");
		}
		if (!targetDeckId) {
			throw new Error("reading-point-edit-missing-deck");
		}

		const kind = await this.resolveKind(pointId, input.sourceTypeHint);
		const previousTopicIds = await this.pointRead.getPointTopicIds(pointId);
		const previousDeckId = String(previousTopicIds[0] || "").trim();

		if (previousDeckId === targetDeckId) {
			return {
				changed: false,
				previousDeckId: previousDeckId || undefined,
				targetDeckId,
				kind,
				sourceDocumentPath: input.sourceDocumentPath,
			};
		}

		let changed = false;
		let sourceDocumentPath = input.sourceDocumentPath;

		switch (kind) {
			case "pdf": {
				const existing = await this.pdfService.getTask(pointId);
				if (!existing) {
					throw new Error("reading-point-edit-not-found");
				}
				const updated = await this.pdfService.updateTask(pointId, {
					topicId: targetDeckId,
					deckId: targetDeckId,
				});
				if (!updated) {
					throw new Error("reading-point-edit-not-found");
				}
				sourceDocumentPath = normalizePath(existing.pdfPath);
				changed = true;
				break;
			}
			case "epub": {
				const existing = await this.epubService.getTask(pointId);
				if (!existing) {
					throw new Error("reading-point-edit-not-found");
				}
				const updated = await this.epubService.updateTask(pointId, {
					topicId: targetDeckId,
					deckId: targetDeckId,
				});
				if (!updated) {
					throw new Error("reading-point-edit-not-found");
				}
				sourceDocumentPath = normalizePath(existing.epubFilePath);
				changed = true;
				break;
			}
			case "chunk": {
				const chunk = await this.storage.getChunkData(pointId);
				if (!chunk) {
					throw new Error("reading-point-edit-not-found");
				}
				await this.storage.updateChunkDecks(pointId, [targetDeckId]);
				sourceDocumentPath = normalizePath(chunk.filePath);
				changed = true;
				break;
			}
			case "block": {
				const block = await this.storage.getBlock(pointId);
				if (!block) {
					throw new Error("reading-point-edit-not-found");
				}
				block.deckPath = targetDeckId;
				await this.storage.saveBlock(block);
				sourceDocumentPath = normalizePath(block.filePath);
				const deckResult = await this.pointWrite.updateDecks(
					buildPointWriteCardStub({
						id: pointId,
						kind: "block",
						sourceDocumentPath,
					}),
					[targetDeckId]
				);
				changed = changed || Boolean(deckResult);
				break;
			}
			case "point":
				break;
		}

		if (kind === "chunk") {
			const syncedTopicIds = await this.pointRead.getPointTopicIds(pointId);
			if (String(syncedTopicIds[0] || "").trim() !== targetDeckId) {
				const topicNamesById = await this.buildTopicNamesByIdMap();
				const topicMoved = await this.pointStorage.updatePointTopicIds(pointId, [targetDeckId], {
					topicNamesById,
				});
				changed = changed || topicMoved;
			}
		} else {
			const topicNamesById = await this.buildTopicNamesByIdMap();
			const topicMoved = await this.pointStorage.updatePointTopicIds(pointId, [targetDeckId], {
				topicNamesById,
			});
			changed = changed || topicMoved;
		}

		return {
			changed,
			previousDeckId: previousDeckId || undefined,
			targetDeckId,
			kind,
			sourceDocumentPath,
		};
	}

	async resolveKind(
		pointId: string,
		sourceTypeHint?: ScheduleItemSourceType | "unknown"
	): Promise<IRReadingPointTopicMigrationKind> {
		if (isPdfBookmarkTaskId(pointId)) {
			return "pdf";
		}
		if (isEpubBookmarkTaskId(pointId)) {
			return "epub";
		}

		const chunk = await this.storage.getChunkData(pointId);
		if (chunk) {
			return "chunk";
		}

		const block = await this.storage.getBlock(pointId);
		if (block) {
			return "block";
		}

		const snapshot = await this.pointStorage.getPointSnapshotById(pointId);
		if (snapshot) {
			return "point";
		}

		if (sourceTypeHint === "pdf" || sourceTypeHint === "epub" || sourceTypeHint === "chunk" || sourceTypeHint === "legacy-block") {
			throw new Error("reading-point-edit-not-found");
		}

		throw new Error("reading-point-edit-not-found");
	}

	private async buildTopicNamesByIdMap(): Promise<Map<string, string>> {
		const decks = await this.storage.getAllDecks();
		return new Map(
			Object.values(decks).map(
				(deck) => [String(deck.id || "").trim(), String(deck.name || "").trim()] as const
			)
		);
	}

	private async initialize(): Promise<void> {
		await Promise.all([
			this.storage.initialize(),
			this.pointStorage.initialize(),
			this.pdfService.initialize(),
			this.epubService.initialize(),
		]);
	}
}
