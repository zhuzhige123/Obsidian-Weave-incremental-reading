import type { App } from "obsidian";
import { getPluginPaths } from "../../config/paths";
import { DirectoryUtils } from "../../utils/directory-utils";
import { logger } from "../../utils/logger";
import {
	buildMonthSummariesFromDayCounts,
	toCalendarMonthKey,
} from "./IRCalendarProjectionUtils";
import type { ScheduleItem } from "./IRCalendarScheduleItem";

export const IR_CALENDAR_DAY_INDEX_VERSION = "2.1.0";

const PROJECTION_WRITE_DEBOUNCE_MS = 400;

export type SerializedDayScheduleItem = Omit<ScheduleItem, "nextReviewDate"> & {
	nextReviewDate: string | null;
};

export interface IRCalendarDaySummary {
	totalCount: number;
}

export interface IRCalendarDayIndexScopeManifest {
	settingsFingerprint: string;
	scheduleFingerprint: string;
	savedAt: string;
}

export interface IRCalendarDayIndexScope {
	settingsFingerprint: string;
	scheduleFingerprint: string;
	savedAt: string;
	daySummaries: Record<string, IRCalendarDaySummary>;
	/** 按月聚合的热力计数：YYYY-MM -> { YYYY-MM-DD: count } */
	monthSummaries: Record<string, Record<string, number>>;
	slices: Record<string, SerializedDayScheduleItem[]>;
}

interface IRCalendarDayIndexStore {
	version: string;
	lastUpdated: string;
	scopes: Record<string, IRCalendarDayIndexScope>;
}

export interface IRCalendarTier0HydrateResult {
	cacheKey: string;
	settingsFingerprint: string;
	scheduleFingerprint: string;
	materialsByDate: Map<string, ScheduleItem[]>;
	daySummaries: Map<string, IRCalendarDaySummary>;
	scheduleGeneratedAt: number;
}

export class IRCalendarDayIndexService {
	private store: IRCalendarDayIndexStore | null = null;
	private storeLoaded = false;
	private inflightStoreLoad: Promise<IRCalendarDayIndexStore> | null = null;
	private inflightStoreWrite: Promise<void> | null = null;
	private pendingScopeWrites = new Map<string, IRCalendarDayIndexScope>();
	private writeDebounceTimer: number | null = null;

	constructor(private readonly app: App) {}

	/** 冷启动预读：将 day-index 载入内存，避免月历首屏重复读盘。 */
	async warmDiskCache(): Promise<boolean> {
		try {
			await this.loadStore();
			return this.storeLoaded;
		} catch (error) {
			logger.debug("[IRCalendarDayIndexService] warmDiskCache failed:", error);
			return false;
		}
	}

	async tryHydrateTier0(input: {
		cacheKey: string;
		settingsFingerprint: string;
		scheduleFingerprint: string;
		priorityDateKeys: string[];
	}): Promise<IRCalendarTier0HydrateResult | null> {
		const cacheKey = String(input.cacheKey || "").trim();
		const settingsFingerprint = String(input.settingsFingerprint || "").trim();
		const scheduleFingerprint = String(input.scheduleFingerprint || "").trim();
		if (!cacheKey || !settingsFingerprint || !scheduleFingerprint) {
			return null;
		}

		const scope = await this.readScope(cacheKey);
		if (!scope || scope.settingsFingerprint !== settingsFingerprint) {
			return null;
		}
		if (scope.scheduleFingerprint !== scheduleFingerprint) {
			return null;
		}

		const priorityDateKeys = Array.from(
			new Set(
				input.priorityDateKeys
					.map((key) => String(key || "").trim())
					.filter(Boolean),
			),
		);
		if (priorityDateKeys.length === 0) {
			return null;
		}

		const materialsByDate = new Map<string, ScheduleItem[]>();
		for (const dateKey of priorityDateKeys) {
			const items = (scope.slices[dateKey] || []).map((item) =>
				this.hydrateScheduleItem(item),
			);
			materialsByDate.set(dateKey, items);
		}

		const daySummaries = this.buildDaySummariesMap(scope);
		for (const [dateKey, items] of materialsByDate.entries()) {
			if (!daySummaries.has(dateKey)) {
				daySummaries.set(dateKey, { totalCount: items.length });
			}
		}

		const scheduleGeneratedAt = Date.parse(scope.savedAt);
		return {
			cacheKey,
			settingsFingerprint,
			scheduleFingerprint: scope.scheduleFingerprint,
			materialsByDate,
			daySummaries,
			scheduleGeneratedAt: Number.isFinite(scheduleGeneratedAt)
				? scheduleGeneratedAt
				: 0,
		};
	}

	async tryHydrateDateKeys(input: {
		cacheKey: string;
		settingsFingerprint: string;
		scheduleFingerprint: string;
		dateKeys: string[];
	}): Promise<{
		materialsByDate: Map<string, ScheduleItem[]>;
		daySummaries: Map<string, IRCalendarDaySummary>;
	} | null> {
		const cacheKey = String(input.cacheKey || "").trim();
		const settingsFingerprint = String(input.settingsFingerprint || "").trim();
		const scheduleFingerprint = String(input.scheduleFingerprint || "").trim();
		const dateKeys = Array.from(
			new Set(
				input.dateKeys.map((key) => String(key || "").trim()).filter(Boolean),
			),
		);
		if (
			!cacheKey ||
			!settingsFingerprint ||
			!scheduleFingerprint ||
			dateKeys.length === 0
		) {
			return null;
		}

		const scope = await this.readScope(cacheKey);
		if (
			!scope ||
			scope.settingsFingerprint !== settingsFingerprint ||
			scope.scheduleFingerprint !== scheduleFingerprint
		) {
			return null;
		}

		const materialsByDate = new Map<string, ScheduleItem[]>();
		for (const dateKey of dateKeys) {
			const items = (scope.slices[dateKey] || []).map((item) =>
				this.hydrateScheduleItem(item),
			);
			materialsByDate.set(dateKey, items);
		}

		const daySummaries = this.buildDaySummariesMap(scope);
		for (const [dateKey, items] of materialsByDate.entries()) {
			if (!daySummaries.has(dateKey)) {
				daySummaries.set(dateKey, { totalCount: items.length });
			}
		}

		return { materialsByDate, daySummaries };
	}

	/**
	 * 仅恢复指定月份的热力计数，不加载日列表切片。
	 */
	async tryHydrateMonthHeatmap(input: {
		cacheKey: string;
		settingsFingerprint: string;
		monthKeys: string[];
	}): Promise<Map<string, Record<string, number>> | null> {
		const cacheKey = String(input.cacheKey || "").trim();
		const settingsFingerprint = String(input.settingsFingerprint || "").trim();
		const monthKeys = Array.from(
			new Set(
				input.monthKeys.map((key) => String(key || "").trim()).filter(Boolean),
			),
		);
		if (!cacheKey || !settingsFingerprint || monthKeys.length === 0) {
			return null;
		}

		const scope = await this.readScope(cacheKey);
		if (!scope || scope.settingsFingerprint !== settingsFingerprint) {
			return null;
		}

		const result = new Map<string, Record<string, number>>();
		for (const monthKey of monthKeys) {
			const month = scope.monthSummaries?.[monthKey];
			if (month && Object.keys(month).length > 0) {
				result.set(monthKey, { ...month });
			}
		}
		return result.size > 0 ? result : null;
	}

	async invalidateDateKeys(
		cacheKey: string,
		dateKeys: string[],
	): Promise<void> {
		const normalizedCacheKey = String(cacheKey || "").trim();
		if (!normalizedCacheKey) {
			return;
		}
		const normalizedDateKeys = Array.from(
			new Set(dateKeys.map((key) => String(key || "").trim()).filter(Boolean)),
		);
		if (normalizedDateKeys.length === 0) {
			return;
		}

		const scope = await this.readScope(normalizedCacheKey);
		if (!scope) {
			return;
		}

		const nextSlices = { ...scope.slices };
		const nextSummaries = { ...scope.daySummaries };
		const nextMonthSummaries = { ...(scope.monthSummaries || {}) };
		for (const dateKey of normalizedDateKeys) {
			delete nextSlices[dateKey];
			delete nextSummaries[dateKey];
			const monthKey = toCalendarMonthKey(dateKey);
			if (nextMonthSummaries[monthKey]) {
				const nextMonth = { ...nextMonthSummaries[monthKey] };
				delete nextMonth[dateKey];
				if (Object.keys(nextMonth).length === 0) {
					delete nextMonthSummaries[monthKey];
				} else {
					nextMonthSummaries[monthKey] = nextMonth;
				}
			}
		}

		await this.writeScope(normalizedCacheKey, {
			...scope,
			slices: nextSlices,
			daySummaries: nextSummaries,
			monthSummaries: nextMonthSummaries,
			savedAt: new Date().toISOString(),
		});
	}

	/** 清空全部 scope（调度/数据变更后避免继续读取过期日切片）。 */
	async invalidateAllScopes(): Promise<void> {
		if (this.writeDebounceTimer) {
			window.clearTimeout(this.writeDebounceTimer);
			this.writeDebounceTimer = null;
		}
		this.pendingScopeWrites.clear();
		this.store = this.createEmptyStore();
		this.storeLoaded = true;
		this.inflightStoreLoad = null;

		try {
			const diskPath = this.getDiskPath();
			await DirectoryUtils.ensureDirForFile(this.app.vault.adapter, diskPath);
			await this.app.vault.adapter.write(diskPath, JSON.stringify(this.store));
		} catch (error) {
			logger.debug("[IRCalendarDayIndexService] invalidateAllScopes failed:", error);
		}
	}

	/**
	 * 合并写入：更新全日摘要计数，仅替换 priorityDateKeys 对应的列表切片。
	 */
	async syncFromMaterialsByDate(input: {
		cacheKey: string;
		settingsFingerprint: string;
		scheduleFingerprint: string;
		materialsByDate: Map<string, ScheduleItem[]>;
		priorityDateKeys?: string[];
	}): Promise<void> {
		const cacheKey = String(input.cacheKey || "").trim();
		if (!cacheKey) {
			return;
		}

		const existing =
			(await this.readScope(cacheKey)) || this.createEmptyScope(input);
		const mergedDaySummaries = { ...existing.daySummaries };
		for (const [dateKey, items] of input.materialsByDate.entries()) {
			const normalizedDateKey = String(dateKey || "").trim();
			if (!normalizedDateKey) {
				continue;
			}
			mergedDaySummaries[normalizedDateKey] = { totalCount: items.length };
		}

		const sliceDateKeys =
			input.priorityDateKeys && input.priorityDateKeys.length > 0
				? input.priorityDateKeys
				: Array.from(input.materialsByDate.keys());
		const mergedSlices = { ...existing.slices };
		for (const dateKey of sliceDateKeys) {
			const normalizedDateKey = String(dateKey || "").trim();
			if (!normalizedDateKey) {
				continue;
			}
			const items = input.materialsByDate.get(normalizedDateKey) || [];
			mergedSlices[normalizedDateKey] = items.map((item) =>
				this.serializeScheduleItem(item),
			);
		}

		await this.writeScope(cacheKey, {
			settingsFingerprint: input.settingsFingerprint,
			scheduleFingerprint: input.scheduleFingerprint,
			savedAt: new Date().toISOString(),
			daySummaries: mergedDaySummaries,
			monthSummaries: buildMonthSummariesFromDayCounts(mergedDaySummaries),
			slices: mergedSlices,
		});
	}

	/**
	 * 条目级增量：只 patch 指定日期的切片与计数。
	 */
	async patchDaySlices(input: {
		cacheKey: string;
		settingsFingerprint: string;
		scheduleFingerprint: string;
		dayPatches: Map<string, ScheduleItem[]>;
	}): Promise<void> {
		const cacheKey = String(input.cacheKey || "").trim();
		if (!cacheKey || input.dayPatches.size === 0) {
			return;
		}

		const existing =
			(await this.readScope(cacheKey)) || this.createEmptyScope(input);
		const mergedDaySummaries = { ...existing.daySummaries };
		const mergedSlices = { ...existing.slices };
		for (const [dateKey, items] of input.dayPatches.entries()) {
			const normalizedDateKey = String(dateKey || "").trim();
			if (!normalizedDateKey) {
				continue;
			}
			mergedDaySummaries[normalizedDateKey] = { totalCount: items.length };
			mergedSlices[normalizedDateKey] = items.map((item) =>
				this.serializeScheduleItem(item),
			);
		}

		await this.writeScope(cacheKey, {
			settingsFingerprint: input.settingsFingerprint,
			scheduleFingerprint: input.scheduleFingerprint,
			savedAt: new Date().toISOString(),
			daySummaries: mergedDaySummaries,
			monthSummaries: buildMonthSummariesFromDayCounts(mergedDaySummaries),
			slices: mergedSlices,
		});
	}

	async flushPendingWrites(): Promise<void> {
		if (this.writeDebounceTimer) {
			window.clearTimeout(this.writeDebounceTimer);
			this.writeDebounceTimer = null;
		}
		await this.flushScopeWrites();
	}

	/** 读取 scope 元数据（指纹、保存时间），不加载切片正文。 */
	async peekScopeManifest(
		cacheKey: string,
	): Promise<IRCalendarDayIndexScopeManifest | null> {
		const normalizedCacheKey = String(cacheKey || "").trim();
		if (!normalizedCacheKey) {
			return null;
		}
		const scope = await this.readScope(normalizedCacheKey);
		if (!scope) {
			return null;
		}
		return {
			settingsFingerprint: scope.settingsFingerprint,
			scheduleFingerprint: scope.scheduleFingerprint,
			savedAt: scope.savedAt,
		};
	}

	/**
	 * 判断投影是否已覆盖优先日期且指纹与当前调度一致。
	 * 用于跳过后台 calendar-reconcile（原 enrich）全量查询。
	 */
	async hasFreshProjectionForPriorityDates(input: {
		cacheKey: string;
		settingsFingerprint: string;
		scheduleFingerprint: string;
		dateKeys: string[];
	}): Promise<boolean> {
		const cacheKey = String(input.cacheKey || "").trim();
		const settingsFingerprint = String(input.settingsFingerprint || "").trim();
		const scheduleFingerprint = String(input.scheduleFingerprint || "").trim();
		const dateKeys = Array.from(
			new Set(
				input.dateKeys.map((key) => String(key || "").trim()).filter(Boolean),
			),
		);
		if (
			!cacheKey ||
			!settingsFingerprint ||
			!scheduleFingerprint ||
			dateKeys.length === 0
		) {
			return false;
		}

		const scope = await this.readScope(cacheKey);
		if (!scope) {
			return false;
		}
		if (scope.settingsFingerprint !== settingsFingerprint) {
			return false;
		}
		if (scope.scheduleFingerprint !== scheduleFingerprint) {
			return false;
		}

		for (const dateKey of dateKeys) {
			const slice = scope.slices[dateKey];
			if (!Array.isArray(slice)) {
				return false;
			}
			const summaryCount = Math.max(
				0,
				Number(scope.daySummaries?.[dateKey]?.totalCount ?? slice.length),
			);
			if (summaryCount > slice.length) {
				return false;
			}
		}
		return true;
	}

	private createEmptyScope(input: {
		settingsFingerprint: string;
		scheduleFingerprint: string;
	}): IRCalendarDayIndexScope {
		return {
			settingsFingerprint: input.settingsFingerprint,
			scheduleFingerprint: input.scheduleFingerprint,
			savedAt: new Date().toISOString(),
			daySummaries: {},
			monthSummaries: {},
			slices: {},
		};
	}

	private buildDaySummariesMap(
		scope: IRCalendarDayIndexScope,
	): Map<string, IRCalendarDaySummary> {
		const daySummaries = new Map<string, IRCalendarDaySummary>();
		for (const [dateKey, summary] of Object.entries(scope.daySummaries || {})) {
			if (!dateKey) {
				continue;
			}
			daySummaries.set(dateKey, {
				totalCount: Math.max(0, Number(summary?.totalCount || 0)),
			});
		}
		return daySummaries;
	}

	private serializeScheduleItem(item: ScheduleItem): SerializedDayScheduleItem {
		return {
			...item,
			nextReviewDate: item.nextReviewDate
				? item.nextReviewDate.toISOString()
				: null,
		};
	}

	private hydrateScheduleItem(item: SerializedDayScheduleItem): ScheduleItem {
		return {
			...item,
			nextReviewDate: item.nextReviewDate
				? new Date(item.nextReviewDate)
				: null,
		};
	}

	private getDiskPath(): string {
		return getPluginPaths(this.app).cache.incrementalReading.irCalendarDayIndex;
	}

	private createEmptyStore(): IRCalendarDayIndexStore {
		return {
			version: IR_CALENDAR_DAY_INDEX_VERSION,
			lastUpdated: new Date(0).toISOString(),
			scopes: {},
		};
	}

	private normalizeScope(
		raw: Partial<IRCalendarDayIndexScope> | null | undefined,
	): IRCalendarDayIndexScope | null {
		if (!raw || typeof raw !== "object") {
			return null;
		}
		const daySummaries =
			raw.daySummaries && typeof raw.daySummaries === "object"
				? raw.daySummaries
				: {};
		const slices =
			raw.slices && typeof raw.slices === "object" ? raw.slices : {};
		const monthSummaries =
			raw.monthSummaries && typeof raw.monthSummaries === "object"
				? raw.monthSummaries
				: buildMonthSummariesFromDayCounts(daySummaries);

		return {
			settingsFingerprint: String(raw.settingsFingerprint || ""),
			scheduleFingerprint: String(raw.scheduleFingerprint || ""),
			savedAt:
				typeof raw.savedAt === "string" && raw.savedAt.trim()
					? raw.savedAt
					: new Date().toISOString(),
			daySummaries,
			monthSummaries,
			slices,
		};
	}

	private normalizeStore(raw: unknown): IRCalendarDayIndexStore {
		if (!raw || typeof raw !== "object") {
			return this.createEmptyStore();
		}
		const candidate = raw as Partial<IRCalendarDayIndexStore>;
		const version =
			typeof candidate.version === "string" && candidate.version.trim()
				? candidate.version.trim()
				: "";
		if (version !== IR_CALENDAR_DAY_INDEX_VERSION) {
			return this.createEmptyStore();
		}
		const scopes: Record<string, IRCalendarDayIndexScope> = {};
		if (candidate.scopes && typeof candidate.scopes === "object") {
			for (const [cacheKey, scopeRaw] of Object.entries(candidate.scopes)) {
				const normalizedScope = this.normalizeScope(
					scopeRaw as Partial<IRCalendarDayIndexScope>,
				);
				if (normalizedScope) {
					scopes[cacheKey] = normalizedScope;
				}
			}
		}
		return {
			version: IR_CALENDAR_DAY_INDEX_VERSION,
			lastUpdated:
				typeof candidate.lastUpdated === "string" &&
				candidate.lastUpdated.trim()
					? candidate.lastUpdated
					: new Date().toISOString(),
			scopes,
		};
	}

	private async loadStore(): Promise<IRCalendarDayIndexStore> {
		if (this.store) {
			return this.store;
		}
		if (this.inflightStoreLoad) {
			return this.inflightStoreLoad;
		}

		const loadPromise = (async () => {
			const adapter = this.app.vault.adapter;
			const diskPath = this.getDiskPath();
			try {
				if (!(await adapter.exists(diskPath))) {
					const emptyStore = this.createEmptyStore();
					this.store = emptyStore;
					this.storeLoaded = true;
					return emptyStore;
				}
				const content = await adapter.read(diskPath);
				const store = this.normalizeStore(JSON.parse(content));
				this.store = store;
				this.storeLoaded = true;
				return store;
			} catch (error) {
				logger.warn(
					"[IRCalendarDayIndexService] Failed to read day index:",
					error,
				);
				const emptyStore = this.createEmptyStore();
				this.store = emptyStore;
				this.storeLoaded = true;
				return emptyStore;
			}
		})();

		this.inflightStoreLoad = loadPromise;
		try {
			return await loadPromise;
		} finally {
			if (this.inflightStoreLoad === loadPromise) {
				this.inflightStoreLoad = null;
			}
		}
	}

	private async readScope(
		cacheKey: string,
	): Promise<IRCalendarDayIndexScope | null> {
		const store = await this.loadStore();
		return store.scopes[cacheKey] || null;
	}

	private scheduleDebouncedFlush(): void {
		if (this.writeDebounceTimer) {
			window.clearTimeout(this.writeDebounceTimer);
		}
		this.writeDebounceTimer = window.setTimeout(() => {
			this.writeDebounceTimer = null;
			void this.flushScopeWrites();
		}, PROJECTION_WRITE_DEBOUNCE_MS);
	}

	private async writeScope(
		cacheKey: string,
		scope: IRCalendarDayIndexScope,
	): Promise<void> {
		this.pendingScopeWrites.set(cacheKey, scope);
		const store = this.storeLoaded
			? this.store || this.createEmptyStore()
			: await this.loadStore();
		this.store = {
			...store,
			scopes: {
				...store.scopes,
				[cacheKey]: scope,
			},
		};
		this.storeLoaded = true;
		this.scheduleDebouncedFlush();
	}

	private async flushScopeWrites(): Promise<void> {
		if (this.pendingScopeWrites.size === 0) {
			return;
		}

		const store = this.storeLoaded
			? this.store || this.createEmptyStore()
			: await this.loadStore();
		const nextScopes = { ...store.scopes };
		for (const [cacheKey, scope] of this.pendingScopeWrites.entries()) {
			nextScopes[cacheKey] = scope;
		}
		this.pendingScopeWrites.clear();

		const nextStore: IRCalendarDayIndexStore = {
			...store,
			version: IR_CALENDAR_DAY_INDEX_VERSION,
			lastUpdated: new Date().toISOString(),
			scopes: nextScopes,
		};

		const previousWrite = this.inflightStoreWrite ?? Promise.resolve();
		const writePromise = previousWrite
			.catch(() => undefined)
			.then(async () => {
				const diskPath = this.getDiskPath();
				await DirectoryUtils.ensureDirForFile(this.app.vault.adapter, diskPath);
				await this.app.vault.adapter.write(diskPath, JSON.stringify(nextStore));
				this.store = nextStore;
				this.storeLoaded = true;
			});
		this.inflightStoreWrite = writePromise;
		try {
			await writePromise;
		} catch (error) {
			logger.warn(
				"[IRCalendarDayIndexService] Failed to write day index:",
				error,
			);
		} finally {
			if (this.inflightStoreWrite === writePromise) {
				this.inflightStoreWrite = null;
			}
		}
	}
}

const dayIndexServiceByApp = new WeakMap<App, IRCalendarDayIndexService>();

export function getSharedIRCalendarDayIndexService(
	app: App,
): IRCalendarDayIndexService {
	let service = dayIndexServiceByApp.get(app);
	if (!service) {
		service = new IRCalendarDayIndexService(app);
		dayIndexServiceByApp.set(app, service);
	}
	return service;
}
