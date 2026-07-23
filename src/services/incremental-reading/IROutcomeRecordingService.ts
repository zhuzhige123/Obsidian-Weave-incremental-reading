import type { App } from "obsidian";
import { logger } from "../../utils/logger";
import {
	IREpubBookmarkTaskService,
	isEpubBookmarkTaskId,
} from "./IREpubBookmarkTaskService";
import {
	IRPdfBookmarkTaskService,
	isPdfBookmarkTaskId,
} from "./IRPdfBookmarkTaskService";
import {
	getSharedIRPointStorageService,
	type IRPointStorageService,
} from "./IRPointStorageService";
import { IRStorageService } from "./IRStorageService";
import {
	type IRLearningOutcomeInput,
	type IRLearningOutcomeResult,
	normalizeIRLearningOutcomeInput,
	resolveOutcomeStatDelta,
} from "./ir-outcome-contract";

/**
 * Records Weave/EPUB learning outcomes onto IR reading points.
 * L0 write is point storage; chunk/pdf/epub task stats are best-effort dual-write.
 */
export class IROutcomeRecordingService {
	private readonly pointStorage: IRPointStorageService;
	private readonly storage: IRStorageService;
	private readonly pdfService: IRPdfBookmarkTaskService;
	private readonly epubService: IREpubBookmarkTaskService;

	constructor(
		private readonly app: App,
		deps?: {
			pointStorage?: IRPointStorageService;
			storage?: IRStorageService;
			pdfService?: IRPdfBookmarkTaskService;
			epubService?: IREpubBookmarkTaskService;
		},
	) {
		this.pointStorage =
			deps?.pointStorage || getSharedIRPointStorageService(app);
		this.storage = deps?.storage || new IRStorageService(app);
		this.pdfService = deps?.pdfService || new IRPdfBookmarkTaskService(app);
		this.epubService = deps?.epubService || new IREpubBookmarkTaskService(app);
	}

	async recordOutcome(
		input: IRLearningOutcomeInput,
	): Promise<IRLearningOutcomeResult> {
		const normalized = normalizeIRLearningOutcomeInput(input);
		if (!normalized) {
			return { ok: false, reason: "invalid_input" };
		}

		const applied = await this.pointStorage.applyPointOutcome({
			pointId: normalized.pointId,
			kind: normalized.kind,
			artifactId: normalized.artifactId || undefined,
			notePath: normalized.notePath || undefined,
			count: normalized.count,
		});

		if (!applied.ok || !applied.stats) {
			return {
				ok: false,
				reason: "point_not_found",
				pointId: normalized.pointId,
				kind: normalized.kind,
			};
		}

		if (!applied.alreadyLinked) {
			await this.dualWriteCompatStats(normalized.pointId, normalized.kind, {
				count: normalized.count,
			});
			try {
				this.storage.invalidateScheduleRuntimeCaches();
			} catch (error) {
				logger.debug(
					"[IROutcomeRecordingService] schedule cache invalidate skipped:",
					error,
				);
			}
		}

		return {
			ok: true,
			reason: applied.alreadyLinked ? "noop_already_linked" : undefined,
			pointId: normalized.pointId,
			kind: normalized.kind,
			linkedArtifactId: normalized.artifactId || undefined,
			linkedNotePath: normalized.notePath || undefined,
			alreadyLinked: applied.alreadyLinked,
			stats: applied.stats,
		};
	}

	private async dualWriteCompatStats(
		pointId: string,
		kind: IRLearningOutcomeInput["kind"],
		options: { count: number },
	): Promise<void> {
		const delta = resolveOutcomeStatDelta(kind, options.count);

		try {
			if (isPdfBookmarkTaskId(pointId)) {
				await this.pdfService.initialize();
				const task = await this.pdfService.getTask(pointId);
				if (!task) {
					return;
				}
				await this.pdfService.updateTask(pointId, {
					stats: {
						extracts: Number(task.stats?.extracts || 0) + delta.extracts,
						cardsCreated:
							Number(task.stats?.cardsCreated || 0) + delta.cardsCreated,
						notesWritten:
							Number(task.stats?.notesWritten || 0) + delta.notesWritten,
						lastInteraction: Date.now(),
					},
				});
				return;
			}

			if (isEpubBookmarkTaskId(pointId)) {
				await this.epubService.initialize();
				const task = await this.epubService.getTask(pointId);
				if (!task) {
					return;
				}
				await this.epubService.updateTask(pointId, {
					stats: {
						extracts: Number(task.stats?.extracts || 0) + delta.extracts,
						cardsCreated:
							Number(task.stats?.cardsCreated || 0) + delta.cardsCreated,
						notesWritten:
							Number(task.stats?.notesWritten || 0) + delta.notesWritten,
						lastInteraction: Date.now(),
					},
				});
				return;
			}

			await this.storage.initialize();
			const chunk = await this.storage.getChunkData(pointId);
			if (!chunk?.stats) {
				return;
			}
			chunk.stats.extracts = Number(chunk.stats.extracts || 0) + delta.extracts;
			chunk.stats.cardsCreated =
				Number(chunk.stats.cardsCreated || 0) + delta.cardsCreated;
			chunk.stats.notesWritten =
				Number(chunk.stats.notesWritten || 0) + delta.notesWritten;
			chunk.stats.lastInteraction = Date.now();
			chunk.updatedAt = Date.now();
			await this.storage.saveChunkData(chunk);
		} catch (error) {
			logger.debug(
				"[IROutcomeRecordingService] compat stats dual-write skipped:",
				error,
			);
		}
	}
}
