import type { App } from "obsidian";
import { getPluginPaths } from "../../config/paths";
import type { IRBlock, IRChunkFileData } from "../../types/ir-types";
import { DirectoryUtils } from "../../utils/directory-utils";
import {
	isIRDeckGhostPointSnapshot,
	isIRInternalScheduleSourcePath,
	shouldExcludeScheduleItemBySource,
} from "../../utils/ir-internal-data-path";
import { logger } from "../../utils/logger";
import { scheduleIRDeckGhostPointCleanup } from "./IRDeckGhostPointCleanup";
import type { IREpubBookmarkTask } from "./IREpubBookmarkTaskService";
import { IREpubBookmarkTaskService } from "./IREpubBookmarkTaskService";
import {
	buildLegacyChunkFromPointSnapshot,
	buildLegacyEpubTaskFromPointSnapshot,
	buildLegacyPdfTaskFromPointSnapshot,
	getStoredPointKind,
} from "./IRLegacyTaskCompatAdapter";
import type { IRPdfBookmarkTask } from "./IRPdfBookmarkTaskService";
import { IRPdfBookmarkTaskService } from "./IRPdfBookmarkTaskService";
import {
	type IRPointStorageService,
	getSharedIRPointStorageService,
} from "./IRPointStorageService";
import {
	buildExternalBookmarkTasksRevision,
	buildScheduleFingerprint,
} from "./IRScheduleFingerprint";

export const IR_SCHEDULE_INDEX_VERSION = "1.1.0";

export interface IRScheduleIndexSources {
	chunks: IRChunkFileData[];
	blocks: IRBlock[];
	pdfTasks: IRPdfBookmarkTask[];
	epubTasks: IREpubBookmarkTask[];
	scheduleFingerprint: string;
	generatedAt: number;
	fromCache: boolean;
}

interface IRScheduleIndexStore {
	version: string;
	updatedAt: string;
	/** @deprecated 仅兼容旧磁盘格式；freshness 已改用 pointFilesRevision */
	snapshotCacheVersion?: number;
	pointFilesRevision: string;
	externalTasksRevision: string;
	scheduleFingerprint: string;
	chunks: IRChunkFileData[];
	blocks: IRBlock[];
	pdfTasks: IRPdfBookmarkTask[];
	epubTasks: IREpubBookmarkTask[];
}

export class IRScheduleIndexService {
	private memoryStore: IRScheduleIndexStore | null = null;
	private inflightBuild: Promise<IRScheduleIndexStore> | null = null;
	private readonly pointStorage: IRPointStorageService;
	private readonly pdfService: IRPdfBookmarkTaskService;
	private readonly epubService: IREpubBookmarkTaskService;

	constructor(private readonly app: App) {
		this.pointStorage = getSharedIRPointStorageService(app);
		this.pdfService = new IRPdfBookmarkTaskService(app);
		this.epubService = new IREpubBookmarkTaskService(app);
	}

	invalidate(): void {
		this.memoryStore = null;
		this.inflightBuild = null;
	}

	async getScheduleSources(): Promise<IRScheduleIndexSources> {
		const store = await this.ensureIndexStore();
		return {
			chunks: store.chunks,
			blocks: store.blocks,
			pdfTasks: store.pdfTasks,
			epubTasks: store.epubTasks,
			scheduleFingerprint: store.scheduleFingerprint,
			generatedAt: Date.parse(store.updatedAt) || Date.now(),
			fromCache: true,
		};
	}

	/**
	 * 冷启动预读：将新鲜磁盘索引载入内存，避免月历打开时重复判 stale。
	 */
	async warmDiskCache(): Promise<boolean> {
		if (
			this.memoryStore &&
			(await this.matchesPointFilesRevision(this.memoryStore))
		) {
			return true;
		}

		const diskStore = await this.readDiskStore();
		if (diskStore && (await this.matchesPointFilesRevision(diskStore))) {
			this.memoryStore = diskStore;
			logger.debug("[IRScheduleIndexService] schedule index warmed from disk", {
				chunks: diskStore.chunks.length,
				pdfTasks: diskStore.pdfTasks.length,
				epubTasks: diskStore.epubTasks.length,
			});
			return true;
		}
		return false;
	}

	/**
	 * 读取已缓存的调度指纹，不触发全库 point 扫描重建。
	 * 缓存过期时返回 null，调用方应走 stale 路径或按需 await getScheduleSources()。
	 */
	async peekScheduleFingerprint(): Promise<string | null> {
		try {
			if (await this.warmDiskCache()) {
				return (
					String(this.memoryStore?.scheduleFingerprint || "").trim() || null
				);
			}
		} catch (error) {
			logger.debug(
				"[IRScheduleIndexService] peekScheduleFingerprint unavailable",
				error,
			);
		}
		return null;
	}

	/**
	 * 仅返回已 warm 的 schedule 源，永不触发全库重建。
	 * 供 due 索引日列表 O(k) hydrate 使用。
	 */
	async peekWarmScheduleSources(): Promise<IRScheduleIndexSources | null> {
		try {
			if (!(await this.warmDiskCache()) || !this.memoryStore) {
				return null;
			}
			return {
				chunks: this.memoryStore.chunks,
				blocks: this.memoryStore.blocks,
				pdfTasks: this.memoryStore.pdfTasks,
				epubTasks: this.memoryStore.epubTasks,
				scheduleFingerprint: this.memoryStore.scheduleFingerprint,
				generatedAt: Date.parse(this.memoryStore.updatedAt) || Date.now(),
				fromCache: true,
			};
		} catch (error) {
			logger.debug(
				"[IRScheduleIndexService] peekWarmScheduleSources unavailable",
				error,
			);
			return null;
		}
	}

	private getIndexPath(): string {
		return getPluginPaths(this.app).cache.incrementalReading.scheduleIndex;
	}

	private normalizeStore(raw: unknown): IRScheduleIndexStore | null {
		if (!raw || typeof raw !== "object") {
			return null;
		}
		const candidate = raw as Partial<IRScheduleIndexStore>;
		const legacyFields = raw as Record<string, unknown>;
		const version = String(candidate.version || "").trim();
		if (version !== IR_SCHEDULE_INDEX_VERSION && version !== "1.0.0") {
			return null;
		}
		const legacySnapshotCacheVersion = legacyFields.snapshotCacheVersion;
		return {
			version: IR_SCHEDULE_INDEX_VERSION,
			updatedAt:
				typeof candidate.updatedAt === "string" && candidate.updatedAt.trim()
					? candidate.updatedAt
					: new Date().toISOString(),
			snapshotCacheVersion:
				typeof legacySnapshotCacheVersion === "number"
					? legacySnapshotCacheVersion
					: undefined,
			pointFilesRevision: String(candidate.pointFilesRevision || "").trim(),
			externalTasksRevision: String(candidate.externalTasksRevision || ""),
			scheduleFingerprint: String(candidate.scheduleFingerprint || ""),
			chunks: Array.isArray(candidate.chunks) ? candidate.chunks : [],
			blocks: Array.isArray(candidate.blocks) ? candidate.blocks : [],
			pdfTasks: Array.isArray(candidate.pdfTasks) ? candidate.pdfTasks : [],
			epubTasks: Array.isArray(candidate.epubTasks) ? candidate.epubTasks : [],
		};
	}

	private async readDiskStore(): Promise<IRScheduleIndexStore | null> {
		const adapter = this.app.vault.adapter;
		const indexPath = this.getIndexPath();
		try {
			if (!(await adapter.exists(indexPath))) {
				return null;
			}
			const content = await adapter.read(indexPath);
			return this.normalizeStore(JSON.parse(content));
		} catch (error) {
			logger.warn("[IRScheduleIndexService] 读取调度索引失败", error);
			return null;
		}
	}

	private async writeDiskStore(store: IRScheduleIndexStore): Promise<void> {
		const adapter = this.app.vault.adapter;
		const indexPath = this.getIndexPath();
		try {
			await DirectoryUtils.ensureDirForFile(adapter, indexPath);
			await adapter.write(indexPath, JSON.stringify(store));
		} catch (error) {
			logger.warn("[IRScheduleIndexService] 写入调度索引失败", error);
		}
	}

	private async getExternalTasksRevision(): Promise<string> {
		await Promise.all([
			this.pdfService.initialize(),
			this.epubService.initialize(),
		]);
		const [pdfTasks, epubTasks] = await Promise.all([
			this.pdfService.getAllTasks(),
			this.epubService.getAllTasks(),
		]);
		return buildExternalBookmarkTasksRevision([...pdfTasks, ...epubTasks]);
	}

	private async matchesPointFilesRevision(
		store: IRScheduleIndexStore,
	): Promise<boolean> {
		const pointFilesRevision = String(store.pointFilesRevision || "").trim();
		if (!pointFilesRevision) {
			return false;
		}
		await this.pointStorage.initialize();
		const currentRevision =
			await this.pointStorage.getPointFilesIndexRevision();
		return pointFilesRevision === currentRevision;
	}

	private async isStoreFresh(store: IRScheduleIndexStore): Promise<boolean> {
		if (!(await this.matchesPointFilesRevision(store))) {
			return false;
		}
		const externalTasksRevision = await this.getExternalTasksRevision();
		return store.externalTasksRevision === externalTasksRevision;
	}

	private async ensureIndexStore(): Promise<IRScheduleIndexStore> {
		if (this.memoryStore && (await this.isStoreFresh(this.memoryStore))) {
			return this.memoryStore;
		}
		this.memoryStore = null;

		const diskStore = await this.readDiskStore();
		if (diskStore && (await this.isStoreFresh(diskStore))) {
			this.memoryStore = diskStore;
			logger.debug("[IRScheduleIndexService] schedule index cache hit", {
				chunks: diskStore.chunks.length,
				blocks: diskStore.blocks.length,
				pdfTasks: diskStore.pdfTasks.length,
				epubTasks: diskStore.epubTasks.length,
			});
			return diskStore;
		}

		if (this.inflightBuild) {
			return this.inflightBuild;
		}

		const buildPromise = this.buildIndexStore();
		this.inflightBuild = buildPromise;
		try {
			return await buildPromise;
		} finally {
			if (this.inflightBuild === buildPromise) {
				this.inflightBuild = null;
			}
		}
	}

	private async buildIndexStore(): Promise<IRScheduleIndexStore> {
		const startedAt = Date.now();
		await this.pointStorage.initialize();
		const snapshots = await this.pointStorage.listPointSnapshots();
		const chunks: IRChunkFileData[] = [];
		const blocks: IRBlock[] = [];
		const pdfTasks: IRPdfBookmarkTask[] = [];
		const epubTasks: IREpubBookmarkTask[] = [];
		const seenIds = new Set<string>();
		const ghostPointIds: string[] = [];

		for (const snapshot of snapshots) {
			const pointId = String(snapshot.point?.id || "").trim();
			if (isIRDeckGhostPointSnapshot(snapshot)) {
				if (pointId) {
					ghostPointIds.push(pointId);
				}
				continue;
			}

			const kind = getStoredPointKind(snapshot);
			if (kind === "chunk") {
				const { chunk } = buildLegacyChunkFromPointSnapshot(snapshot);
				if (
					isIRInternalScheduleSourcePath(chunk.filePath) ||
					shouldExcludeScheduleItemBySource({
						sourceFile: chunk.filePath,
						title: String(
							(chunk.meta as { pointTitle?: string } | undefined)
								?.pointTitle || "",
						),
					})
				) {
					if (pointId) {
						ghostPointIds.push(pointId);
					}
					continue;
				}
				if (!seenIds.has(chunk.chunkId)) {
					chunks.push(chunk);
					seenIds.add(chunk.chunkId);
				}
				continue;
			}
			if (kind === "pdf") {
				const task = buildLegacyPdfTaskFromPointSnapshot(snapshot);
				if (
					isIRInternalScheduleSourcePath(task.pdfPath) ||
					shouldExcludeScheduleItemBySource({
						sourceFile: task.pdfPath,
						title: task.title,
					})
				) {
					if (pointId) {
						ghostPointIds.push(pointId);
					}
					continue;
				}
				if (!seenIds.has(task.id)) {
					pdfTasks.push(task);
					seenIds.add(task.id);
				}
				continue;
			}
			if (kind === "epub") {
				const task = buildLegacyEpubTaskFromPointSnapshot(snapshot);
				if (
					isIRInternalScheduleSourcePath(task.epubFilePath) ||
					shouldExcludeScheduleItemBySource({
						sourceFile: task.epubFilePath,
						title: task.title,
					})
				) {
					if (pointId) {
						ghostPointIds.push(pointId);
					}
					continue;
				}
				if (!seenIds.has(task.id)) {
					epubTasks.push(task);
					seenIds.add(task.id);
				}
			}
			// Phase 3：legacy-block 不再进入 schedule index；请用数据管理窗「统一阅读点格式」迁移。
		}

		if (ghostPointIds.length > 0) {
			scheduleIRDeckGhostPointCleanup(this.app, ghostPointIds);
		}

		await Promise.all([
			this.pdfService.initialize(),
			this.epubService.initialize(),
		]);
		for (const task of await this.pdfService.getAllTasks()) {
			const taskId = String(task?.id || "").trim();
			if (!taskId || seenIds.has(taskId)) {
				continue;
			}
			pdfTasks.push(task);
			seenIds.add(taskId);
		}
		for (const task of await this.epubService.getAllTasks()) {
			const taskId = String(task?.id || "").trim();
			if (!taskId || seenIds.has(taskId)) {
				continue;
			}
			epubTasks.push(task);
			seenIds.add(taskId);
		}

		const chunksRecord = Object.fromEntries(
			chunks.map((chunk) => [chunk.chunkId, chunk]),
		);
		const blocksRecord = Object.fromEntries(
			blocks.map((block) => [block.id, block]),
		);
		const scheduleFingerprint = buildScheduleFingerprint({
			chunksRecord,
			blocksRecord,
			pdfTasks,
			epubTasks,
		});
		const externalTasksRevision = buildExternalBookmarkTasksRevision([
			...pdfTasks,
			...epubTasks,
		]);
		const pointFilesRevision =
			await this.pointStorage.getPointFilesIndexRevision();
		const store: IRScheduleIndexStore = {
			version: IR_SCHEDULE_INDEX_VERSION,
			updatedAt: new Date().toISOString(),
			pointFilesRevision,
			externalTasksRevision,
			scheduleFingerprint,
			chunks,
			blocks,
			pdfTasks,
			epubTasks,
		};
		this.memoryStore = store;
		await this.writeDiskStore(store);
		logger.info("[IRScheduleIndexService] schedule index rebuilt", {
			chunks: chunks.length,
			blocks: blocks.length,
			pdfTasks: pdfTasks.length,
			epubTasks: epubTasks.length,
			durationMs: Date.now() - startedAt,
		});
		return store;
	}
}

const scheduleIndexServiceByApp = new WeakMap<App, IRScheduleIndexService>();

export function getSharedIRScheduleIndexService(
	app: App,
): IRScheduleIndexService {
	let service = scheduleIndexServiceByApp.get(app);
	if (!service) {
		service = new IRScheduleIndexService(app);
		scheduleIndexServiceByApp.set(app, service);
	}
	return service;
}
