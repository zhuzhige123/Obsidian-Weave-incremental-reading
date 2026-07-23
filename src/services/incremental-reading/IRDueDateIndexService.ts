import type { App } from "obsidian";
import { getPluginPaths } from "../../config/paths";
import { DirectoryUtils } from "../../utils/directory-utils";
import { logger } from "../../utils/logger";
import {
	type IRScheduleIndexSources,
	getSharedIRScheduleIndexService,
} from "./IRScheduleIndexService";

const DUE_DATE_INDEX_VERSION = "1.0.0";

export interface IRDueDateIndexStore {
	version: string;
	updatedAt: string;
	byDate: Record<string, string[]>;
	byPointId: Record<string, string>;
}

type DueDateIndexSourceSlice = Pick<
	IRScheduleIndexSources,
	"chunks" | "pdfTasks" | "epubTasks"
>;

export function formatDueDateKeyFromTimestamp(
	timestamp: number | undefined | null,
): string | null {
	if (!timestamp || !Number.isFinite(timestamp) || timestamp <= 0) {
		return null;
	}
	const date = new Date(timestamp);
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function createEmptyDueDateIndexStore(): IRDueDateIndexStore {
	return {
		version: DUE_DATE_INDEX_VERSION,
		updatedAt: new Date(0).toISOString(),
		byDate: {},
		byPointId: {},
	};
}

function normalizePointIdList(ids: string[] | undefined): string[] {
	return Array.from(
		new Set((ids || []).map((id) => String(id || "").trim()).filter(Boolean)),
	);
}

/**
 * nextRepDate 倒排索引：dateKey → pointIds，持久化于插件 cache。
 * 月历某日 due 查询 O(k) 而非全库扫描。
 */
export class IRDueDateIndexService {
	private memoryStore: IRDueDateIndexStore | null = null;
	private writeTimer: number | null = null;
	private pendingWrite = false;

	constructor(private readonly app: App) {}

	invalidate(): void {
		void this.invalidateAsync();
	}

	async invalidateAsync(): Promise<void> {
		await this.flushPendingWrites();
		this.memoryStore = null;
		this.pendingWrite = false;
	}

	/**
	 * 冷启动预读：仅将磁盘 due 索引载入内存。
	 * 禁止调用 getScheduleSources / rebuildFromScheduleIndex（避免完整 freshness 扫库）。
	 */
	async warmDiskCache(): Promise<boolean> {
		if (this.memoryStore) {
			return true;
		}
		const disk = await this.readDiskStore();
		if (!disk) {
			return false;
		}
		this.memoryStore = disk;
		logger.debug("[IRDueDateIndexService] due-date index warmed from disk", {
			dateCount: Object.keys(disk.byDate || {}).length,
			pointCount: Object.keys(disk.byPointId || {}).length,
		});
		return true;
	}

	/**
	 * 用已 warm 的 schedule 源在内存重建 due 倒排（不触发 getScheduleSources）。
	 * 供冷启动：schedule 命中而 due 磁盘缺失时补齐。
	 */
	async rebuildFromWarmScheduleSources(
		sources: DueDateIndexSourceSlice,
	): Promise<void> {
		this.applySourcesToMemoryStore(sources);
		this.pendingWrite = true;
		await this.flushPendingWrites();
		logger.info(
			"[IRDueDateIndexService] rebuilt due-date index from warm schedule sources",
			{
				dateCount: Object.keys(this.memoryStore?.byDate || {}).length,
				pointCount: Object.keys(this.memoryStore?.byPointId || {}).length,
			},
		);
	}

	isMemoryStoreEmpty(): boolean {
		if (!this.memoryStore) {
			return true;
		}
		return Object.keys(this.memoryStore.byPointId || {}).length === 0;
	}

	async getPointIdsForDate(dateKey: string): Promise<string[]> {
		const normalizedKey = String(dateKey || "").trim();
		if (!normalizedKey) {
			return [];
		}
		const store = await this.ensureStore();
		return [...(store.byDate[normalizedKey] || [])];
	}

	/**
	 * 某日应出现在日列表的 due 集合 = 当日 due ∪（若为目标「今天」则全部逾期日上的 pointIds）。
	 * 逾期点仍保存在过去 dateKey；月历「今天」队列需要把它们滚进来。
	 */
	async getCalendarDuePointIdsForDate(
		dateKey: string,
		options?: { rollOverdueIntoToday?: boolean; todayKey?: string },
	): Promise<string[]> {
		const normalizedKey = String(dateKey || "").trim();
		if (!normalizedKey) {
			return [];
		}
		const todayKey =
			String(options?.todayKey || "").trim() || this.getLocalTodayDateKey();
		const dueToday = await this.getPointIdsForDate(normalizedKey);
		const shouldRoll =
			options?.rollOverdueIntoToday !== false && normalizedKey === todayKey;
		if (!shouldRoll) {
			return dueToday;
		}

		const store = await this.ensureStore();
		const ids = new Set(dueToday);
		for (const [pastKey, list] of Object.entries(store.byDate || {})) {
			if (!pastKey || pastKey >= todayKey) {
				continue;
			}
			for (const id of list || []) {
				const normalizedId = String(id || "").trim();
				if (normalizedId) {
					ids.add(normalizedId);
				}
			}
		}
		return Array.from(ids);
	}

	private getLocalTodayDateKey(): string {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, "0");
		const day = String(now.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	async updatePointDueDate(
		pointId: string,
		previousNextRepDate: number | undefined,
		nextNextRepDate: number | undefined,
	): Promise<void> {
		const normalizedId = String(pointId || "").trim();
		if (!normalizedId) {
			return;
		}

		const store = await this.ensureStore();
		const previousKey =
			formatDueDateKeyFromTimestamp(previousNextRepDate) ||
			store.byPointId[normalizedId] ||
			null;
		const nextKey = formatDueDateKeyFromTimestamp(nextNextRepDate);

		if (previousKey && previousKey !== nextKey) {
			const previousList = normalizePointIdList(
				store.byDate[previousKey],
			).filter((id) => id !== normalizedId);
			if (previousList.length > 0) {
				store.byDate[previousKey] = previousList;
			} else {
				delete store.byDate[previousKey];
			}
		}

		if (nextKey) {
			const nextList = normalizePointIdList(store.byDate[nextKey]);
			if (!nextList.includes(normalizedId)) {
				nextList.push(normalizedId);
			}
			store.byDate[nextKey] = nextList;
			store.byPointId[normalizedId] = nextKey;
		} else {
			delete store.byPointId[normalizedId];
		}

		store.updatedAt = new Date().toISOString();
		this.scheduleDebouncedWrite();
	}

	async rebuildFromScheduleIndex(): Promise<void> {
		const index = await getSharedIRScheduleIndexService(
			this.app,
		).getScheduleSources();
		this.applySourcesToMemoryStore(index);
		this.pendingWrite = true;
		await this.flushPendingWrites();
		logger.info("[IRDueDateIndexService] rebuilt due-date index", {
			dateCount: Object.keys(this.memoryStore?.byDate || {}).length,
			pointCount: Object.keys(this.memoryStore?.byPointId || {}).length,
		});
	}

	private applySourcesToMemoryStore(sources: DueDateIndexSourceSlice): void {
		const byDate: Record<string, string[]> = {};
		const byPointId: Record<string, string> = {};

		const ingest = (pointId: string, nextRepDate: number | undefined) => {
			const normalizedId = String(pointId || "").trim();
			const dateKey = formatDueDateKeyFromTimestamp(nextRepDate);
			if (!normalizedId || !dateKey) {
				return;
			}
			const list = byDate[dateKey] || [];
			if (!list.includes(normalizedId)) {
				list.push(normalizedId);
			}
			byDate[dateKey] = list;
			byPointId[normalizedId] = dateKey;
		};

		for (const chunk of sources.chunks || []) {
			ingest(
				String(chunk.chunkId || "").trim(),
				Number(chunk.nextRepDate || 0),
			);
		}
		for (const task of sources.pdfTasks || []) {
			ingest(String(task.id || "").trim(), Number(task.nextRepDate || 0));
		}
		for (const task of sources.epubTasks || []) {
			ingest(String(task.id || "").trim(), Number(task.nextRepDate || 0));
		}

		this.memoryStore = {
			version: DUE_DATE_INDEX_VERSION,
			updatedAt: new Date().toISOString(),
			byDate,
			byPointId,
		};
	}

	async flushPendingWrites(): Promise<void> {
		if (this.writeTimer) {
			window.clearTimeout(this.writeTimer);
			this.writeTimer = null;
		}
		if (!this.pendingWrite || !this.memoryStore) {
			return;
		}
		this.pendingWrite = false;
		await this.writeDiskStore(this.memoryStore);
	}

	private scheduleDebouncedWrite(): void {
		this.pendingWrite = true;
		if (this.writeTimer) {
			window.clearTimeout(this.writeTimer);
		}
		this.writeTimer = window.setTimeout(() => {
			void this.flushPendingWrites();
		}, 400);
	}

	private getDiskPath(): string {
		return getPluginPaths(this.app).cache.incrementalReading.dueDateIndex;
	}

	private async readDiskStore(): Promise<IRDueDateIndexStore | null> {
		try {
			const raw = await this.app.vault.adapter.read(this.getDiskPath());
			const parsed = JSON.parse(raw) as Partial<IRDueDateIndexStore>;
			if (parsed?.version !== DUE_DATE_INDEX_VERSION) {
				return null;
			}
			return {
				version: DUE_DATE_INDEX_VERSION,
				updatedAt: String(parsed.updatedAt || new Date(0).toISOString()),
				byDate:
					parsed.byDate && typeof parsed.byDate === "object"
						? parsed.byDate
						: {},
				byPointId:
					parsed.byPointId && typeof parsed.byPointId === "object"
						? parsed.byPointId
						: {},
			};
		} catch {
			return null;
		}
	}

	private async writeDiskStore(store: IRDueDateIndexStore): Promise<void> {
		const diskPath = this.getDiskPath();
		const adapter = this.app.vault.adapter;
		await DirectoryUtils.ensureDirForFile(adapter, diskPath);
		await adapter.write(diskPath, JSON.stringify(store, null, 2));
	}

	private async ensureStore(): Promise<IRDueDateIndexStore> {
		if (this.memoryStore) {
			return this.memoryStore;
		}
		const disk = await this.readDiskStore();
		if (disk) {
			this.memoryStore = disk;
			return disk;
		}
		// 禁止在 getPointIds 热路径触发 getScheduleSources 全量重建。
		// 空壳由 preload rebuildFromWarmScheduleSources / 显式 rebuildFromScheduleIndex 补齐。
		this.memoryStore = createEmptyDueDateIndexStore();
		return this.memoryStore;
	}
}

const dueDateIndexByApp = new WeakMap<App, IRDueDateIndexService>();

export function getSharedIRDueDateIndexService(
	app: App,
): IRDueDateIndexService {
	let service = dueDateIndexByApp.get(app);
	if (!service) {
		service = new IRDueDateIndexService(app);
		dueDateIndexByApp.set(app, service);
	}
	return service;
}
