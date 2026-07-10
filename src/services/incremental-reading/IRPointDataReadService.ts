import type { App } from "obsidian";
import type {
	IRPointFileCatalogEntry,
	IRPointSnapshot,
	IRPointStorageMigrationReport,
} from "../../types/ir-point-storage-types";
import type { IRDeck } from "../../types/ir-types";
import {
	type IRPointStorageService,
	getSharedIRPointStorageService,
} from "./IRPointStorageService";

/**
 * 仅负责 IR 点数据读取的轻量读服务。
 *
 * 这个边界避免了“纯点数据读取”被调度链路拖入，
 * 便于后续拆分为独立增量阅读插件时先迁出数据层。
 */
export class IRPointDataReadService {
	private initialized = false;

	constructor(private readonly app: App) {}

	async initialize(): Promise<void> {
		if (this.initialized) {
			return;
		}

		await getSharedIRPointStorageService(this.app).initialize();
		this.initialized = true;
	}

	async listPointFileCatalogEntries(): Promise<IRPointFileCatalogEntry[]> {
		await this.initialize();
		return await getSharedIRPointStorageService(
			this.app,
		).listPointFileCatalogEntries();
	}

	async getPointFileEntryByPath(path: string): Promise<{
		topicId: string;
		topicName: string;
		relativePath: string;
		absolutePath: string;
	} | null> {
		await this.initialize();
		return await getSharedIRPointStorageService(
			this.app,
		).getPointFileEntryByPath(path);
	}

	async listPointDecks(): Promise<Record<string, IRDeck>> {
		await this.initialize();
		return await getSharedIRPointStorageService(this.app).listPointDecks();
	}

	async listPointSnapshots(): Promise<IRPointSnapshot[]> {
		await this.initialize();
		return await getSharedIRPointStorageService(this.app).listPointSnapshots();
	}

	async getPointSnapshotById(pointId: string): Promise<IRPointSnapshot | null> {
		await this.initialize();
		return await getSharedIRPointStorageService(this.app).getPointSnapshotById(
			pointId,
		);
	}

	async getPointTopicIds(pointId: string): Promise<string[]> {
		await this.initialize();
		return await getSharedIRPointStorageService(this.app).getPointTopicIds(
			pointId,
		);
	}

	async getLatestMigrationReport(): Promise<IRPointStorageMigrationReport | null> {
		await this.initialize();
		return await getSharedIRPointStorageService(
			this.app,
		).getLatestMigrationReport();
	}

	getPointStorage(): IRPointStorageService {
		return getSharedIRPointStorageService(this.app);
	}
}

export function createIRPointDataReadService(app: App): IRPointDataReadService {
	return new IRPointDataReadService(app);
}
