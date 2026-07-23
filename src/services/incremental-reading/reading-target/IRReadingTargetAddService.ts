import { type App, Notice, TFile, normalizePath } from "obsidian";
import { i18n } from "../../../utils/i18n";
import { getIrEpubStorageService } from "../../epub-integration/ir-epub-storage-access";
import {
	IREpubBookmarkTaskService,
	isEpubBookmarkTaskId,
} from "../IREpubBookmarkTaskService";
import { IRHostSharedService } from "../IRHostSharedService";
import {
	IRPdfBookmarkTaskService,
	isPdfBookmarkTaskId,
} from "../IRPdfBookmarkTaskService";
import { getSharedIRPointStorageService } from "../IRPointStorageService";
import { IRPointWriteService } from "../IRPointWriteService";
import {
	generateUniqueVaultFilePath,
	resolveIRReadableMarkdownTargetFolder,
} from "../IRReadableMarkdownPathResolver";
import { getSharedIRDueDateIndexService } from "../IRDueDateIndexService";
import { getSharedIRLegacyPointUnificationService } from "../IRLegacyPointUnificationService";
import { recomputeAndBroadcastIRData } from "../IRScheduleRefreshService";
import { IRStorageService } from "../IRStorageService";
import { buildWebReadingPointMarkdown } from "../ir-web-reading-point";
import {
	blockReferencesObsidianId,
	buildObsidianEmbedBlockWikiLink,
} from "../paragraph-workbench/paragraph-block-reference";
import { ensureCanvasReadingTargetScheduled } from "./IRReadingTargetCanvas";
import { resolveReadingTargetSchedulePin } from "./IRReadingTargetScheduleDate";
import type {
	IRReadingTargetAddInput,
	IRReadingTargetAddOutcome,
	IRReadingTargetAddResult,
	IRReadingTargetKind,
	IRReadingTargetSchedulePin,
	ParsedReadingTarget,
} from "./IRReadingTargetTypes";
import { ensureVaultReadingTargetScheduled } from "./IRReadingTargetVaultChunk";

function resolveSchedulePin(scheduleDate: Date): IRReadingTargetSchedulePin {
	return resolveReadingTargetSchedulePin(scheduleDate);
}

function sanitizeReadingPointFileName(title: string): string {
	const cleaned = String(title || "")
		.replace(/[\\/:*?"<>|]/g, "_")
		.replace(/\.+$/g, "")
		.trim();
	return (
		cleaned.slice(0, 120) ||
		i18n.t("irServiceNotices.readingTarget.defaultFileName", {
			ts: String(Date.now()),
		})
	);
}

async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
	const normalizedFolder =
		normalizePath(String(folderPath || "").trim()) || "/";
	if (normalizedFolder === "/") {
		return;
	}
	const segments = normalizedFolder.split("/").filter(Boolean);
	let currentPath = "";
	for (const segment of segments) {
		currentPath = currentPath ? `${currentPath}/${segment}` : segment;
		const existing = app.vault.getAbstractFileByPath(currentPath);
		if (!existing) {
			await app.vault.createFolder(currentPath);
			continue;
		}
		if (existing instanceof TFile) {
			throw new Error("reading-target-invalid-folder");
		}
	}
}

async function attachBlockToDeck(
	storage: IRStorageService,
	deckId: string,
	sourcePath: string,
	blockId: string,
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

/** @internal exported for unit tests */
export async function applyReadingTargetSchedulePin(
	app: App,
	pointId: string,
	schedulePin: IRReadingTargetSchedulePin,
	resumeLink?: string,
): Promise<void> {
	const storage = new IRStorageService(app);
	await storage.initialize();

	if (isPdfBookmarkTaskId(pointId)) {
		const pdfService = new IRPdfBookmarkTaskService(app);
		await pdfService.initialize();
		const existing = await pdfService.getTask(pointId);
		if (!existing) {
			throw new Error("reading-target-schedule-pin-failed");
		}
		await pdfService.updateTask(pointId, {
			nextRepDate: schedulePin.nextRepDate,
			meta: {
				sourceSequenceLocked: true,
				sourceSequenceAnchorDateKey: schedulePin.dateKey,
				...(resumeLink ? { resumeLink } : {}),
			},
		});
		return;
	}

	if (isEpubBookmarkTaskId(pointId)) {
		const pointService = getSharedIRPointStorageService(app);
		await pointService.initialize();
		const snapshot = await pointService.getPointSnapshotById(pointId);
		if (!snapshot) {
			throw new Error("reading-target-schedule-pin-failed");
		}
		const locator = snapshot.point.trace?.locator || {};
		await pointService.syncLegacyPoint(
			{
				id: pointId,
				topicId: String(snapshot.topicId || "").trim(),
				title: String(
					snapshot.point.userData?.title || snapshot.point.id || pointId,
				).trim(),
				status: snapshot.point.schedule?.status || "new",
				sourceType: "epub-bookmark",
				sourcePath: String(snapshot.point.source?.path || "").trim(),
				materialId: snapshot.point.materialId,
				locatorType: "epub-chapter",
				locator,
				nextRepDate: schedulePin.nextRepDate,
				metadata: {
					sourceSequenceLocked: true,
					sourceSequenceAnchorDateKey: schedulePin.dateKey,
					...(resumeLink ? { resumeLink } : {}),
				},
			},
			{ preserveExisting: true },
		);
		return;
	}

	const chunk = await storage.getChunkData(pointId);
	if (chunk) {
		chunk.nextRepDate = schedulePin.nextRepDate;
		chunk.scheduleStatus = "new";
		chunk.meta = {
			...(chunk.meta || {}),
			sourceSequenceLocked: true,
			sourceSequenceAnchorDateKey: schedulePin.dateKey,
			...(resumeLink ? { resumeLink } : {}),
		};
		await storage.saveChunkData(chunk);
		return;
	}

	const block = await storage.getBlock(pointId);
	if (!block) {
		throw new Error("reading-target-schedule-pin-failed");
	}
	block.nextReview = new Date(schedulePin.nextRepDate).toISOString();
	await storage.saveBlock(block);

	const service = getSharedIRPointStorageService(app);
	await service.initialize();
	await service.syncLegacyPoint(
		{
			id: block.id,
			topicId: block.deckPath,
			title: block.headingText || block.id,
			status: block.state || "new",
			sourceType: "legacy-block",
			sourcePath: block.filePath,
			locatorType: "markdown-block",
			locator: {
				filePath: block.filePath,
				sourcePath: block.filePath,
				startLine: block.startLine,
				endLine: block.endLine ?? block.startLine,
			},
			nextRepDate: schedulePin.nextRepDate,
			note: block.notes,
			metadata: {
				sourceSequenceLocked: true,
				sourceSequenceAnchorDateKey: schedulePin.dateKey,
				...(resumeLink ? { resumeLink } : {}),
			},
		},
		{ preserveExisting: true },
	);
}

async function rollbackCreatedPdfPoints(
	app: App,
	storage: IRStorageService,
	deckId: string,
	createdIds: string[],
): Promise<void> {
	if (createdIds.length === 0) {
		return;
	}

	const pointWriteService = new IRPointWriteService(app);
	for (const pointId of createdIds) {
		try {
			await pointWriteService.deletePoint({ id: pointId, kind: "pdf" });
		} catch {
			// best-effort cleanup
		}
	}

	const deck = await storage.getDeckById(deckId);
	if (!deck) {
		return;
	}
	const removeIds = new Set(createdIds);
	const nextBlockIds = (deck.blockIds || []).filter((id) => !removeIds.has(id));
	if (nextBlockIds.length !== (deck.blockIds || []).length) {
		deck.blockIds = nextBlockIds;
		deck.updatedAt = new Date().toISOString();
		await storage.saveDeck(deck);
	}
}

async function appendSourceBacklinkIfEnabled(
	app: App,
	target: ParsedReadingTarget,
	deckName: string,
	title: string,
	enabled: boolean,
): Promise<void> {
	if (!enabled || !target.sourceFilePath || target.kind === "web") {
		return;
	}

	const file = app.vault.getAbstractFileByPath(target.sourceFilePath);
	if (!(file instanceof TFile) || file.extension !== "md") {
		return;
	}

	const callout = `\n\n> [!info] ${i18n.t(
		"irServiceNotices.readingTarget.backlinkCalloutTitle",
	)}\n> ${i18n.t("irServiceNotices.readingTarget.backlinkCalloutBody", {
		deckName,
		title,
	})}\n`;
	const content = await app.vault.read(file);
	if (content.includes(callout.trim())) {
		return;
	}
	await app.vault.modify(file, `${content.replace(/\s*$/, "")}${callout}`);
}

/**
 * L0 due 增量 + 定向 lean L2。添加不是 bulk import，禁止裸 import_materials 全库 invalidation。
 */
async function finalizeReadingTargetAdd(
	app: App,
	options: {
		deckId: string;
		schedulePin: IRReadingTargetSchedulePin;
		createdIds: string[];
		kind: IRReadingTargetKind;
		deckName: string;
		outcome: IRReadingTargetAddOutcome;
		parentPointId?: string | null;
	},
): Promise<IRReadingTargetAddResult> {
	const dueIndex = getSharedIRDueDateIndexService(app);
	for (const pointId of options.createdIds) {
		const normalizedId = String(pointId || "").trim();
		if (!normalizedId) {
			continue;
		}
		await dueIndex.updatePointDueDate(
			normalizedId,
			undefined,
			options.schedulePin.nextRepDate,
		);
	}
	await dueIndex.flushPendingWrites();

	const parentPointId = String(options.parentPointId || "").trim() || null;
	if (parentPointId && options.createdIds.length > 0) {
		const pointStorage = getSharedIRPointStorageService(app);
		for (const pointId of options.createdIds) {
			const normalizedId = String(pointId || "").trim();
			if (!normalizedId || normalizedId === parentPointId) {
				continue;
			}
			await pointStorage.updatePointParentId(normalizedId, parentPointId);
		}
	}

	await recomputeAndBroadcastIRData(app, "manual_reschedule", {
		deckIds: [options.deckId],
		priorityDateKeys: [options.schedulePin.dateKey],
		leanSchedule: true,
	});

	return {
		createdIds: options.createdIds,
		kind: options.kind,
		deckName: options.deckName,
		outcome: options.outcome,
		pinDateKey: options.schedulePin.dateKey,
	};
}

export class IRReadingTargetAddService {
	private readonly host: IRHostSharedService;

	constructor(private readonly app: App) {
		this.host = new IRHostSharedService(app);
	}

	async addReadingTarget(
		input: IRReadingTargetAddInput,
	): Promise<IRReadingTargetAddResult> {
		const title = this.host.cleanIRReadingPointTitle(input.title);
		if (!title) {
			throw new Error("reading-target-missing-title");
		}

		const deckId = String(input.deckId || "").trim();
		if (!deckId) {
			throw new Error("reading-target-missing-deck");
		}

		const storage = new IRStorageService(this.app);
		await storage.initialize();
		const deck = await storage.getDeckById(deckId);
		if (!deck || deck.archivedAt) {
			throw new Error("reading-target-deck-missing");
		}

		const schedulePin = resolveSchedulePin(input.scheduleDate);
		const anchorPin = schedulePin;
		const target = input.target;
		const parentPointId = String(input.parentPointId || "").trim() || null;

		if (target.kind === "pdf-batch" && target.pdfPoints?.length) {
			const ids: string[] = [];
			const pointWriteService = new IRPointWriteService(this.app);
			const sequenceGroup =
				target.pdfPoints.length > 1
					? `reading-target-batch:${deckId}:${
							anchorPin.dateKey
					  }:${Date.now().toString(36)}`
					: undefined;

			try {
				for (let index = 0; index < target.pdfPoints.length; index += 1) {
					const point = target.pdfPoints[index];
					const order = index + 1;
					const created = await pointWriteService.createPdfPoint({
						deckId,
						pdfPath: point.pdfPath,
						title: this.host.cleanIRReadingPointTitle(point.title) || title,
						link: point.resumeLink,
						sourceSequenceGroup: sequenceGroup,
						sourceSequenceOrder: sequenceGroup ? order : undefined,
						sourceSequenceLocked: Boolean(sequenceGroup),
						sourceSequenceAnchorDateKey: anchorPin.dateKey,
					});
					ids.push(created.id);
					await attachBlockToDeck(storage, deckId, point.pdfPath, created.id);
					await applyReadingTargetSchedulePin(
						this.app,
						created.id,
						schedulePin,
						point.resumeLink,
					);
				}
			} catch (error) {
				await rollbackCreatedPdfPoints(this.app, storage, deckId, ids);
				if (
					error instanceof Error &&
					error.message.startsWith("reading-target-")
				) {
					throw error;
				}
				throw new Error("reading-target-pdf-batch-failed");
			}

			return await finalizeReadingTargetAdd(this.app, {
				deckId,
				schedulePin,
				createdIds: ids,
				kind: target.kind,
				deckName: deck.name,
				outcome: "created",
				parentPointId,
			});
		}

		if (target.kind === "pdf") {
			const pointWriteService = new IRPointWriteService(this.app);
			const created = await pointWriteService.createPdfPoint({
				deckId,
				pdfPath: target.pdfPath || target.sourceFilePath || "",
				title,
				link: target.resumeLink,
				sourceSequenceLocked: true,
				sourceSequenceAnchorDateKey: schedulePin.dateKey,
			});
			await attachBlockToDeck(
				storage,
				deckId,
				target.sourceFilePath || target.pdfPath || "",
				created.id,
			);
			await applyReadingTargetSchedulePin(
				this.app,
				created.id,
				schedulePin,
				target.resumeLink,
			);
			return await finalizeReadingTargetAdd(this.app, {
				deckId,
				schedulePin,
				createdIds: [created.id],
				kind: target.kind,
				deckName: deck.name,
				outcome: "created",
				parentPointId,
			});
		}

		if (target.kind === "epub") {
			if (target.validationError) {
				throw new Error("reading-target-epub-invalid");
			}
			if (!target.epubCfi && !target.epubTocHref) {
				throw new Error("reading-target-epub-missing-cfi");
			}

			const epubStorage = getIrEpubStorageService(this.app);
			const resolvedPath = await epubStorage.resolveSourceFilePath(
				target.epubSourceId,
				target.sourceFilePath || "",
			);
			if (!resolvedPath) {
				throw new Error("reading-target-epub-unresolved");
			}

			const epubService = new IREpubBookmarkTaskService(this.app);
			await epubService.initialize();
			const existing = await epubService.getTasksByEpub(resolvedPath);
			const duplicate = existing.find((task) => {
				if (target.epubCfi && task.resumeCfi === target.epubCfi) {
					return true;
				}
				return Boolean(
					target.epubTocHref &&
						task.tocHref === target.epubTocHref &&
						task.title === title,
				);
			});
			if (duplicate) {
				await storage.addBlocksToDeck(deckId, [duplicate.id]);
				await applyReadingTargetSchedulePin(
					this.app,
					duplicate.id,
					schedulePin,
					target.epubResumeLink || target.resumeLink,
				);
				new Notice(
					i18n.t("irServiceNotices.readingTarget.epubLocationExists", {
						deckName: deck.name,
					}),
					3000,
				);
				return await finalizeReadingTargetAdd(this.app, {
					deckId,
					schedulePin,
					createdIds: [duplicate.id],
					kind: target.kind,
					deckName: deck.name,
					outcome: "existing",
					parentPointId,
				});
			}

			const pointWriteService = new IRPointWriteService(this.app);
			const created = await pointWriteService.createEpubPoint({
				deckId,
				epubFilePath: resolvedPath,
				sourceId: target.epubSourceId,
				title,
				tocHref: target.epubTocHref || resolvedPath,
				tocLevel: 1,
				sourceSequenceLocked: true,
				sourceSequenceAnchorDateKey: schedulePin.dateKey,
			});
			if (target.epubCfi) {
				await epubService.setResumePoint(created.id, target.epubCfi);
			}
			await attachBlockToDeck(storage, deckId, resolvedPath, created.id);
			await applyReadingTargetSchedulePin(
				this.app,
				created.id,
				schedulePin,
				target.epubResumeLink || target.resumeLink,
			);
			return await finalizeReadingTargetAdd(this.app, {
				deckId,
				schedulePin,
				createdIds: [created.id],
				kind: target.kind,
				deckName: deck.name,
				outcome: "created",
				parentPointId,
			});
		}

		if (target.kind === "canvas") {
			return await this.createCanvasTarget(
				input,
				title,
				deck.id,
				deck.name,
				schedulePin,
				storage,
			);
		}

		if (target.kind === "web" || input.createNote) {
			return await this.createNoteBackedTarget(
				input,
				title,
				deck.id,
				deck.name,
				schedulePin,
				storage,
			);
		}

		return await this.createLightweightVaultTarget(
			input,
			title,
			deck.id,
			deck.name,
			schedulePin,
			storage,
		);
	}

	private async createCanvasTarget(
		input: IRReadingTargetAddInput,
		title: string,
		deckId: string,
		deckName: string,
		schedulePin: IRReadingTargetSchedulePin,
		storage: IRStorageService,
	): Promise<IRReadingTargetAddResult> {
		const target = input.target;
		const parentPointId = String(input.parentPointId || "").trim() || null;
		const canvasPath = normalizePath(String(target.sourceFilePath || "").trim());
		const nodeId = String(target.canvasNodeId || "").trim();
		if (!canvasPath || !nodeId) {
			throw new Error("reading-target-canvas-invalid");
		}

		const scheduled = await ensureCanvasReadingTargetScheduled({
			storage,
			canvasPath,
			nodeId,
			resumeLink: target.resumeLink || target.displayLink || "",
			title,
			deckId,
			deckName,
			schedulePin,
			canvasTextCandidates: target.canvasTextCandidates,
		});

		let outcome: IRReadingTargetAddOutcome = "created";
		if (scheduled.result === "unchanged") {
			outcome = "existing";
			new Notice(
				i18n.t("irServiceNotices.readingTarget.canvasNodeExists", {
					deckName,
				}),
				3000,
			);
		} else if (scheduled.result === "updated") {
			outcome = "updated";
		}

		return await finalizeReadingTargetAdd(this.app, {
			deckId,
			schedulePin,
			createdIds: [scheduled.pointId],
			kind: target.kind,
			deckName,
			outcome,
			parentPointId,
		});
	}

	private async createNoteBackedTarget(
		input: IRReadingTargetAddInput,
		title: string,
		deckId: string,
		deckName: string,
		schedulePin: IRReadingTargetSchedulePin,
		storage: IRStorageService,
	): Promise<IRReadingTargetAddResult> {
		const target = input.target;
		const parentPointId = String(input.parentPointId || "").trim() || null;
		const folderPath =
			normalizePath(
				String(input.noteFolderPath || "").trim() ||
					resolveIRReadableMarkdownTargetFolder(this.app, {
						allowActiveFileFallback: false,
					}),
			) || "/";

		await ensureFolderExists(this.app, folderPath);
		const fileContent =
			target.kind === "web" && target.webUrl
				? buildWebReadingPointMarkdown(title, target.webUrl)
				: `# ${title}\n\n${
						target.displayLink || `[[${target.resumeLink}|${title}]]`
				  }\n`;

		const targetPath = await generateUniqueVaultFilePath(
			this.app,
			folderPath,
			`${sanitizeReadingPointFileName(title)}.md`,
		);
		const createdFile = await this.app.vault.create(targetPath, fileContent);

		await this.host.ensureExternalDocumentChunkScheduled(
			createdFile,
			deckId,
			deckName,
			{
				scheduleDate: input.scheduleDate,
				resumeLink: target.webUrl || target.resumeLink,
				webUrl: target.webUrl,
				storage,
			},
		);

		await appendSourceBacklinkIfEnabled(
			this.app,
			target,
			deckName,
			title,
			Boolean(input.appendSourceBacklink),
		);

		const chunks = await storage.getAllChunkData();
		const createdPath = normalizePath(createdFile.path);
		const scheduledChunk = Object.values(chunks).find(
			(chunk) => normalizePath(String(chunk.filePath || "").trim()) === createdPath,
		);

		return await finalizeReadingTargetAdd(this.app, {
			deckId,
			schedulePin,
			createdIds: [scheduledChunk?.chunkId || createdFile.path],
			kind: target.kind,
			deckName,
			outcome: "created",
			parentPointId,
		});
	}

	private async createLightweightVaultTarget(
		input: IRReadingTargetAddInput,
		title: string,
		deckId: string,
		deckName: string,
		schedulePin: IRReadingTargetSchedulePin,
		storage: IRStorageService,
	): Promise<IRReadingTargetAddResult> {
		const target = input.target;
		const parentPointId = String(input.parentPointId || "").trim() || null;
		const sourcePath = normalizePath(
			String(target.sourceFilePath || "").trim(),
		);
		if (!sourcePath) {
			throw new Error("reading-target-missing-source");
		}

		const resumeLink =
			target.blockId && target.sourceFilePath
				? buildObsidianEmbedBlockWikiLink(
						target.sourceFilePath,
						target.blockId,
						title,
				  )
				: target.displayLink ||
				  target.resumeLink ||
				  `[[${sourcePath}|${title}]]`;

		// 历史 lightweight 路径写过 legacy-block：同 block 先升级并补齐 resumeLink，再走 chunk 热路径。
		if (target.blockId) {
			const existingBlocks = await storage.getBlocksByFile(sourcePath);
			const legacyDuplicate = existingBlocks.find((block) =>
				blockReferencesObsidianId(block, target.blockId || ""),
			);
			if (legacyDuplicate) {
				const upgraded =
					await getSharedIRLegacyPointUnificationService(
						this.app,
					).upgradeLegacyBlockPointById(legacyDuplicate.id);
				if (upgraded) {
					const upgradedChunk = await storage.getChunkData(
						legacyDuplicate.id,
					);
					if (upgradedChunk) {
						upgradedChunk.meta = {
							...(upgradedChunk.meta || {}),
							externalDocument: true,
							resumeLink,
							notes: resumeLink,
							pointTitle: title,
						};
						await storage.saveChunkData(upgradedChunk, {
							skipScheduleCacheInvalidate: true,
						});
					}
				}
			}
		}

		const scheduled = await ensureVaultReadingTargetScheduled({
			storage,
			sourcePath,
			resumeLink,
			title,
			deckId,
			deckName,
			schedulePin,
			blockId: target.blockId,
			priorityUi: input.priorityUi,
		});

		let outcome: IRReadingTargetAddOutcome = "created";
		if (scheduled.result === "unchanged") {
			outcome = "existing";
			new Notice(
				i18n.t("irServiceNotices.readingTarget.blockRefExists", {
					deckName,
				}),
				3000,
			);
		} else if (scheduled.result === "updated") {
			outcome = "updated";
		}

		await appendSourceBacklinkIfEnabled(
			this.app,
			target,
			deckName,
			title,
			Boolean(input.appendSourceBacklink),
		);

		return await finalizeReadingTargetAdd(this.app, {
			deckId,
			schedulePin,
			createdIds: [scheduled.pointId],
			kind: target.kind,
			deckName,
			outcome,
			parentPointId,
		});
	}
}
