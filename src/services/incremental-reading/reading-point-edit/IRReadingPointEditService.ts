import { type App, normalizePath } from "obsidian";
import type {
	IRParameterContext,
	IRTraceState,
} from "../../../types/ir-point-storage-types";
import {
	type IRBlock,
	type IRChunkFileData,
	migrateToIRBlockV4,
} from "../../../types/ir-types";
import { i18n } from "../../../utils/i18n";
import {
	getChunkTopicIds,
	getTaskTopicId,
} from "../../../utils/ir-topic-compat";
import { resolveAssociatedNotePaths } from "../IRAssociatedNoteSignals";
import type { ScheduleItem } from "../IRCalendarScheduleItem";
import {
	type IREpubBookmarkTask,
	IREpubBookmarkTaskService,
	isEpubBookmarkTaskId,
} from "../IREpubBookmarkTaskService";
import { IRHostSharedService } from "../IRHostSharedService";
import { supportsPointLinkedNotesForScheduleItem } from "../IRLinkedNotePolicy";
import {
	type IRPdfBookmarkTask,
	IRPdfBookmarkTaskService,
	isPdfBookmarkTaskId,
} from "../IRPdfBookmarkTaskService";
import { IRPointDataReadService } from "../IRPointDataReadService";
import { IRPointStorageService } from "../IRPointStorageService";
import {
	IRPointTagService,
	normalizeReadingPointTags,
	resolveReadingPointTags,
} from "../IRPointTagService";
import {
	IRPointWriteService,
	type IRPointWriteTarget,
} from "../IRPointWriteService";
import {
	broadcastIRDataUpdated,
	recomputeAndBroadcastIRData,
} from "../IRScheduleRefreshService";
import { IRStorageService } from "../IRStorageService";
import { parseReadingTargetInput } from "../reading-target/IRReadingTargetParser";
import { getReadingTargetKindLabel } from "../reading-target/IRReadingTargetTitleResolver";
import type { ParsedReadingTarget } from "../reading-target/IRReadingTargetTypes";
import {
	canEditReadingPointLink,
	resolveReadingPointLinkInputFromParts,
	resolveSavedResumeLink,
} from "./IRReadingPointEditLinkResolver";
import type {
	IRReadingPointDuplicateTitleMatch,
	IRReadingPointEditDraft,
	IRReadingPointEditSaveInput,
	IRReadingPointEditSaveResult,
} from "./IRReadingPointEditTypes";
import { resolveReadingPointStoredSchedule } from "./IRReadingPointStoredSchedule";
import { IRReadingPointTopicMigrationService } from "./IRReadingPointTopicMigrationService";

const MATERIAL_CLASS_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: "reference-note", label: "参考笔记" },
	{ value: "academic-book", label: "学术书籍" },
];

function readTitleManuallyEdited(
	metadata: Record<string, unknown> | undefined,
): boolean {
	return metadata?.titleManuallyEdited === true;
}

function readParameterContextOverride(
	metadata: Record<string, unknown> | undefined,
): boolean {
	return metadata?.parameterContextOverride === true;
}

function buildTraceStateFromValidation(
	parsedTarget: ParsedReadingTarget | null,
): IRTraceState {
	if (!parsedTarget || parsedTarget.validationError) {
		return "broken";
	}
	if (parsedTarget.kind === "unknown") {
		return "broken";
	}
	return "verified";
}

function materialTagsMayHaveChanged(
	_input: IRReadingPointEditSaveInput,
): boolean {
	return true;
}

function normalizeReadingPointTitleForCompare(title: string): string {
	return String(title || "")
		.trim()
		.replace(/\s+/g, " ")
		.toLocaleLowerCase();
}

function resolveReadingPointDisplayTitle(parts: {
	snapshotTitle?: string;
	fallbackTitle?: string;
	pointId: string;
}): string {
	return (
		String(parts.snapshotTitle || parts.fallbackTitle || "").trim() ||
		parts.pointId
	);
}

export class IRReadingPointEditService {
	private readonly host: IRHostSharedService;
	private readonly storage: IRStorageService;
	private readonly pointRead: IRPointDataReadService;
	private readonly pointStorage: IRPointStorageService;
	private readonly pointWrite: IRPointWriteService;
	private readonly pointTagService: IRPointTagService;
	private readonly pdfService: IRPdfBookmarkTaskService;
	private readonly epubService: IREpubBookmarkTaskService;
	private readonly topicMigration: IRReadingPointTopicMigrationService;

	constructor(private readonly app: App) {
		this.host = new IRHostSharedService(app);
		this.storage = new IRStorageService(app);
		this.pointRead = new IRPointDataReadService(app);
		this.pointStorage = this.pointRead.getPointStorage();
		this.pointWrite = new IRPointWriteService(app);
		this.pointTagService = new IRPointTagService(app);
		this.pdfService = new IRPdfBookmarkTaskService(app);
		this.epubService = new IREpubBookmarkTaskService(app);
		this.topicMigration = new IRReadingPointTopicMigrationService(app);
	}

	static getMaterialClassOptions(): Array<{ value: string; label: string }> {
		return [...MATERIAL_CLASS_OPTIONS];
	}

	async findDuplicateTitleMatches(input: {
		deckId: string;
		title: string;
		excludePointId: string;
	}): Promise<IRReadingPointDuplicateTitleMatch[]> {
		await this.initialize();

		const deckId = String(input.deckId || "").trim();
		const excludePointId = String(input.excludePointId || "").trim();
		const normalizedTitle = normalizeReadingPointTitleForCompare(input.title);
		if (!deckId || !normalizedTitle) {
			return [];
		}

		const matches = new Map<string, IRReadingPointDuplicateTitleMatch>();
		const snapshots = await this.pointRead.listPointSnapshots();

		for (const snapshot of snapshots) {
			const pointId = String(snapshot.point?.id || "").trim();
			if (!pointId || pointId === excludePointId) {
				continue;
			}

			const topicId = String(snapshot.topicId || "").trim();
			if (topicId !== deckId) {
				const topicIds = await this.pointRead.getPointTopicIds(pointId);
				if (!topicIds.includes(deckId)) {
					continue;
				}
			}

			const displayTitle = resolveReadingPointDisplayTitle({
				snapshotTitle: snapshot.point.userData?.title,
				pointId,
			});
			if (
				normalizeReadingPointTitleForCompare(displayTitle) !== normalizedTitle
			) {
				continue;
			}

			matches.set(pointId, { pointId, title: displayTitle });
		}

		const [pdfTasks, epubTasks, legacyBlocks] = await Promise.all([
			this.pdfService.getTasksByDeck(deckId),
			this.epubService.getTasksByDeck(deckId),
			this.storage.getBlocksByDeck(deckId),
		]);

		for (const task of [...pdfTasks, ...epubTasks]) {
			const pointId = String(task.id || "").trim();
			if (!pointId || pointId === excludePointId || matches.has(pointId)) {
				continue;
			}

			const displayTitle = resolveReadingPointDisplayTitle({
				snapshotTitle: task.title,
				pointId,
			});
			if (
				normalizeReadingPointTitleForCompare(displayTitle) !== normalizedTitle
			) {
				continue;
			}

			matches.set(pointId, { pointId, title: displayTitle });
		}

		for (const block of legacyBlocks) {
			const pointId = String(block.id || "").trim();
			if (!pointId || pointId === excludePointId || matches.has(pointId)) {
				continue;
			}

			const displayTitle = resolveReadingPointDisplayTitle({
				fallbackTitle: block.headingPath?.join(" / "),
				pointId,
			});
			if (
				normalizeReadingPointTitleForCompare(displayTitle) !== normalizedTitle
			) {
				continue;
			}

			matches.set(pointId, { pointId, title: displayTitle });
		}

		return Array.from(matches.values()).sort((left, right) =>
			left.pointId.localeCompare(right.pointId, "zh-CN"),
		);
	}

	async loadDraft(
		material: ScheduleItem,
	): Promise<IRReadingPointEditDraft | null> {
		await this.initialize();

		const pointId = String(material.id || "").trim();
		if (!pointId) {
			return null;
		}

		const [
			snapshot,
			pdfTask,
			epubTask,
			legacyBlock,
			chunk,
			decks,
			pointTopicIds,
		] = await Promise.all([
			this.pointStorage.getPointSnapshotById(pointId),
			isPdfBookmarkTaskId(pointId)
				? this.pdfService.getTask(pointId)
				: Promise.resolve(null),
			isEpubBookmarkTaskId(pointId)
				? this.epubService.getTask(pointId)
				: Promise.resolve(null),
			material.sourceType === "legacy-block"
				? this.storage.getBlock(pointId)
				: Promise.resolve(null),
			material.sourceType === "chunk"
				? this.storage.getChunkData(pointId)
				: Promise.resolve(null),
			this.storage.getAllDecks(),
			this.pointRead.getPointTopicIds(pointId),
		]);

		const linkInput = resolveReadingPointLinkInputFromParts(this.app, {
			material,
			snapshot,
			pdfTask,
			epubTask,
			legacyBlock,
		});

		const parsedTarget = linkInput
			? parseReadingTargetInput(this.app, linkInput, material.sourceFile || "")
			: null;

		const deckId =
			String(pointTopicIds[0] || "").trim() ||
			String(
				getChunkTopicIds(
					snapshot
						? { topicIds: snapshot.point.relations?.topicIds }
						: undefined,
				)[0] || "",
			).trim() ||
			String(snapshot?.topicId || "").trim() ||
			String(getTaskTopicId(pdfTask || epubTask || undefined) || "").trim() ||
			String(legacyBlock?.deckPath || "").trim() ||
			String(material.deckId || "").trim();

		const deckName =
			(deckId && decks[deckId]?.name) ||
			snapshot?.topicName ||
			deckId ||
			i18n.t("irServiceNotices.defaults.defaultTopic");

		const title =
			String(snapshot?.point.userData?.title || "").trim() ||
			String(material.displayName || material.title || "").trim() ||
			pointId;

		const metadata = snapshot?.point.metadata || {};
		const tags = await this.loadTags(material, pdfTask, epubTask, chunk);
		const tagGroupId =
			tags.length > 0
				? await this.pointTagService.matchGroupForTags(tags)
				: "default";
		const allGroups = await this.pointTagService.getTagGroups();
		const tagGroupName =
			allGroups.find((group) => group.id === tagGroupId)?.name ||
			i18n.t("irSidebar.calendar.defaultTagGroup");

		const associatedNotePaths = supportsPointLinkedNotesForScheduleItem(
			material,
		)
			? resolveAssociatedNotePaths({
					associatedNotePath:
						material.primaryAssociatedNotePath ||
						material.associatedNotePath ||
						snapshot?.point.relations.linkedNotePaths?.[0],
					associatedNotePaths:
						material.associatedNotePaths ||
						snapshot?.point.relations.linkedNotePaths,
			  })
			: [];

		const storedNextRepDate = Number(
			(snapshot?.point.schedule.nextReviewAt
				? Date.parse(snapshot.point.schedule.nextReviewAt)
				: 0) ||
				pdfTask?.nextRepDate ||
				epubTask?.nextRepDate ||
				chunk?.nextRepDate ||
				(legacyBlock
					? Number(migrateToIRBlockV4(legacyBlock).nextRepDate || 0)
					: 0) ||
				0,
		);

		return {
			pointId,
			sourceType: material.sourceType || "unknown",
			kindLabel: parsedTarget
				? getReadingTargetKindLabel(parsedTarget.kind)
				: i18n.t("irAddTarget.kindLabels.readingPoint"),
			title,
			titleManuallyEdited: readTitleManuallyEdited(metadata),
			linkInput,
			originalLinkInput: linkInput,
			note: String(
				snapshot?.point.userData?.note || legacyBlock?.notes || "",
			).trim(),
			deckId,
			deckName,
			priority: Number(
				snapshot?.point.schedule.manualPriority ??
					pdfTask?.priorityUi ??
					epubTask?.priorityUi ??
					chunk?.priorityUi ??
					material.priority ??
					5,
			),
			nextRepDate:
				storedNextRepDate > 0
					? storedNextRepDate
					: Number(material.nextRepDate || 0),
			tags,
			tagGroupName,
			associatedNotePaths,
			isStarred: Boolean(
				snapshot?.point.userData?.isStarred || pdfTask?.favorite,
			),
			traceState: snapshot?.point.trace?.traceState || null,
			traceConfidence:
				typeof snapshot?.point.trace?.traceConfidence === "number"
					? snapshot.point.trace.traceConfidence
					: null,
			lastVerifiedAt: snapshot?.point.trace?.lastVerifiedAt || null,
			sourceFile: String(
				material.sourceFile || snapshot?.point.source?.path || "",
			).trim(),
			topicName: deckName,
			parameterContext: snapshot?.point.parameterContext || null,
			parameterContextOverride: readParameterContextOverride(metadata),
			canEditLink: canEditReadingPointLink(material),
			canEditAssociatedNotes: supportsPointLinkedNotesForScheduleItem(material),
			canEditTags: material.sourceType !== "legacy-block",
		};
	}

	/**
	 * 仅更换所属专题：不改动调度字段（nextRepDate / interval / status / 复习记录）。
	 */
	async saveTopicChange(
		material: ScheduleItem,
		targetDeckId: string,
	): Promise<IRReadingPointEditSaveResult> {
		await this.initialize();

		const migration = await this.topicMigration.movePointToTopic({
			pointId: material.id,
			targetDeckId,
			sourceTypeHint: material.sourceType || "unknown",
			sourceDocumentPath: material.sourceFile || undefined,
		});

		if (migration.changed) {
			this.storage.invalidateScheduleRuntimeCaches();
			await recomputeAndBroadcastIRData(this.app, "metadata_changed");
		}

		return {
			changed: migration.changed,
			sourceDocumentPath: migration.sourceDocumentPath,
		};
	}

	async saveEdit(
		input: IRReadingPointEditSaveInput,
	): Promise<IRReadingPointEditSaveResult> {
		await this.initialize();

		const pointId = String(input.pointId || "").trim();
		if (!pointId) {
			throw new Error("reading-point-edit-missing-id");
		}

		const title = this.host.cleanIRReadingPointTitle(input.title);
		if (!title) {
			throw new Error("reading-point-edit-missing-title");
		}

		const deckId = String(input.deckId || "").trim();
		if (!deckId) {
			throw new Error("reading-point-edit-missing-deck");
		}

		const previousTopicIds = await this.pointRead.getPointTopicIds(pointId);
		const previousDeckId = String(previousTopicIds[0] || "").trim();
		const topicChanged = previousDeckId !== deckId;

		const normalizedTags = normalizeReadingPointTags(input.tags);
		const normalizedNotes = resolveAssociatedNotePaths({
			associatedNotePaths: input.associatedNotePaths,
		});
		const linkChanged =
			String(input.linkInput || "").trim() !==
			String(input.originalLinkInput || "").trim();
		const storedSchedule = await resolveReadingPointStoredSchedule(
			this.app,
			pointId,
		);
		const preserveScheduleFields = !linkChanged;
		const preserveTopic = topicChanged;
		const effectiveDeckId =
			topicChanged && previousDeckId
				? previousDeckId
				: storedSchedule?.deckId || previousDeckId || deckId;
		const effectivePriority =
			preserveScheduleFields && storedSchedule
				? storedSchedule.priority
				: input.priority;
		const effectiveNextRepDate =
			preserveScheduleFields && storedSchedule
				? storedSchedule.nextRepDate
				: input.nextRepDate;
		const parsedTarget = linkChanged
			? parseReadingTargetInput(
					this.app,
					String(input.linkInput || "").trim(),
					input.sourceFile || "",
			  )
			: input.parsedTarget;

		if (linkChanged) {
			if (
				!parsedTarget ||
				parsedTarget.validationError ||
				parsedTarget.kind === "unknown"
			) {
				throw new Error(
					parsedTarget?.validationError || "reading-point-edit-invalid-link",
				);
			}
		}

		const savedResumeLink =
			linkChanged && parsedTarget
				? resolveSavedResumeLink(input.linkInput, parsedTarget)
				: null;

		const writeTarget: IRPointWriteTarget = {
			id: pointId,
			kind:
				input.sourceType === "legacy-block"
					? "block"
					: input.sourceType === "chunk"
					? "chunk"
					: input.sourceType === "pdf"
					? "pdf"
					: input.sourceType === "epub"
					? "epub"
					: undefined,
			sourceDocumentPath: input.sourceFile || undefined,
		};

		let changed = false;
		let sourceDocumentPath = input.sourceFile || undefined;

		if (isPdfBookmarkTaskId(pointId)) {
			const result = await this.savePdfPoint(pointId, {
				title,
				deckId: effectiveDeckId,
				priority: effectivePriority,
				nextRepDate: effectiveNextRepDate,
				tags: normalizedTags,
				isStarred: input.isStarred,
				note: input.note,
				linkChanged,
				parsedTarget,
				savedResumeLink,
				preserveScheduleOnLinkChange: input.preserveScheduleOnLinkChange,
				preserveScheduleFields,
				preserveTopic,
				associatedNotePaths: normalizedNotes,
				titleManuallyEdited: input.titleManuallyEdited,
				parameterContext: input.parameterContextOverride
					? input.parameterContext
					: null,
			});
			changed = changed || result.changed;
			sourceDocumentPath = result.sourceDocumentPath || sourceDocumentPath;
		} else if (isEpubBookmarkTaskId(pointId)) {
			const result = await this.saveEpubPoint(pointId, {
				title,
				deckId: effectiveDeckId,
				priority: effectivePriority,
				nextRepDate: effectiveNextRepDate,
				tags: normalizedTags,
				isStarred: input.isStarred,
				note: input.note,
				linkChanged,
				parsedTarget,
				savedResumeLink,
				preserveScheduleOnLinkChange: input.preserveScheduleOnLinkChange,
				preserveScheduleFields,
				preserveTopic,
				associatedNotePaths: normalizedNotes,
				titleManuallyEdited: input.titleManuallyEdited,
				parameterContext: input.parameterContextOverride
					? input.parameterContext
					: null,
			});
			changed = changed || result.changed;
			sourceDocumentPath = result.sourceDocumentPath || sourceDocumentPath;
		} else {
			const chunk = await this.storage.getChunkData(pointId);
			if (chunk) {
				const result = await this.saveChunkPoint(chunk, {
					title,
					deckId: effectiveDeckId,
					priority: effectivePriority,
					nextRepDate: effectiveNextRepDate,
					tags: normalizedTags,
					isStarred: input.isStarred,
					note: input.note,
					linkChanged,
					parsedTarget,
					savedResumeLink,
					preserveScheduleOnLinkChange: input.preserveScheduleOnLinkChange,
					preserveScheduleFields,
					preserveTopic,
					associatedNotePaths: normalizedNotes,
					titleManuallyEdited: input.titleManuallyEdited,
					parameterContext: input.parameterContextOverride
						? input.parameterContext
						: null,
				});
				changed = changed || result.changed;
				sourceDocumentPath = result.sourceDocumentPath || sourceDocumentPath;
			} else {
				const block = await this.storage.getBlock(pointId);
				if (!block) {
					throw new Error("reading-point-edit-not-found");
				}
				const result = await this.saveLegacyBlockPoint(block, {
					title,
					deckId: effectiveDeckId,
					priority: effectivePriority,
					nextRepDate: effectiveNextRepDate,
					tags: normalizedTags,
					isStarred: input.isStarred,
					note: input.note,
					linkChanged,
					parsedTarget,
					savedResumeLink,
					preserveScheduleOnLinkChange: input.preserveScheduleOnLinkChange,
					preserveScheduleFields,
					preserveTopic,
					titleManuallyEdited: input.titleManuallyEdited,
					parameterContext: input.parameterContextOverride
						? input.parameterContext
						: null,
				});
				changed = changed || result.changed;
				sourceDocumentPath = result.sourceDocumentPath || sourceDocumentPath;
			}
		}

		if (normalizedTags.length > 0 || materialTagsMayHaveChanged(input)) {
			const tagResult = await this.pointWrite.updatePointTags(
				writeTarget,
				normalizedTags,
			);
			changed = changed || Boolean(tagResult);
			if (tagResult?.sourceDocumentPath) {
				sourceDocumentPath = tagResult.sourceDocumentPath;
			}
		}

		if (
			normalizedNotes.length > 0 ||
			writeTarget.kind === "pdf" ||
			writeTarget.kind === "epub"
		) {
			const noteResult = await this.pointWrite.updatePointAssociatedNotes(
				writeTarget,
				normalizedNotes,
			);
			changed = changed || Boolean(noteResult);
			if (noteResult?.sourceDocumentPath) {
				sourceDocumentPath = noteResult.sourceDocumentPath;
			}
		}

		if (topicChanged) {
			const migration = await this.topicMigration.movePointToTopic({
				pointId,
				targetDeckId: deckId,
				sourceTypeHint: input.sourceType,
				sourceDocumentPath,
			});
			changed = changed || migration.changed;
			sourceDocumentPath = migration.sourceDocumentPath || sourceDocumentPath;
		}

		if (changed) {
			this.storage.invalidateScheduleRuntimeCaches();
			if (linkChanged && input.preserveScheduleOnLinkChange) {
				broadcastIRDataUpdated(this.app, {
					reason: "metadata_changed",
					invalidationScope: "none",
				});
			} else {
				await recomputeAndBroadcastIRData(this.app, "metadata_changed");
			}
		}

		return {
			changed,
			sourceDocumentPath,
			...(linkChanged && savedResumeLink
				? { linkChanged: true, savedResumeLink }
				: {}),
		};
	}

	private async initialize(): Promise<void> {
		await Promise.all([
			this.storage.initialize(),
			this.pointStorage.initialize(),
			this.pdfService.initialize(),
			this.epubService.initialize(),
		]);
	}

	private async loadTags(
		material: ScheduleItem,
		pdfTask: IRPdfBookmarkTask | null,
		epubTask: IREpubBookmarkTask | null,
		chunk: IRChunkFileData | null,
	): Promise<string[]> {
		const snapshot = await this.pointStorage.getPointSnapshotById(material.id);
		return await resolveReadingPointTags({
			materialId: material.id,
			sourceType: material.sourceType,
			pdfTaskTags: pdfTask?.tags,
			epubTaskTags: epubTask?.tags,
			hasPointSnapshot: Boolean(snapshot?.point),
			pointUserDataTags: snapshot?.point.userData?.tags,
			getChunkTags: async () => {
				const resolvedChunk =
					chunk || (await this.storage.getChunkData(material.id));
				if (!resolvedChunk) {
					return [];
				}
				return await this.pointTagService.getChunkTags(resolvedChunk);
			},
		});
	}

	private buildMetadataPatch(
		existing: Record<string, unknown> | undefined,
		patch: Record<string, unknown>,
	): Record<string, unknown> {
		return {
			...(existing || {}),
			...patch,
		};
	}

	private async savePdfPoint(
		pointId: string,
		input: {
			title: string;
			deckId: string;
			priority: number;
			nextRepDate: number;
			tags: string[];
			isStarred: boolean;
			note: string;
			linkChanged: boolean;
			parsedTarget: ParsedReadingTarget | null;
			savedResumeLink: string | null;
			preserveScheduleOnLinkChange: boolean;
			preserveScheduleFields: boolean;
			preserveTopic: boolean;
			associatedNotePaths: string[];
			titleManuallyEdited: boolean;
			parameterContext: IRParameterContext | null;
		},
	): Promise<{ changed: boolean; sourceDocumentPath?: string }> {
		const existing = await this.pdfService.getTask(pointId);
		if (!existing) {
			throw new Error("reading-point-edit-not-found");
		}

		const snapshot = await this.pointStorage.getPointSnapshotById(pointId);
		const metadata = this.buildMetadataPatch(
			snapshot?.point.metadata as Record<string, unknown>,
			{
				titleManuallyEdited: input.titleManuallyEdited,
				parameterContextOverride: Boolean(input.parameterContext),
				pointTitle: input.title,
				...(input.linkChanged && input.savedResumeLink
					? { resumeLink: input.savedResumeLink }
					: {}),
			},
		);

		const topicId = input.preserveTopic
			? String(existing.topicId || existing.deckId || input.deckId || "").trim()
			: input.deckId;
		const updates: Partial<IRPdfBookmarkTask> & { link?: string } = {
			title: input.title,
			favorite: input.isStarred,
			tags: input.tags,
		};

		if (!input.preserveTopic) {
			updates.topicId = topicId;
			updates.deckId = topicId;
		}

		if (!input.preserveScheduleFields) {
			updates.priorityUi = input.priority;
			updates.priorityEff = input.priority;
			if (!input.preserveScheduleOnLinkChange || !input.linkChanged) {
				updates.nextRepDate = input.nextRepDate;
			}
		}

		if (input.linkChanged && input.savedResumeLink) {
			updates.link = input.savedResumeLink;
		}

		const updated = await this.pdfService.updateTask(pointId, {
			...updates,
			meta: {
				...(existing.meta || {}),
				primaryAssociatedNotePath: input.associatedNotePaths[0],
				associatedNotePath: input.associatedNotePaths[0],
				associatedNotePaths: input.associatedNotePaths,
				...(input.linkChanged && input.savedResumeLink
					? { resumeLink: input.savedResumeLink }
					: {}),
			},
		});

		await this.pointStorage.syncLegacyPoint(
			{
				id: pointId,
				topicId,
				title: input.title,
				note: input.note,
				isStarred: input.isStarred,
				tags: input.tags,
				status: updated?.status || existing.status,
				...(input.preserveScheduleFields
					? {}
					: {
							priorityUi: input.priority,
							priorityEff: input.priority,
					  }),
				intervalDays: updated?.intervalDays ?? existing.intervalDays,
				nextRepDate: updated?.nextRepDate ?? existing.nextRepDate,
				sourceType: "pdf-bookmark",
				sourcePath: existing.pdfPath,
				locatorType: "pdf-selection",
				locator: {
					pdfPath: existing.pdfPath,
					link: updated?.link || existing.link,
				},
				linkedNotePaths: input.associatedNotePaths,
				metadata,
				parameterContext: input.parameterContext || undefined,
			},
			{ preserveExisting: true },
		);

		if (input.linkChanged && input.parsedTarget && input.savedResumeLink) {
			await this.updateTraceRecord(
				pointId,
				input.parsedTarget,
				input.savedResumeLink,
			);
		}

		return {
			changed: true,
			sourceDocumentPath: normalizePath(existing.pdfPath),
		};
	}

	private async saveEpubPoint(
		pointId: string,
		input: {
			title: string;
			deckId: string;
			priority: number;
			nextRepDate: number;
			tags: string[];
			isStarred: boolean;
			note: string;
			linkChanged: boolean;
			parsedTarget: ParsedReadingTarget | null;
			savedResumeLink: string | null;
			preserveScheduleOnLinkChange: boolean;
			preserveScheduleFields: boolean;
			preserveTopic: boolean;
			associatedNotePaths: string[];
			titleManuallyEdited: boolean;
			parameterContext: IRParameterContext | null;
		},
	): Promise<{ changed: boolean; sourceDocumentPath?: string }> {
		const existing = await this.epubService.getTask(pointId);
		if (!existing) {
			throw new Error("reading-point-edit-not-found");
		}

		const snapshot = await this.pointStorage.getPointSnapshotById(pointId);
		const metadata = this.buildMetadataPatch(
			snapshot?.point.metadata as Record<string, unknown>,
			{
				titleManuallyEdited: input.titleManuallyEdited,
				parameterContextOverride: Boolean(input.parameterContext),
				pointTitle: input.title,
				...(input.linkChanged && input.savedResumeLink
					? { resumeLink: input.savedResumeLink }
					: {}),
			},
		);

		const topicId = input.preserveTopic
			? String(existing.topicId || existing.deckId || input.deckId || "").trim()
			: input.deckId;
		const locator = { ...(snapshot?.point.trace?.locator || {}) };
		if (input.linkChanged && input.parsedTarget && input.savedResumeLink) {
			if (input.parsedTarget.kind === "epub") {
				if (input.parsedTarget.epubCfi) {
					locator.resumeCfi = input.parsedTarget.epubCfi;
				}
				if (input.parsedTarget.epubTocHref) {
					locator.tocHref = input.parsedTarget.epubTocHref;
				}
			} else {
				locator.resumeCfi = undefined;
				locator.tocHref = undefined;
			}
			locator.resumeLink = input.savedResumeLink;
		}

		const epubUpdates: Partial<IREpubBookmarkTask> = {
			title: input.title,
			tags: input.tags,
		};

		if (!input.preserveTopic) {
			epubUpdates.topicId = topicId;
			epubUpdates.deckId = topicId;
		}

		if (!input.preserveScheduleFields) {
			epubUpdates.priorityUi = input.priority;
			epubUpdates.priorityEff = input.priority;
			epubUpdates.nextRepDate =
				input.preserveScheduleOnLinkChange && input.linkChanged
					? existing.nextRepDate
					: input.nextRepDate;
		}

		await this.epubService.updateTask(pointId, {
			...epubUpdates,
			tocHref:
				input.linkChanged &&
				input.parsedTarget?.kind === "epub" &&
				input.parsedTarget.epubTocHref
					? input.parsedTarget.epubTocHref
					: existing.tocHref,
			meta: {
				...(existing.meta || {}),
				primaryAssociatedNotePath: input.associatedNotePaths[0],
				associatedNotePath: input.associatedNotePaths[0],
				associatedNotePaths: input.associatedNotePaths,
				...(input.linkChanged && input.savedResumeLink
					? { resumeLink: input.savedResumeLink }
					: {}),
			},
		});

		await this.pointStorage.syncLegacyPoint(
			{
				id: pointId,
				topicId,
				title: input.title,
				note: input.note,
				isStarred: input.isStarred,
				tags: input.tags,
				status: existing.status,
				...(input.preserveScheduleFields
					? {}
					: {
							priorityUi: input.priority,
							priorityEff: input.priority,
					  }),
				intervalDays: existing.intervalDays,
				nextRepDate:
					input.preserveScheduleFields ||
					(input.preserveScheduleOnLinkChange && input.linkChanged)
						? existing.nextRepDate
						: input.nextRepDate,
				sourceType: "epub-bookmark",
				sourcePath: existing.epubFilePath,
				materialId: existing.sourceId,
				locatorType: "epub-chapter",
				locator,
				linkedNotePaths: input.associatedNotePaths,
				metadata,
				parameterContext: input.parameterContext || undefined,
			},
			{ preserveExisting: true },
		);

		if (input.linkChanged && input.parsedTarget && input.savedResumeLink) {
			await this.updateTraceRecord(
				pointId,
				input.parsedTarget,
				input.savedResumeLink,
			);
		}

		return {
			changed: true,
			sourceDocumentPath: normalizePath(existing.epubFilePath),
		};
	}

	private async saveChunkPoint(
		chunk: IRChunkFileData,
		input: {
			title: string;
			deckId: string;
			priority: number;
			nextRepDate: number;
			tags: string[];
			isStarred: boolean;
			note: string;
			linkChanged: boolean;
			parsedTarget: ParsedReadingTarget | null;
			savedResumeLink: string | null;
			preserveScheduleOnLinkChange: boolean;
			preserveScheduleFields: boolean;
			preserveTopic: boolean;
			associatedNotePaths: string[];
			titleManuallyEdited: boolean;
			parameterContext: IRParameterContext | null;
		},
	): Promise<{ changed: boolean; sourceDocumentPath?: string }> {
		const snapshot = await this.pointStorage.getPointSnapshotById(
			chunk.chunkId,
		);
		const metadata = this.buildMetadataPatch(
			snapshot?.point.metadata as Record<string, unknown>,
			{
				titleManuallyEdited: input.titleManuallyEdited,
				parameterContextOverride: Boolean(input.parameterContext),
				pointTitle: input.title,
				...(input.linkChanged && input.savedResumeLink
					? { resumeLink: input.savedResumeLink }
					: {}),
			},
		);

		if (!input.preserveTopic) {
			chunk.topicIds = [input.deckId];
			chunk.deckIds = [input.deckId];
		}
		if (!input.preserveScheduleFields) {
			chunk.priorityUi = input.priority;
			chunk.priorityEff = input.priority;
			if (!input.preserveScheduleOnLinkChange || !input.linkChanged) {
				chunk.nextRepDate = input.nextRepDate;
			}
		}
		chunk.favorite = input.isStarred;
		(chunk as { tags?: string[] }).tags = input.tags;
		chunk.meta = {
			...(chunk.meta || {}),
			pointTitle: input.title,
			...(input.linkChanged && input.savedResumeLink
				? { resumeLink: input.savedResumeLink }
				: {}),
		};

		await this.storage.saveChunkData(chunk);
		await this.pointStorage.syncChunkPoint(chunk, { preserveExisting: true });
		await this.pointStorage.syncLegacyPoint(
			{
				id: chunk.chunkId,
				topicId: input.preserveTopic
					? String(
							chunk.topicIds?.[0] || chunk.deckIds?.[0] || input.deckId || "",
					  ).trim()
					: input.deckId,
				title: input.title,
				note: input.note,
				isStarred: input.isStarred,
				tags: input.tags,
				status: chunk.scheduleStatus || "new",
				...(input.preserveScheduleFields
					? {}
					: {
							priorityUi: input.priority,
							priorityEff: input.priority,
					  }),
				intervalDays: chunk.intervalDays,
				nextRepDate: chunk.nextRepDate,
				sourceType: "ir-chunk",
				sourcePath: chunk.filePath,
				locatorType: "markdown-chunk",
				locator: {
					chunkId: chunk.chunkId,
					chunkFilePath: chunk.filePath,
					sourcePath: chunk.filePath,
					...(input.linkChanged && input.savedResumeLink
						? { resumeLink: input.savedResumeLink }
						: {}),
				},
				linkedNotePaths: input.associatedNotePaths,
				metadata,
				parameterContext: input.parameterContext || undefined,
			},
			{ preserveExisting: true },
		);

		if (input.linkChanged && input.parsedTarget && input.savedResumeLink) {
			await this.updateTraceRecord(
				chunk.chunkId,
				input.parsedTarget,
				input.savedResumeLink,
			);
		}

		return {
			changed: true,
			sourceDocumentPath: normalizePath(chunk.filePath),
		};
	}

	private async saveLegacyBlockPoint(
		block: IRBlock,
		input: {
			title: string;
			deckId: string;
			priority: number;
			nextRepDate: number;
			tags: string[];
			isStarred: boolean;
			note: string;
			linkChanged: boolean;
			parsedTarget: ParsedReadingTarget | null;
			savedResumeLink: string | null;
			preserveScheduleOnLinkChange: boolean;
			preserveScheduleFields: boolean;
			preserveTopic: boolean;
			titleManuallyEdited: boolean;
			parameterContext: IRParameterContext | null;
		},
	): Promise<{ changed: boolean; sourceDocumentPath?: string }> {
		block.headingText = input.title;
		if (!input.preserveScheduleFields) {
			block.priorityUi = input.priority;
			block.priorityEff = input.priority;
			block.priority = input.priority >= 6 ? 1 : input.priority >= 4 ? 2 : 3;
			if (!input.preserveScheduleOnLinkChange || !input.linkChanged) {
				block.nextReview = new Date(input.nextRepDate).toISOString();
			}
		}
		block.notes = input.note;
		block.favorite = input.isStarred;
		block.tags = input.tags;
		if (!input.preserveTopic) {
			block.deckPath = input.deckId;
		}

		if (input.linkChanged && input.parsedTarget?.sourceFilePath) {
			block.filePath = input.parsedTarget.sourceFilePath;
		}
		if (input.linkChanged && input.parsedTarget?.blockId) {
			block.blockIndex = undefined;
			(block as IRBlock & { blockId?: string }).blockId =
				input.parsedTarget.blockId;
		}

		await this.storage.saveBlock(block);

		const snapshot = await this.pointStorage.getPointSnapshotById(block.id);
		const metadata = this.buildMetadataPatch(
			snapshot?.point.metadata as Record<string, unknown>,
			{
				titleManuallyEdited: input.titleManuallyEdited,
				parameterContextOverride: Boolean(input.parameterContext),
				...(input.linkChanged && input.savedResumeLink
					? { resumeLink: input.savedResumeLink }
					: {}),
			},
		);

		await this.pointStorage.syncLegacyPoint(
			{
				id: block.id,
				topicId: input.preserveTopic
					? String(block.deckPath || input.deckId || "").trim()
					: input.deckId,
				title: input.title,
				note: input.note,
				isStarred: input.isStarred,
				tags: input.tags,
				status: block.state || "new",
				...(input.preserveScheduleFields
					? {}
					: {
							priorityUi: input.priority,
							priorityEff: input.priority,
					  }),
				intervalDays: block.interval ?? 1,
				nextRepDate: input.preserveScheduleFields
					? Number(migrateToIRBlockV4(block).nextRepDate || 0)
					: input.nextRepDate,
				sourceType: "legacy-block",
				sourcePath: block.filePath,
				locatorType: "markdown-block",
				locator: {
					filePath: block.filePath,
					sourcePath: block.filePath,
					startLine: block.startLine,
					endLine: block.endLine ?? block.startLine,
					...(input.linkChanged && input.parsedTarget?.blockId
						? { blockId: input.parsedTarget.blockId }
						: {}),
					...(input.linkChanged && input.savedResumeLink
						? { resumeLink: input.savedResumeLink }
						: {}),
				},
				metadata,
				parameterContext: input.parameterContext || undefined,
			},
			{ preserveExisting: true },
		);

		if (input.linkChanged && input.parsedTarget && input.savedResumeLink) {
			await this.updateTraceRecord(
				block.id,
				input.parsedTarget,
				input.savedResumeLink,
			);
		}

		return {
			changed: true,
			sourceDocumentPath: normalizePath(block.filePath),
		};
	}

	private async updateTraceRecord(
		pointId: string,
		parsedTarget: ParsedReadingTarget,
		savedResumeLink: string,
	): Promise<void> {
		const snapshot = await this.pointStorage.getPointSnapshotById(pointId);
		if (!snapshot) {
			return;
		}

		const traceState = buildTraceStateFromValidation(parsedTarget);
		const nowIso = new Date().toISOString();
		await this.pointStorage.syncLegacyPoint(
			{
				id: pointId,
				topicId: snapshot.topicId,
				title: snapshot.point.userData.title,
				status: snapshot.point.schedule.status,
				sourceType:
					snapshot.point.source.type === "pdf"
						? "pdf-bookmark"
						: snapshot.point.source.type === "epub"
						? "epub-bookmark"
						: snapshot.point.pointType === "chunk-entry"
						? "ir-chunk"
						: "legacy-block",
				sourcePath: snapshot.point.source.path,
				locatorType: snapshot.point.trace.locatorType,
				locator: {
					...snapshot.point.trace.locator,
					resumeLink: savedResumeLink,
				},
				traceState,
				traceConfidence: traceState === "verified" ? 1 : 0.5,
				lastVerifiedAt: nowIso,
			},
			{ preserveExisting: true },
		);
	}
}
