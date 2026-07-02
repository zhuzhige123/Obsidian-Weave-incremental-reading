import { Notice, TFile, normalizePath, type App } from "obsidian";
import { i18n } from "../../../utils/i18n";
import {
	generateUniqueVaultFilePath,
	resolveIRReadableMarkdownTargetFolder,
} from "../IRReadableMarkdownPathResolver";
import { IRHostSharedService } from "../IRHostSharedService";
import { IRPointWriteService } from "../IRPointWriteService";
import { recomputeAndBroadcastIRData } from "../IRScheduleRefreshService";
import { getIrEpubStorageService } from "../../epub-integration/ir-epub-storage-access";
import { IREpubBookmarkTaskService, isEpubBookmarkTaskId } from "../IREpubBookmarkTaskService";
import { IRPdfBookmarkTaskService, isPdfBookmarkTaskId } from "../IRPdfBookmarkTaskService";
import { IRPointStorageService } from "../IRPointStorageService";
import { IRStorageService } from "../IRStorageService";
import { buildWebReadingPointMarkdown } from "../ir-web-reading-point";
import {
	blockReferencesObsidianId,
	buildObsidianEmbedBlockWikiLink,
} from "../paragraph-workbench/paragraph-block-reference";
import type {
	IRReadingTargetAddInput,
	IRReadingTargetAddResult,
	IRReadingTargetSchedulePin,
	ParsedReadingTarget,
} from "./IRReadingTargetTypes";
import { resolveReadingTargetSchedulePin } from "./IRReadingTargetScheduleDate";

function resolveSchedulePin(scheduleDate: Date): IRReadingTargetSchedulePin {
	return resolveReadingTargetSchedulePin(scheduleDate);
}

function sanitizeReadingPointFileName(title: string): string {
	const cleaned = String(title || "")
		.replace(/[\\/:*?"<>|]/g, "_")
		.replace(/\.+$/g, "")
		.trim();
	return cleaned.slice(0, 120) || `阅读点-${Date.now()}`;
}

async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
	const normalizedFolder = normalizePath(String(folderPath || "").trim()) || "/";
	if (normalizedFolder === "/") {
		return;
	}
	const segments = normalizedFolder.split("/").filter(Boolean);
	let currentPath = "";
	for (const segment of segments) {
		currentPath = currentPath ? `${currentPath}/${segment}` : segment;
		if (!app.vault.getAbstractFileByPath(currentPath)) {
			await app.vault.createFolder(currentPath);
		}
	}
}

async function attachBlockToDeck(
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

async function applyPointSchedulePin(
	app: App,
	pointId: string,
	schedulePin: IRReadingTargetSchedulePin,
	resumeLink?: string
): Promise<void> {
	const storage = new IRStorageService(app);
	await storage.initialize();

	if (isPdfBookmarkTaskId(pointId)) {
		const pdfService = new IRPdfBookmarkTaskService(app);
		await pdfService.initialize();
		const existing = await pdfService.getTask(pointId);
		if (!existing) {
			return;
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
		const pointService = new IRPointStorageService(app);
		await pointService.initialize();
		const snapshot = await pointService.getPointSnapshotById(pointId);
		if (!snapshot) {
			return;
		}
		const locator = snapshot.point.trace?.locator || {};
		await pointService.syncLegacyPoint(
			{
				id: pointId,
				topicId: String(snapshot.topicId || "").trim(),
				title: String(snapshot.point.userData?.title || snapshot.point.id || pointId).trim(),
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
			{ preserveExisting: true }
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
		return;
	}
	block.nextReview = new Date(schedulePin.nextRepDate).toISOString();
	await storage.saveBlock(block);

	const service = new IRPointStorageService(app);
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
		{ preserveExisting: true }
	);
}

async function appendSourceBacklinkIfEnabled(
	app: App,
	target: ParsedReadingTarget,
	deckName: string,
	title: string,
	enabled: boolean
): Promise<void> {
	if (!enabled || !target.sourceFilePath || target.kind === "web") {
		return;
	}

	const file = app.vault.getAbstractFileByPath(target.sourceFilePath);
	if (!(file instanceof TFile) || file.extension !== "md") {
		return;
	}

	const callout = `\n\n> [!info] 增量阅读\n> 已加入专题「${deckName}」：${title}\n`;
	const content = await app.vault.read(file);
	if (content.includes(callout.trim())) {
		return;
	}
	await app.vault.modify(file, `${content.replace(/\s*$/, "")}${callout}`);
}

export class IRReadingTargetAddService {
	private readonly host: IRHostSharedService;

	constructor(private readonly app: App) {
		this.host = new IRHostSharedService(app);
	}

	async addReadingTarget(input: IRReadingTargetAddInput): Promise<IRReadingTargetAddResult> {
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

		if (target.kind === "pdf-batch" && target.pdfPoints?.length) {
			const ids: string[] = [];
			const pointWriteService = new IRPointWriteService(this.app);
			const sequenceGroup =
				target.pdfPoints.length > 1
					? `reading-target-batch:${deckId}:${anchorPin.dateKey}:${Date.now().toString(36)}`
					: undefined;

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
				await attachBlockToDeck(storage, deckId, point.pdfPath, created.id);
				await applyPointSchedulePin(this.app, created.id, schedulePin, point.resumeLink);
				ids.push(created.id);
			}
			await recomputeAndBroadcastIRData(this.app, "import_materials", { deckIds: [deckId] });
			return { createdIds: ids, kind: target.kind, deckName: deck.name };
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
			await attachBlockToDeck(storage, deckId, target.sourceFilePath || target.pdfPath || "", created.id);
			await applyPointSchedulePin(this.app, created.id, schedulePin, target.resumeLink);
			await recomputeAndBroadcastIRData(this.app, "import_materials", { deckIds: [deckId] });
			return { createdIds: [created.id], kind: target.kind, deckName: deck.name };
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
				target.sourceFilePath || ""
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
						task.title === title
				);
			});
			if (duplicate) {
				await storage.addBlocksToDeck(deckId, [duplicate.id]);
				await applyPointSchedulePin(
					this.app,
					duplicate.id,
					schedulePin,
					target.epubResumeLink || target.resumeLink
				);
				await recomputeAndBroadcastIRData(this.app, "import_materials", { deckIds: [deckId] });
				new Notice(i18n.t("irServiceNotices.readingTarget.epubLocationExists", { deckName: deck.name }), 3000);
				return { createdIds: [duplicate.id], kind: target.kind, deckName: deck.name };
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
			await applyPointSchedulePin(
				this.app,
				created.id,
				schedulePin,
				target.epubResumeLink || target.resumeLink
			);
			await recomputeAndBroadcastIRData(this.app, "import_materials", { deckIds: [deckId] });
			return { createdIds: [created.id], kind: target.kind, deckName: deck.name };
		}

		if (target.kind === "web" || input.createNote) {
			return await this.createNoteBackedTarget(input, title, deck.id, deck.name, schedulePin, storage);
		}

		return await this.createLightweightVaultTarget(
			input,
			title,
			deck.id,
			deck.name,
			schedulePin,
			storage
		);
	}

	private async createNoteBackedTarget(
		input: IRReadingTargetAddInput,
		title: string,
		deckId: string,
		deckName: string,
		_schedulePin: IRReadingTargetSchedulePin,
		_storage: IRStorageService
	): Promise<IRReadingTargetAddResult> {
		const target = input.target;
		const folderPath =
			normalizePath(
				String(input.noteFolderPath || "").trim() ||
					resolveIRReadableMarkdownTargetFolder(this.app, {
						allowActiveFileFallback: false,
					})
			) || "/";

		await ensureFolderExists(this.app, folderPath);
		const fileContent =
			target.kind === "web" && target.webUrl
				? buildWebReadingPointMarkdown(title, target.webUrl)
				: `# ${title}\n\n${target.displayLink || `[[${target.resumeLink}|${title}]]`}\n`;

		const targetPath = await generateUniqueVaultFilePath(
			this.app,
			folderPath,
			`${sanitizeReadingPointFileName(title)}.md`
		);
		const createdFile = await this.app.vault.create(targetPath, fileContent);

		await this.host.ensureExternalDocumentChunkScheduled(createdFile, deckId, deckName, {
			scheduleDate: input.scheduleDate,
			resumeLink: target.webUrl || target.resumeLink,
			webUrl: target.webUrl,
		});

		await appendSourceBacklinkIfEnabled(
			this.app,
			target,
			deckName,
			title,
			Boolean(input.appendSourceBacklink)
		);

		await recomputeAndBroadcastIRData(this.app, "import_materials", { deckIds: [deckId] });
		return {
			createdIds: [createdFile.basename],
			kind: target.kind,
			deckName,
		};
	}

	private async createLightweightVaultTarget(
		input: IRReadingTargetAddInput,
		title: string,
		deckId: string,
		deckName: string,
		schedulePin: IRReadingTargetSchedulePin,
		storage: IRStorageService
	): Promise<IRReadingTargetAddResult> {
		const target = input.target;
		const sourcePath = normalizePath(String(target.sourceFilePath || "").trim());
		if (!sourcePath) {
			throw new Error("reading-target-missing-source");
		}

		const { createDefaultIRBlock, generateIRBlockId } = await import("../../../types/ir-types");
		const existingBlocks = await storage.getBlocksByFile(sourcePath);
		if (target.blockId) {
			const duplicate = existingBlocks.find((block) =>
				blockReferencesObsidianId(block, target.blockId || "")
			);
			if (duplicate) {
				await storage.addBlocksToDeck(deckId, [duplicate.id]);
				await applyPointSchedulePin(this.app, duplicate.id, schedulePin, target.resumeLink);
				await recomputeAndBroadcastIRData(this.app, "import_materials", { deckIds: [deckId] });
				new Notice(i18n.t("irServiceNotices.readingTarget.blockRefExists", { deckName }), 3000);
				return { createdIds: [duplicate.id], kind: target.kind, deckName };
			}
		}

		const blockRefLink =
			target.blockId && target.sourceFilePath
				? buildObsidianEmbedBlockWikiLink(target.sourceFilePath, target.blockId, title)
				: target.displayLink || `[[${target.resumeLink}|${title}]]`;

		const blockId = generateIRBlockId();
		const block = createDefaultIRBlock(blockId, sourcePath, title ? [title] : [], 0, 0);
		block.headingText = title;
		block.contentPreview = title;
		block.deckPath = deckId;
		block.notes = blockRefLink;
		block.nextReview = new Date(schedulePin.nextRepDate).toISOString();
		block.priorityUi = input.priorityUi ?? 5;
		block.priorityEff = input.priorityUi ?? 5;

		await storage.saveBlock(block);
		await attachBlockToDeck(storage, deckId, sourcePath, block.id);
		await applyPointSchedulePin(this.app, block.id, schedulePin, target.resumeLink);

		await appendSourceBacklinkIfEnabled(
			this.app,
			target,
			deckName,
			title,
			Boolean(input.appendSourceBacklink)
		);

		await recomputeAndBroadcastIRData(this.app, "import_materials", { deckIds: [deckId] });
		return { createdIds: [block.id], kind: target.kind, deckName };
	}
}