import type { App } from "obsidian";
import { getPluginPaths } from "../../config/paths";
import type { IRBlock, IRChunkFileData } from "../../types/ir-types";
import type { IREpubBookmarkTask } from "./IREpubBookmarkTaskService";
import type { IRPdfBookmarkTask } from "./IRPdfBookmarkTaskService";
import { DirectoryUtils } from "../../utils/directory-utils";
import { logger } from "../../utils/logger";
import {
	buildLegacyBlockFromPointSnapshot,
	buildLegacyChunkFromPointSnapshot,
	buildLegacyEpubTaskFromPointSnapshot,
	buildLegacyPdfTaskFromPointSnapshot,
	getStoredPointKind,
	isLegacyBlockPointSnapshot,
} from "./IRLegacyTaskCompatAdapter";
import { IREpubBookmarkTaskService } from "./IREpubBookmarkTaskService";
import { IRPdfBookmarkTaskService } from "./IRPdfBookmarkTaskService";
import { getSharedIRPointStorageService, type IRPointStorageService } from "./IRPointStorageService";
import {
	buildExternalBookmarkTasksRevision,
	buildScheduleFingerprint,
} from "./IRScheduleFingerprint";

export const IR_SCHEDULE_INDEX_VERSION = "1.0.0";

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
	snapshotCacheVersion: number;
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

	private getIndexPath(): string {
		return getPluginPaths(this.app).cache.incrementalReading.scheduleIndex;
	}

	private normalizeStore(raw: unknown): IRScheduleIndexStore | null {
		if (!raw || typeof raw !== "object") {
			return null;
		}
		const candidate = raw as Partial<IRScheduleIndexStore>;
		if (candidate.version !== IR_SCHEDULE_INDEX_VERSION) {
			return null;
		}
		return {
			version: IR_SCHEDULE_INDEX_VERSION,
			updatedAt:
				typeof candidate.updatedAt === "string" && candidate.updatedAt.trim()
					? candidate.updatedAt
					: new Date().toISOString(),
			snapshotCacheVersion: Number(candidate.snapshotCacheVersion ?? -1),
			externalTasksRevision: String(candidate.externalTasksRevision || ""),
			scheduleFingerprint: String(candidate.scheduleFingerprint || ""),
			chunks: Array.isArray(candidate.chunks) ? (candidate.chunks) : [],
			blocks: Array.isArray(candidate.blocks) ? (candidate.blocks) : [],
			pdfTasks: Array.isArray(candidate.pdfTasks) ? (candidate.pdfTasks) : [],
			epubTasks: Array.isArray(candidate.epubTasks)
				? (candidate.epubTasks)
				: [],
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
		await Promise.all([this.pdfService.initialize(), this.epubService.initialize()]);
		const [pdfTasks, epubTasks] = await Promise.all([
			this.pdfService.getAllTasks(),
			this.epubService.getAllTasks(),
		]);
		return buildExternalBookmarkTasksRevision([...pdfTasks, ...epubTasks]);
	}

	private async isStoreFresh(store: IRScheduleIndexStore): Promise<boolean> {
		await this.pointStorage.initialize();
		const snapshotCacheVersion = this.pointStorage.getSnapshotListCacheVersion();
		if (store.snapshotCacheVersion !== snapshotCacheVersion) {
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

		for (const snapshot of snapshots) {
			const kind = getStoredPointKind(snapshot);
			if (kind === "chunk") {
				const { chunk } = buildLegacyChunkFromPointSnapshot(snapshot);
				if (!seenIds.has(chunk.chunkId)) {
					chunks.push(chunk);
					seenIds.add(chunk.chunkId);
				}
				continue;
			}
			if (kind === "pdf") {
				const task = buildLegacyPdfTaskFromPointSnapshot(snapshot);
				if (!seenIds.has(task.id)) {
					pdfTasks.push(task);
					seenIds.add(task.id);
				}
				continue;
			}
			if (kind === "epub") {
				const task = buildLegacyEpubTaskFromPointSnapshot(snapshot);
				if (!seenIds.has(task.id)) {
					epubTasks.push(task);
					seenIds.add(task.id);
				}
				continue;
			}
			if (isLegacyBlockPointSnapshot(snapshot)) {
				const block = buildLegacyBlockFromPointSnapshot(snapshot);
				if (block && !seenIds.has(block.id)) {
					blocks.push(block);
					seenIds.add(block.id);
				}
			}
		}

		await Promise.all([this.pdfService.initialize(), this.epubService.initialize()]);
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

		const chunksRecord = Object.fromEntries(chunks.map((chunk) => [chunk.chunkId, chunk]));
		const blocksRecord = Object.fromEntries(blocks.map((block) => [block.id, block]));
		const scheduleFingerprint = buildScheduleFingerprint({
			chunksRecord,
			blocksRecord,
			pdfTasks,
			epubTasks,
		});
		const externalTasksRevision = buildExternalBookmarkTasksRevision([...pdfTasks, ...epubTasks]);
		const store: IRScheduleIndexStore = {
			version: IR_SCHEDULE_INDEX_VERSION,
			updatedAt: new Date().toISOString(),
			snapshotCacheVersion: this.pointStorage.getSnapshotListCacheVersion(),
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

export function getSharedIRScheduleIndexService(app: App): IRScheduleIndexService {
	let service = scheduleIndexServiceByApp.get(app);
	if (!service) {
		service = new IRScheduleIndexService(app);
		scheduleIndexServiceByApp.set(app, service);
	}
	return service;
}
