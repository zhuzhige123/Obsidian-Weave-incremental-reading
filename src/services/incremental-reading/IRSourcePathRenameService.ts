import { type App, TFile, TFolder, normalizePath } from "obsidian";
import { isIRDeckFilePath } from "../../utils/ir-internal-data-path";
import { logger } from "../../utils/logger";
import { getIrEpubStorageService } from "../epub-integration/ir-epub-storage-access";
import { getSharedIRHostCriticalWorkGuard } from "./IRHostCriticalWorkGuard";
import { getSharedIRPointStorageService } from "./IRPointStorageService";
import { recomputeAndBroadcastIRData } from "./IRScheduleRefreshService";
import { createReadingMaterialStorage } from "./ReadingMaterialStorage";

const RENAME_FLUSH_DEBOUNCE_MS = 320;

export interface IRSourcePathRenameResult {
	oldPath: string;
	newPath: string;
	updatedPointCount: number;
	updatedEpubRegistryCount: number;
	updatedMaterialSourceCount: number;
	updatedMaterialNoteCount: number;
}

/**
 * Obsidian-style path follow-up for IR reading points.
 *
 * Canonical write path is the point catalog (covers md/canvas/pdf/epub/chunk).
 * PDF/EPUB task façades are not rewritten separately — that would double-write
 * the same `.irdeck` files. EPUB registry is updated independently when available.
 */
export class IRSourcePathRenameService {
	private readonly app: App;
	private pendingRenames: Array<{ oldPath: string; newPath: string }> = [];
	private flushTimer: number | null = null;
	private flushInFlight: Promise<void> | null = null;
	private materialStoragePromise: Promise<
		ReturnType<typeof createReadingMaterialStorage>
	> | null = null;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Queue a vault rename. Debounced; work runs under HostCriticalWorkGuard.
	 */
	queueVaultRename(oldPath: string, newPath: string): void {
		const normalizedOld = normalizePath(String(oldPath || "").trim());
		const normalizedNew = normalizePath(String(newPath || "").trim());
		if (
			!normalizedOld ||
			!normalizedNew ||
			normalizedOld === normalizedNew ||
			isIRDeckFilePath(normalizedOld) ||
			isIRDeckFilePath(normalizedNew)
		) {
			return;
		}

		this.pendingRenames.push({
			oldPath: normalizedOld,
			newPath: normalizedNew,
		});

		if (this.flushTimer !== null) {
			window.clearTimeout(this.flushTimer);
		}
		this.flushTimer = window.setTimeout(() => {
			this.flushTimer = null;
			getSharedIRHostCriticalWorkGuard(this.app).runVaultBackgroundWork(
				async () => {
					await this.flushPendingRenames();
				},
			);
		}, RENAME_FLUSH_DEBOUNCE_MS);
	}

	handleVaultAbstractRename(file: TFile | TFolder, oldPath: string): void {
		this.queueVaultRename(oldPath, file.path);
	}

	async flushPendingRenames(): Promise<void> {
		if (this.flushInFlight) {
			await this.flushInFlight;
			if (this.pendingRenames.length === 0) {
				return;
			}
		}

		const batch = this.pendingRenames.splice(0);
		if (batch.length === 0) {
			return;
		}

		this.flushInFlight = this.processRenameBatch(batch).finally(() => {
			this.flushInFlight = null;
		});
		await this.flushInFlight;
	}

	private async processRenameBatch(
		batch: Array<{ oldPath: string; newPath: string }>,
	): Promise<void> {
		let totalUpdated = 0;

		for (const pair of batch) {
			try {
				const result = await this.applyRename(pair.oldPath, pair.newPath);
				totalUpdated +=
					result.updatedPointCount +
					result.updatedEpubRegistryCount +
					result.updatedMaterialSourceCount +
					result.updatedMaterialNoteCount;
			} catch (error) {
				logger.warn(
					"[IRSourcePathRenameService] Failed to apply source path rename:",
					pair.oldPath,
					"->",
					pair.newPath,
					error,
				);
			}
		}

		if (totalUpdated > 0) {
			try {
				await recomputeAndBroadcastIRData(this.app, "metadata_renamed");
			} catch (error) {
				logger.warn(
					"[IRSourcePathRenameService] Failed to recompute schedule after rename:",
					error,
				);
			}
		}
	}

	private async getMaterialStorage() {
		if (!this.materialStoragePromise) {
			this.materialStoragePromise = (async () => {
				const storage = createReadingMaterialStorage(this.app);
				await storage.initialize();
				return storage;
			})();
		}
		return this.materialStoragePromise;
	}

	/**
	 * Apply one rename to IR stores without redundant PDF/EPUB task rewrites.
	 */
	async applyRename(
		oldPath: string,
		newPath: string,
	): Promise<IRSourcePathRenameResult> {
		const pointStorage = getSharedIRPointStorageService(this.app);
		await pointStorage.initialize();

		const updatedPointCount = await pointStorage.remapSourceFileReferences(
			oldPath,
			newPath,
		);

		let updatedEpubRegistryCount = 0;
		const epubStorage = getIrEpubStorageService(this.app);
		if (typeof epubStorage.remapSourceFileReferences === "function") {
			try {
				updatedEpubRegistryCount = await epubStorage.remapSourceFileReferences(
					oldPath,
					newPath,
				);
			} catch (error) {
				logger.warn(
					"[IRSourcePathRenameService] EPUB registry path remap failed:",
					error,
				);
			}
		}

		const materialStorage = await this.getMaterialStorage();
		const materialResult = await materialStorage.remapVaultFileReferences(
			oldPath,
			newPath,
			{ includeSourcePath: true, includeAssociatedNotes: true },
		);

		const result: IRSourcePathRenameResult = {
			oldPath,
			newPath,
			updatedPointCount,
			updatedEpubRegistryCount,
			updatedMaterialSourceCount: materialResult.updatedSourceCount,
			updatedMaterialNoteCount: materialResult.updatedAssociatedNoteCount,
		};

		if (
			updatedPointCount > 0 ||
			updatedEpubRegistryCount > 0 ||
			materialResult.updatedSourceCount > 0 ||
			materialResult.updatedAssociatedNoteCount > 0
		) {
			logger.info("[IRSourcePathRenameService] Source paths remapped", result);
		}

		return result;
	}
}

const renameServiceByApp = new WeakMap<App, IRSourcePathRenameService>();

export function getSharedIRSourcePathRenameService(
	app: App,
): IRSourcePathRenameService {
	let service = renameServiceByApp.get(app);
	if (!service) {
		service = new IRSourcePathRenameService(app);
		renameServiceByApp.set(app, service);
	}
	return service;
}

/** @internal exported for tests */
export function __resetIRSourcePathRenameServiceForTests(app: App): void {
	renameServiceByApp.delete(app);
}
