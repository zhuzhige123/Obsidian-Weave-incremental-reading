import type { App } from "obsidian";
import { getPluginPaths } from "../../config/paths";
import type { ReadingMaterial } from "../../types/incremental-reading-types";
import { DirectoryUtils } from "../../utils/directory-utils";
import { shouldExcludeScheduleItemBySource } from "../../utils/ir-internal-data-path";
import { readIncrementalReadingSettings } from "../../utils/ir-plugin-host-access";
import { logger } from "../../utils/logger";
import { getIrEpubStorageService } from "../epub-integration/ir-epub-storage-access";
import type { IrEpubStorageLike } from "../epub-integration/ir-epub-storage-types";
import {
	type IRCalendarDaySummary,
	getSharedIRCalendarDayIndexService,
} from "./IRCalendarDayIndexService";
import {
	type ScheduleItem,
	buildScheduleItemFromChunkData,
	buildScheduleItemFromEpubTask,
	buildScheduleItemFromPdfTask,
} from "./IRCalendarScheduleItem";
import { buildCalendarMaterialsByCommittedDue } from "./IRCalendarCommittedDueMaterials";
import { scheduleIRDeckGhostPointCleanup } from "./IRDeckGhostPointCleanup";
import { getProjectedScheduleSummary } from "./IRProjectedScheduleSummary";
import { extractReadingPointDisplayName } from "./IRReadingPointTitle";
import {
	buildScheduleFingerprintFromWorkspace,
	hashStableValue,
} from "./IRScheduleFingerprint";
import { getSharedIRScheduleIndexService } from "./IRScheduleIndexService";
import {
	type IRPlannedDay,
	type IRPlannedSchedule,
	type IRPlannedScheduleItem,
	type RecomputeOptions,
	type ScheduleRecomputeReason,
	getSharedIRScheduleKernel,
} from "./IRScheduleKernel";
import {
	type IRWorkspaceDataSnapshot,
	getSharedIRWorkspaceSnapshotService,
} from "./IRWorkspaceSnapshotService";
import { getIncrementalReadingPlugin } from "./ir-runtime";

export interface IRCalendarQueryOptions extends RecomputeOptions {
	forceRecompute?: boolean;
	reason?: ScheduleRecomputeReason;
	/** 为 false 时跳过阅读材料全量加载（月历快路径）。默认 true。 */
	includeReadingMaterials?: boolean;
	/** 为 true 时优先读取磁盘调度缓存，再加载工作区（月历首屏）。默认 false。 */
	preferDiskCache?: boolean;
	/** 优先保证这些 dateKey 的列表可读（Tier-0）。 */
	priorityDateKeys?: string[];
}

export interface IRCalendarQueryScope {
	deckIds: string[];
	horizonDays?: number;
	cacheKey: string;
	stateKey: string;
}

export interface IRCalendarQueryResult {
	workspaceData: IRWorkspaceDataSnapshot;
	readingMaterials: ReadingMaterial[];
	materialsByDate: Map<string, ScheduleItem[]>;
	continueReadingSuspendedItemsPool: ScheduleItem[];
	schedule: IRPlannedSchedule;
	scope: IRCalendarQueryScope;
}

interface IRCalendarQueryCacheEntry {
	stateKey: string;
	scheduleFingerprint: string;
	settingsFingerprint: string;
	result: IRCalendarQueryResult;
}

const IR_CALENDAR_DISK_CACHE_VERSION = "1.3.0";
const IR_CALENDAR_DISK_WRITE_DEBOUNCE_MS = 450;

type SerializedScheduleItem = Omit<ScheduleItem, "nextReviewDate"> & {
	nextReviewDate: string | null;
};

type SerializedPlannedScheduleItem = Omit<
	IRPlannedScheduleItem,
	"nextReviewDate"
> & {
	nextReviewDate: string | null;
};

type SerializedPlannedDay = Omit<IRPlannedDay, "items"> & {
	items: SerializedPlannedScheduleItem[];
};

interface SerializedPlannedSchedule {
	generatedAt: number;
	version: number;
	deckIds: string[];
	triggerReason?: ScheduleRecomputeReason;
	days: SerializedPlannedDay[];
}

interface SerializedIRCalendarQueryResult {
	materialsByDate: Array<[string, SerializedScheduleItem[]]>;
	continueReadingSuspendedItemsPool: SerializedScheduleItem[];
	schedule: SerializedPlannedSchedule;
	scope: Omit<IRCalendarQueryScope, "stateKey">;
}

interface IRCalendarDiskCacheEntry {
	scheduleFingerprint: string;
	settingsFingerprint: string;
	savedAt: string;
	result: SerializedIRCalendarQueryResult;
}

interface IRCalendarDiskCacheStore {
	version: string;
	lastUpdated: string;
	entries: Record<string, IRCalendarDiskCacheEntry>;
}

export class IRCalendarQueryService {
	private readonly queryCache = new Map<string, IRCalendarQueryCacheEntry>();
	private readonly inflightQueries = new Map<
		string,
		Promise<IRCalendarQueryResult>
	>();
	private epubStorageService: IrEpubStorageLike | null = null;
	private diskCacheStore: IRCalendarDiskCacheStore | null = null;
	private diskCacheLoaded = false;
	private inflightDiskCacheLoad: Promise<IRCalendarDiskCacheStore> | null =
		null;
	private inflightDiskCacheWrite: Promise<void> | null = null;
	private pendingDiskCacheEntries = new Map<string, IRCalendarDiskCacheEntry>();
	private diskCacheWriteDebounceTimer: number | null = null;

	constructor(private readonly app: App) {}

	getSettingsFingerprint(): string {
		return this.buildSettingsFingerprint();
	}

	buildQueryCacheKeyForDeckIds(
		deckIds: string[] = [],
		horizonDays?: number,
	): string {
		return this.buildQueryCacheKey({
			deckIds: this.normalizeIdentifiers(deckIds),
			horizonDays,
		});
	}

	invalidate(_options?: {
		priorityDateKeys?: string[];
		cacheKey?: string;
	}): void {
		this.queryCache.clear();
		this.inflightQueries.clear();
		void this.clearDiskCacheStore();
		void getSharedIRCalendarDayIndexService(this.app).invalidateAllScopes().catch((error) => {
			logger.debug(
				"[IRCalendarQueryService] Failed to invalidate all day index scopes:",
				error,
			);
		});
	}

	private async clearDiskCacheStore(): Promise<void> {
		if (this.diskCacheWriteDebounceTimer) {
			window.clearTimeout(this.diskCacheWriteDebounceTimer);
			this.diskCacheWriteDebounceTimer = null;
		}
		this.pendingDiskCacheEntries.clear();
		const emptyStore = this.createEmptyDiskCacheStore();
		this.diskCacheStore = emptyStore;
		this.diskCacheLoaded = true;
		try {
			await DirectoryUtils.ensureDirForFile(
				this.app.vault.adapter,
				this.getDiskCachePath(),
			);
			await this.app.vault.adapter.write(
				this.getDiskCachePath(),
				JSON.stringify(emptyStore),
			);
		} catch (error) {
			logger.debug(
				"[IRCalendarQueryService] Failed to clear calendar disk cache:",
				error,
			);
		}
	}

	private async invalidateDayIndexSlices(options?: {
		priorityDateKeys?: string[];
		cacheKey?: string;
	}): Promise<void> {
		const dateKeys = Array.from(
			new Set(
				(options?.priorityDateKeys || [])
					.map((key) => String(key || "").trim())
					.filter(Boolean),
			),
		);
		if (dateKeys.length === 0) {
			return;
		}
		const cacheKey =
			String(options?.cacheKey || "").trim() ||
			this.buildQueryCacheKey({
				deckIds: [],
				horizonDays: undefined,
			});
		try {
			await getSharedIRCalendarDayIndexService(this.app).invalidateDateKeys(
				cacheKey,
				dateKeys,
			);
		} catch (error) {
			logger.debug(
				"[IRCalendarQueryService] Failed to invalidate day index slices:",
				error,
			);
		}
	}

	/**
	 * Tier-0：仅从日切片索引恢复「今天 / 选中日期」列表与热力计数，不加载工作区。
	 */
	async tryGetTier0CalendarResult(
		options: Pick<
			IRCalendarQueryOptions,
			"deckIds" | "horizonDays" | "priorityDateKeys"
		>,
	): Promise<{
		result: IRCalendarQueryResult;
		daySummaries: Map<string, IRCalendarDaySummary>;
	} | null> {
		const priorityDateKeys = Array.from(
			new Set(
				(options.priorityDateKeys || [])
					.map((key) => String(key || "").trim())
					.filter(Boolean),
			),
		);
		if (priorityDateKeys.length === 0) {
			return null;
		}

		const settingsFingerprint = this.buildSettingsFingerprint();
		const cacheKey = this.buildQueryCacheKey({
			deckIds: this.normalizeIdentifiers(options.deckIds || []),
			horizonDays: options.horizonDays,
		});
		const scheduleIndex = getSharedIRScheduleIndexService(this.app);
		const dayIndexService = getSharedIRCalendarDayIndexService(this.app);
		let scheduleFingerprint = String(
			(await scheduleIndex.peekScheduleFingerprint()) || "",
		).trim();
		if (!scheduleFingerprint) {
			const manifest = await dayIndexService.peekScopeManifest(cacheKey);
			scheduleFingerprint = String(manifest?.scheduleFingerprint || "").trim();
		}
		if (!scheduleFingerprint) {
			return null;
		}
		const tier0 = await dayIndexService.tryHydrateTier0({
			cacheKey,
			settingsFingerprint,
			scheduleFingerprint,
			priorityDateKeys,
		});
		if (!tier0) {
			return null;
		}

		const stubWorkspace = this.createStubWorkspaceData();
		const queryScope = this.buildQueryScopeFromSerialized(
			{
				materialsByDate: [],
				continueReadingSuspendedItemsPool: [],
				schedule: {
					generatedAt: tier0.scheduleGeneratedAt || Date.now(),
					version: 1,
					deckIds: this.normalizeIdentifiers(options.deckIds || []),
					days: [],
				},
				scope: {
					deckIds: this.normalizeIdentifiers(options.deckIds || []),
					horizonDays: options.horizonDays,
					cacheKey,
				},
			},
			cacheKey,
		);
		const hydratedBase: IRCalendarQueryResult = {
			workspaceData: stubWorkspace,
			readingMaterials: [],
			materialsByDate: tier0.materialsByDate,
			continueReadingSuspendedItemsPool: [],
			schedule: this.hydratePlannedSchedule({
				generatedAt: tier0.scheduleGeneratedAt || Date.now(),
				version: 1,
				deckIds: this.normalizeIdentifiers(options.deckIds || []),
				days: [],
			}),
			scope: {
				...queryScope,
				stateKey: "",
			},
		};
		const result = this.attachRuntimeContext(
			hydratedBase,
			stubWorkspace,
			[],
			queryScope,
		);
		logger.debug("[IRCalendarQueryService] tier-0 day index served", {
			cacheKey,
			priorityDateKeys,
			todayCount:
				tier0.materialsByDate.get(priorityDateKeys[0] || "")?.length ?? 0,
		});
		return {
			result,
			daySummaries: tier0.daySummaries,
		};
	}

	/**
	 * 从日索引恢复优先日期列表（仅校验 settings 指纹，不阻塞于工作区/调度指纹）。
	 * 用于月历首屏在完整查询挂起时先解除「正在加载」阻塞。
	 */
	async tryGetCalendarShellFromDayIndex(
		options: Pick<
			IRCalendarQueryOptions,
			"deckIds" | "horizonDays" | "priorityDateKeys"
		>,
	): Promise<{
		result: IRCalendarQueryResult;
		daySummaries: Map<string, IRCalendarDaySummary>;
	} | null> {
		const priorityDateKeys = Array.from(
			new Set(
				(options.priorityDateKeys || [])
					.map((key) => String(key || "").trim())
					.filter(Boolean),
			),
		);
		if (priorityDateKeys.length === 0) {
			return null;
		}

		const settingsFingerprint = this.buildSettingsFingerprint();
		const cacheKey = this.buildQueryCacheKey({
			deckIds: this.normalizeIdentifiers(options.deckIds || []),
			horizonDays: options.horizonDays,
		});
		const scheduleIndex = getSharedIRScheduleIndexService(this.app);
		const dayIndexService = getSharedIRCalendarDayIndexService(this.app);
		let scheduleFingerprint = String(
			(await scheduleIndex.peekScheduleFingerprint()) || "",
		).trim();
		if (!scheduleFingerprint) {
			const manifest = await dayIndexService.peekScopeManifest(cacheKey);
			scheduleFingerprint = String(manifest?.scheduleFingerprint || "").trim();
		}
		if (!scheduleFingerprint) {
			return null;
		}
		const shell = await dayIndexService.tryHydrateDateKeys({
			cacheKey,
			settingsFingerprint,
			scheduleFingerprint,
			dateKeys: priorityDateKeys,
		});
		if (!shell) {
			return null;
		}

		const stubWorkspace = this.createStubWorkspaceData();
		const queryScope = this.buildQueryScopeFromSerialized(
			{
				materialsByDate: [],
				continueReadingSuspendedItemsPool: [],
				schedule: {
					generatedAt: Date.now(),
					version: 1,
					deckIds: this.normalizeIdentifiers(options.deckIds || []),
					days: [],
				},
				scope: {
					deckIds: this.normalizeIdentifiers(options.deckIds || []),
					horizonDays: options.horizonDays,
					cacheKey,
				},
			},
			cacheKey,
		);
		const hydratedBase: IRCalendarQueryResult = {
			workspaceData: stubWorkspace,
			readingMaterials: [],
			materialsByDate: shell.materialsByDate,
			continueReadingSuspendedItemsPool: [],
			schedule: this.hydratePlannedSchedule({
				generatedAt: Date.now(),
				version: 1,
				deckIds: this.normalizeIdentifiers(options.deckIds || []),
				days: [],
			}),
			scope: {
				...queryScope,
				stateKey: "",
			},
		};
		const result = this.attachRuntimeContext(
			hydratedBase,
			stubWorkspace,
			[],
			queryScope,
		);
		logger.debug("[IRCalendarQueryService] day-index shell served", {
			cacheKey,
			priorityDateKeys,
		});
		return {
			result,
			daySummaries: shell.daySummaries,
		};
	}

	/** 调度指纹过期时仍可读磁盘缓存，供首屏 stale-while-revalidate。 */
	async tryGetStaleDiskCalendarResult(
		options: Pick<
			IRCalendarQueryOptions,
			"deckIds" | "horizonDays" | "priorityDateKeys" | "includeReadingMaterials"
		>,
	): Promise<IRCalendarQueryResult | null> {
		const settingsFingerprint = this.buildSettingsFingerprint();
		const cacheKey = this.buildQueryCacheKey({
			deckIds: this.normalizeIdentifiers(options.deckIds || []),
			horizonDays: options.horizonDays,
		});
		return this.tryHydrateDiskCacheFast(
			cacheKey,
			settingsFingerprint,
			options.includeReadingMaterials !== false,
			{ allowStaleScheduleFingerprint: true },
		);
	}

	async getCalendarQueryResult(
		options: IRCalendarQueryOptions = {},
	): Promise<IRCalendarQueryResult> {
		const includeReadingMaterials = options.includeReadingMaterials !== false;
		const preferDiskCache = options.preferDiskCache === true;
		const settingsFingerprint = this.buildSettingsFingerprint();
		const preliminaryCacheKey = this.buildQueryCacheKey({
			deckIds: this.normalizeIdentifiers(options.deckIds || []),
			horizonDays: options.horizonDays,
		});

		if (!options.forceRecompute && preferDiskCache) {
			const optimistic = await this.tryHydrateDiskCacheFast(
				preliminaryCacheKey,
				settingsFingerprint,
				includeReadingMaterials,
			);
			if (optimistic) {
				logger.debug("[IRCalendarQueryService] optimistic disk cache served", {
					cacheKey: preliminaryCacheKey,
					generatedAt: optimistic.schedule.generatedAt,
				});
				return optimistic;
			}

			const staleOptimistic = await this.tryHydrateDiskCacheFast(
				preliminaryCacheKey,
				settingsFingerprint,
				includeReadingMaterials,
				{ allowStaleScheduleFingerprint: true },
			);
			if (staleOptimistic) {
				logger.debug(
					"[IRCalendarQueryService] stale disk cache served on fast path",
					{
						cacheKey: preliminaryCacheKey,
						generatedAt: staleOptimistic.schedule.generatedAt,
					},
				);
				return staleOptimistic;
			}
		}

		const workspaceData = await getSharedIRWorkspaceSnapshotService(
			this.app,
		).getWorkspaceData();
		const queryScope = this.buildQueryScope(workspaceData, options);
		const scheduleFingerprint =
			buildScheduleFingerprintFromWorkspace(workspaceData);
		const cacheKey = queryScope.cacheKey;
		const cached = !options.forceRecompute
			? this.queryCache.get(cacheKey)
			: null;
		if (
			cached &&
			cached.scheduleFingerprint === scheduleFingerprint &&
			cached.settingsFingerprint === settingsFingerprint
		) {
			const readingMaterials = includeReadingMaterials
				? await this.getReadingMaterials()
				: [];
			const runtimeResult = this.attachRuntimeContext(
				cached.result,
				workspaceData,
				readingMaterials,
				queryScope,
			);
			cached.result = runtimeResult;
			cached.stateKey = runtimeResult.scope.stateKey;
			return runtimeResult;
		}

		if (!options.forceRecompute) {
			const diskEntry = await this.readDiskCacheEntry(cacheKey);
			if (
				diskEntry &&
				diskEntry.scheduleFingerprint === scheduleFingerprint &&
				diskEntry.settingsFingerprint === settingsFingerprint
			) {
				const readingMaterials = includeReadingMaterials
					? await this.getReadingMaterials()
					: [];
				const hydratedResult = this.attachRuntimeContext(
					this.hydrateDiskCacheResult(workspaceData, diskEntry.result),
					workspaceData,
					readingMaterials,
					queryScope,
				);
				this.queryCache.set(cacheKey, {
					stateKey: hydratedResult.scope.stateKey,
					scheduleFingerprint,
					settingsFingerprint,
					result: hydratedResult,
				});
				logger.debug("[IRCalendarQueryService] disk cache hit", {
					deckIds: queryScope.deckIds,
					horizonDays: queryScope.horizonDays,
					generatedAt: hydratedResult.schedule.generatedAt,
				});
				return hydratedResult;
			}
		}

		const inflightKey = `${cacheKey}::${scheduleFingerprint}::${settingsFingerprint}::${
			options.forceRecompute ? "force" : "normal"
		}::${includeReadingMaterials ? "materials" : "lean"}`;
		const inflight = this.inflightQueries.get(inflightKey);
		if (inflight) {
			return inflight;
		}

		const queryPromise = (async () => {
			const readingMaterials = includeReadingMaterials
				? await this.getReadingMaterials()
				: [];
			const schedule = await this.getSchedule(options, queryScope);
			const result = await this.buildCalendarQueryResult(
				workspaceData,
				schedule,
				readingMaterials,
				options,
				{
					...queryScope,
					stateKey: this.buildStateKey(workspaceData, schedule),
				},
			);
			this.queryCache.set(cacheKey, {
				stateKey: result.scope.stateKey,
				scheduleFingerprint,
				settingsFingerprint,
				result,
			});
			await this.persistDiskCacheEntry(cacheKey, {
				scheduleFingerprint,
				settingsFingerprint,
				savedAt: new Date().toISOString(),
				result: this.serializeQueryResult(result),
			});
			await this.syncDayIndexFromResult({
				cacheKey,
				settingsFingerprint,
				scheduleFingerprint,
				result,
				priorityDateKeys: options.priorityDateKeys,
			});
			return result;
		})();
		this.inflightQueries.set(inflightKey, queryPromise);
		try {
			return await queryPromise;
		} finally {
			if (this.inflightQueries.get(inflightKey) === queryPromise) {
				this.inflightQueries.delete(inflightKey);
			}
		}
	}

	private createStubWorkspaceData(): IRWorkspaceDataSnapshot {
		return {
			generatedAt: 0,
			decksRecord: {},
			blocksRecord: {},
			chunksRecord: {},
			sourcesRecord: {},
			history: { sessions: [] },
			pdfTasks: [],
			epubTasks: [],
		};
	}

	private buildQueryScopeFromSerialized(
		serialized: SerializedIRCalendarQueryResult,
		cacheKey: string,
	): IRCalendarQueryScope {
		return {
			deckIds: [...(serialized.scope?.deckIds || [])],
			horizonDays: serialized.scope?.horizonDays,
			cacheKey,
			stateKey: "",
		};
	}

	private async tryHydrateDiskCacheFast(
		cacheKey: string,
		settingsFingerprint: string,
		includeReadingMaterials: boolean,
		options?: { allowStaleScheduleFingerprint?: boolean },
	): Promise<IRCalendarQueryResult | null> {
		const diskEntry = await this.readDiskCacheEntry(cacheKey);
		if (
			!diskEntry?.result ||
			diskEntry.settingsFingerprint !== settingsFingerprint
		) {
			return null;
		}

		const allowStaleScheduleFingerprint =
			options?.allowStaleScheduleFingerprint === true;
		if (!allowStaleScheduleFingerprint) {
			const scheduleFingerprintValid =
				await this.isDiskCacheScheduleFingerprintValid(
					diskEntry.scheduleFingerprint,
					cacheKey,
				);
			if (!scheduleFingerprintValid) {
				logger.debug(
					"[IRCalendarQueryService] optimistic disk cache skipped (stale schedule fingerprint)",
				);
				return null;
			}
		} else {
			logger.debug(
				"[IRCalendarQueryService] serving stale disk cache while schedule revalidates",
				{
					cacheKey,
				},
			);
		}

		const stubWorkspace = this.createStubWorkspaceData();
		const queryScope = this.buildQueryScopeFromSerialized(
			diskEntry.result,
			cacheKey,
		);
		const hydratedBase = this.hydrateDiskCacheResult(
			stubWorkspace,
			diskEntry.result,
		);
		const readingMaterials = includeReadingMaterials
			? await this.getReadingMaterials()
			: [];
		const attached = this.attachRuntimeContext(
			hydratedBase,
			stubWorkspace,
			readingMaterials,
			queryScope,
		);
		await this.syncDayIndexFromResult({
			cacheKey,
			settingsFingerprint,
			scheduleFingerprint: diskEntry.scheduleFingerprint,
			result: attached,
		});
		return attached;
	}

	private async isDiskCacheScheduleFingerprintValid(
		cachedScheduleFingerprint: string,
		cacheKey?: string,
	): Promise<boolean> {
		const expected = String(cachedScheduleFingerprint || "").trim();
		if (!expected) {
			return false;
		}
		try {
			const scheduleIndex = getSharedIRScheduleIndexService(this.app);
			const peeked = await scheduleIndex.peekScheduleFingerprint();
			if (peeked !== null) {
				return peeked === expected;
			}
			const resolvedCacheKey = String(cacheKey || "").trim();
			if (resolvedCacheKey) {
				const manifest = await getSharedIRCalendarDayIndexService(
					this.app,
				).peekScopeManifest(resolvedCacheKey);
				const manifestFingerprint = String(
					manifest?.scheduleFingerprint || "",
				).trim();
				if (manifestFingerprint) {
					return manifestFingerprint === expected;
				}
			}
		} catch (error) {
			logger.debug(
				"[IRCalendarQueryService] schedule fingerprint validation failed:",
				error,
			);
		}
		return false;
	}

	private async syncDayIndexFromResult(input: {
		cacheKey: string;
		settingsFingerprint: string;
		scheduleFingerprint: string;
		result: IRCalendarQueryResult;
		priorityDateKeys?: string[];
	}): Promise<void> {
		try {
			const todayKey = this.getLocalTodayDateKey();
			const priorityDateKeys = Array.from(
				new Set(
					[todayKey, ...(input.priorityDateKeys || [])]
						.map((key) => String(key || "").trim())
						.filter(Boolean),
				),
			);
			await getSharedIRCalendarDayIndexService(
				this.app,
			).syncFromMaterialsByDate({
				cacheKey: input.cacheKey,
				settingsFingerprint: input.settingsFingerprint,
				scheduleFingerprint: input.scheduleFingerprint,
				materialsByDate: input.result.materialsByDate,
				priorityDateKeys,
			});
		} catch (error) {
			logger.debug("[IRCalendarQueryService] Failed to sync day index:", error);
		}
	}

	private getLocalTodayDateKey(): string {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, "0");
		const day = String(now.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	private attachRuntimeContext(
		result: IRCalendarQueryResult,
		workspaceData: IRWorkspaceDataSnapshot,
		readingMaterials: ReadingMaterial[],
		scope: Pick<IRCalendarQueryScope, "deckIds" | "horizonDays" | "cacheKey">,
	): IRCalendarQueryResult {
		const ghostPointIds: string[] = [];
		const keepItem = (item: ScheduleItem): boolean => {
			if (!shouldExcludeScheduleItemBySource(item)) {
				return true;
			}
			const id = String(item.id || "").trim();
			if (id) {
				ghostPointIds.push(id);
			}
			return false;
		};
		const normalizedMaterialsByDate = new Map(
			Array.from(result.materialsByDate.entries(), ([dateKey, items]) => [
				dateKey,
				items
					.filter(keepItem)
					.map((item) => this.normalizeScheduleItemDisplayName(item)),
			]),
		);
		const normalizedSuspendedItems = result.continueReadingSuspendedItemsPool
			.filter(keepItem)
			.map((item) => this.normalizeScheduleItemDisplayName(item));
		if (ghostPointIds.length > 0) {
			scheduleIRDeckGhostPointCleanup(this.app, ghostPointIds);
		}
		return {
			...result,
			workspaceData,
			readingMaterials,
			materialsByDate: normalizedMaterialsByDate,
			continueReadingSuspendedItemsPool: normalizedSuspendedItems,
			scope: {
				deckIds: scope.deckIds,
				horizonDays: scope.horizonDays,
				cacheKey: scope.cacheKey,
				stateKey: this.buildStateKey(workspaceData, result.schedule),
			},
		};
	}

	private async buildCalendarQueryResult(
		workspaceData: IRWorkspaceDataSnapshot,
		schedule: IRPlannedSchedule,
		readingMaterials: ReadingMaterial[],
		options: IRCalendarQueryOptions,
		scope: IRCalendarQueryScope,
	): Promise<IRCalendarQueryResult> {
		const startedAt = Date.now();
		const projectedSummary = await getProjectedScheduleSummary(this.app, {
			schedule,
			deckIds: scope.deckIds,
			horizonDays: options.horizonDays,
			reason: options.reason,
			seedData: {
				decksRecord: workspaceData.decksRecord,
				blocksRecord: workspaceData.blocksRecord,
				history: workspaceData.history,
			},
		});
		// 月历材料按承诺 due 分桶；不使用 PlanGenerator 改写后的计划槽日。
		const ghostPointIds: string[] = [];
		const materialsByDate = buildCalendarMaterialsByCommittedDue(
			projectedSummary,
			{ ghostPointIds },
		);
		if (ghostPointIds.length > 0) {
			scheduleIRDeckGhostPointCleanup(this.app, ghostPointIds);
		}

		const continueReadingSuspendedItemsPool =
			options.includeReadingMaterials === false
				? []
				: await this.buildContinueReadingSuspendedItemPool(
						workspaceData,
						scope,
				  );
		logger.debug("[IRCalendarQueryService] query ready", {
			deckIds: scope.deckIds,
			horizonDays: options.horizonDays,
			dates: materialsByDate.size,
			suspendedPool: continueReadingSuspendedItemsPool.length,
			generatedAt: schedule.generatedAt,
			durationMs: Date.now() - startedAt,
		});
		return {
			workspaceData,
			readingMaterials,
			materialsByDate,
			continueReadingSuspendedItemsPool,
			schedule,
			scope,
		};
	}

	private async getSchedule(
		options: IRCalendarQueryOptions,
		scope: Pick<IRCalendarQueryScope, "deckIds" | "horizonDays">,
	): Promise<IRPlannedSchedule> {
		const kernel = getSharedIRScheduleKernel(this.app);
		const recomputeOptions: RecomputeOptions = {
			deckIds: scope.deckIds,
			horizonDays: scope.horizonDays,
			leanSchedule: options.includeReadingMaterials === false,
		};
		if (options.forceRecompute) {
			return await kernel.recomputeScheduleForDeck(
				options.reason ?? "ui_refresh",
				recomputeOptions,
			);
		}
		return (
			kernel.getCachedSchedule(recomputeOptions) ??
			(await kernel.recomputeScheduleForDeck(
				options.reason ?? "ui_refresh",
				recomputeOptions,
			))
		);
	}

	private async getReadingMaterials(): Promise<ReadingMaterial[]> {
		const plugin = getIncrementalReadingPlugin(this.app);
		if (!plugin?.readingMaterialManager) {
			return [];
		}
		try {
			return await Promise.resolve(
				plugin.readingMaterialManager.getAllMaterials(),
			);
		} catch (error) {
			logger.warn("[IRCalendarQueryService] 读取阅读材料失败", error);
			return [];
		}
	}

	private async buildContinueReadingSuspendedItemPool(
		workspaceData: IRWorkspaceDataSnapshot,
		scope: Pick<IRCalendarQueryScope, "deckIds">,
	): Promise<ScheduleItem[]> {
		const items: ScheduleItem[] = [];
		const seenIds = new Set<string>();
		const matchesScope = (item: ScheduleItem): boolean => {
			if (scope.deckIds.length === 0) {
				return true;
			}
			const canonicalDeckId = this.resolveCanonicalDeckId(
				item.deckId,
				workspaceData,
			);
			return canonicalDeckId ? scope.deckIds.includes(canonicalDeckId) : false;
		};
		const appendIfSuspended = (item: ScheduleItem | null | undefined): void => {
			if (
				!item ||
				!item.id ||
				seenIds.has(item.id) ||
				!this.isSuspendedContinueReadingStatus(item.scheduleStatus) ||
				!matchesScope(item)
			) {
				return;
			}
			seenIds.add(item.id);
			items.push(item);
		};

		for (const chunk of Object.values(workspaceData.chunksRecord)) {
			appendIfSuspended(buildScheduleItemFromChunkData(chunk));
		}

		for (const task of workspaceData.pdfTasks) {
			appendIfSuspended(buildScheduleItemFromPdfTask(task));
		}

		const epubItems = await Promise.all(
			workspaceData.epubTasks.map(async (task) => {
				const resolvedFilePath = await this.resolveEpubTaskFilePath(task);
				return await buildScheduleItemFromEpubTask(task, { resolvedFilePath });
			}),
		);
		for (const item of epubItems) {
			appendIfSuspended(item);
		}

		return items;
	}

	private isSuspendedContinueReadingStatus(
		status: string | undefined | null,
	): boolean {
		const normalizedStatus = String(status || "")
			.trim()
			.toLowerCase();
		return normalizedStatus === "suspended" || normalizedStatus === "archived";
	}

	private async resolveEpubTaskFilePath(task: {
		sourceId?: string;
		epubFilePath?: string;
	}): Promise<string> {
		return (
			(await this.getEpubStorageService().resolveSourceFilePath(
				String(task?.sourceId || "").trim() || undefined,
				String(task?.epubFilePath || "").trim() || undefined,
			)) || String(task?.epubFilePath || "").trim()
		);
	}

	private getEpubStorageService(): IrEpubStorageLike {
		if (!this.epubStorageService) {
			this.epubStorageService = getIrEpubStorageService(this.app);
		}
		return this.epubStorageService;
	}

	private getDiskCachePath(): string {
		return getPluginPaths(this.app).cache.incrementalReading.irCalendarCache;
	}

	private createEmptyDiskCacheStore(): IRCalendarDiskCacheStore {
		return {
			version: IR_CALENDAR_DISK_CACHE_VERSION,
			lastUpdated: new Date(0).toISOString(),
			entries: {},
		};
	}

	private normalizeDiskCacheStore(raw: unknown): IRCalendarDiskCacheStore {
		if (!raw || typeof raw !== "object") {
			return this.createEmptyDiskCacheStore();
		}
		const candidate = raw as Partial<IRCalendarDiskCacheStore>;
		const version =
			typeof candidate.version === "string" && candidate.version.trim()
				? candidate.version.trim()
				: "";
		if (version !== IR_CALENDAR_DISK_CACHE_VERSION) {
			return this.createEmptyDiskCacheStore();
		}
		return {
			version,
			lastUpdated:
				typeof candidate.lastUpdated === "string" &&
				candidate.lastUpdated.trim()
					? candidate.lastUpdated
					: new Date().toISOString(),
			entries:
				candidate.entries && typeof candidate.entries === "object"
					? candidate.entries
					: {},
		};
	}

	private async loadDiskCacheStore(): Promise<IRCalendarDiskCacheStore> {
		if (this.diskCacheStore) {
			return this.diskCacheStore;
		}
		if (this.inflightDiskCacheLoad) {
			return this.inflightDiskCacheLoad;
		}
		const loadPromise = (async () => {
			const adapter = this.app.vault.adapter;
			const cachePath = this.getDiskCachePath();
			try {
				if (!(await adapter.exists(cachePath))) {
					const emptyStore = this.createEmptyDiskCacheStore();
					this.diskCacheStore = emptyStore;
					this.diskCacheLoaded = true;
					return emptyStore;
				}
				const content = await adapter.read(cachePath);
				const store = this.normalizeDiskCacheStore(JSON.parse(content));
				this.diskCacheStore = store;
				this.diskCacheLoaded = true;
				return store;
			} catch (error) {
				logger.warn("[IRCalendarQueryService] 读取日历磁盘缓存失败", error);
				const emptyStore = this.createEmptyDiskCacheStore();
				this.diskCacheStore = emptyStore;
				this.diskCacheLoaded = true;
				return emptyStore;
			}
		})();
		this.inflightDiskCacheLoad = loadPromise;
		try {
			return await loadPromise;
		} finally {
			if (this.inflightDiskCacheLoad === loadPromise) {
				this.inflightDiskCacheLoad = null;
			}
		}
	}

	private async readDiskCacheEntry(
		cacheKey: string,
	): Promise<IRCalendarDiskCacheEntry | null> {
		const store = this.diskCacheLoaded
			? this.diskCacheStore || this.createEmptyDiskCacheStore()
			: await this.loadDiskCacheStore();
		return store.entries[cacheKey] || null;
	}

	private async persistDiskCacheEntry(
		cacheKey: string,
		entry: IRCalendarDiskCacheEntry,
	): Promise<void> {
		this.pendingDiskCacheEntries.set(cacheKey, entry);
		const store = this.diskCacheLoaded
			? this.diskCacheStore || this.createEmptyDiskCacheStore()
			: await this.loadDiskCacheStore();
		this.diskCacheStore = {
			...store,
			version: IR_CALENDAR_DISK_CACHE_VERSION,
			lastUpdated: new Date().toISOString(),
			entries: {
				...store.entries,
				[cacheKey]: entry,
			},
		};
		this.diskCacheLoaded = true;
		this.scheduleDebouncedDiskCacheFlush();
	}

	private scheduleDebouncedDiskCacheFlush(): void {
		if (this.diskCacheWriteDebounceTimer) {
			window.clearTimeout(this.diskCacheWriteDebounceTimer);
		}
		this.diskCacheWriteDebounceTimer = window.setTimeout(() => {
			this.diskCacheWriteDebounceTimer = null;
			void this.flushPendingDiskCacheEntries();
		}, IR_CALENDAR_DISK_WRITE_DEBOUNCE_MS);
	}

	private async flushPendingDiskCacheEntries(): Promise<void> {
		if (this.pendingDiskCacheEntries.size === 0) {
			return;
		}
		try {
			const store = this.diskCacheLoaded
				? this.diskCacheStore || this.createEmptyDiskCacheStore()
				: await this.loadDiskCacheStore();
			const nextEntries = { ...store.entries };
			for (const [cacheKey, entry] of this.pendingDiskCacheEntries.entries()) {
				nextEntries[cacheKey] = entry;
			}
			this.pendingDiskCacheEntries.clear();
			const nextStore: IRCalendarDiskCacheStore = {
				...store,
				version: IR_CALENDAR_DISK_CACHE_VERSION,
				lastUpdated: new Date().toISOString(),
				entries: nextEntries,
			};
			const previousWrite = this.inflightDiskCacheWrite ?? Promise.resolve();
			const writePromise = previousWrite
				.catch(() => undefined)
				.then(async () => {
					await DirectoryUtils.ensureDirForFile(
						this.app.vault.adapter,
						this.getDiskCachePath(),
					);
					await this.app.vault.adapter.write(
						this.getDiskCachePath(),
						JSON.stringify(nextStore),
					);
					this.diskCacheStore = nextStore;
					this.diskCacheLoaded = true;
				});
			this.inflightDiskCacheWrite = writePromise;
			try {
				await writePromise;
			} finally {
				if (this.inflightDiskCacheWrite === writePromise) {
					this.inflightDiskCacheWrite = null;
				}
			}
		} catch (error) {
			logger.warn("[IRCalendarQueryService] 写入日历磁盘缓存失败", error);
		}
	}

	private serializeQueryResult(
		result: IRCalendarQueryResult,
	): SerializedIRCalendarQueryResult {
		return {
			materialsByDate: Array.from(
				result.materialsByDate.entries(),
				([dateKey, items]) => [
					dateKey,
					items.map((item) => this.serializeScheduleItem(item)),
				],
			),
			continueReadingSuspendedItemsPool:
				result.continueReadingSuspendedItemsPool.map((item) =>
					this.serializeScheduleItem(item),
				),
			schedule: this.serializePlannedSchedule(result.schedule),
			scope: {
				deckIds: [...result.scope.deckIds],
				horizonDays: result.scope.horizonDays,
				cacheKey: result.scope.cacheKey,
			},
		};
	}

	private hydrateDiskCacheResult(
		workspaceData: IRWorkspaceDataSnapshot,
		serialized: SerializedIRCalendarQueryResult,
	): IRCalendarQueryResult {
		const schedule = this.hydratePlannedSchedule(serialized.schedule);
		return {
			workspaceData,
			readingMaterials: [],
			materialsByDate: new Map(
				(serialized.materialsByDate || []).map(([dateKey, items]) => [
					dateKey,
					(items || []).map((item) => this.hydrateScheduleItem(item)),
				]),
			),
			continueReadingSuspendedItemsPool: (
				serialized.continueReadingSuspendedItemsPool || []
			).map((item) => this.hydrateScheduleItem(item)),
			schedule,
			scope: {
				deckIds: [...(serialized.scope?.deckIds || [])],
				horizonDays: serialized.scope?.horizonDays,
				cacheKey: String(serialized.scope?.cacheKey || "").trim(),
				stateKey: this.buildStateKey(workspaceData, schedule),
			},
		};
	}

	private serializeScheduleItem(item: ScheduleItem): SerializedScheduleItem {
		return {
			...item,
			nextReviewDate: item.nextReviewDate
				? item.nextReviewDate.toISOString()
				: null,
		};
	}

	private hydrateScheduleItem(item: SerializedScheduleItem): ScheduleItem {
		return this.normalizeScheduleItemDisplayName({
			...item,
			nextReviewDate: item.nextReviewDate
				? new Date(item.nextReviewDate)
				: null,
		});
	}

	private normalizeScheduleItemDisplayName(item: ScheduleItem): ScheduleItem {
		if (item.sourceType !== "pdf" && item.sourceType !== "epub") {
			return item;
		}

		const title = String(item.title || "").trim();
		if (!title) {
			return item;
		}

		const normalizedDisplayName = extractReadingPointDisplayName(title);
		if (!normalizedDisplayName) {
			return item;
		}

		if (String(item.displayName || "").trim() === normalizedDisplayName) {
			return item;
		}

		return {
			...item,
			displayName: normalizedDisplayName,
		};
	}

	private serializePlannedSchedule(
		schedule: IRPlannedSchedule,
	): SerializedPlannedSchedule {
		return {
			generatedAt: schedule.generatedAt,
			version: schedule.version,
			deckIds: [...schedule.deckIds],
			triggerReason: schedule.triggerReason,
			days: schedule.days.map((day) => ({
				...day,
				items: day.items.map((item) => ({
					...item,
					nextReviewDate: item.nextReviewDate
						? item.nextReviewDate.toISOString()
						: null,
				})),
			})),
		};
	}

	private hydratePlannedSchedule(
		schedule: SerializedPlannedSchedule,
	): IRPlannedSchedule {
		const days: IRPlannedDay[] = (schedule.days || []).map((day) => ({
			...day,
			items: (day.items || []).map((item) => ({
				...item,
				nextReviewDate: item.nextReviewDate
					? new Date(item.nextReviewDate)
					: null,
			})),
		}));
		return {
			generatedAt: schedule.generatedAt,
			version: schedule.version,
			days,
			itemsByDate: new Map(days.map((day) => [day.dateKey, day.items])),
			deckIds: [...(schedule.deckIds || [])],
			triggerReason: schedule.triggerReason,
		};
	}

	private buildSettingsFingerprint(): string {
		return hashStableValue(readIncrementalReadingSettings(this.app));
	}

	private buildQueryScope(
		workspaceData: IRWorkspaceDataSnapshot,
		options: IRCalendarQueryOptions,
	): IRCalendarQueryScope {
		const normalizedTargets = this.normalizeIdentifiers(options.deckIds || []);
		const canonicalByIdentifier = new Map<string, string>();
		const canonicalDeckIds: string[] = [];

		for (const deck of Object.values(workspaceData.decksRecord || {})) {
			const deckId = String(deck?.id || "").trim();
			const deckPath = String(deck.path || "").trim();
			const identifiers = this.normalizeIdentifiers([deckId, deckPath]);
			if (identifiers.length === 0) {
				continue;
			}
			for (const identifier of identifiers) {
				if (deckId) {
					canonicalByIdentifier.set(identifier, deckId);
				}
			}
		}

		for (const identifier of normalizedTargets) {
			const canonicalDeckId =
				canonicalByIdentifier.get(identifier) || identifier;
			if (!canonicalDeckIds.includes(canonicalDeckId)) {
				canonicalDeckIds.push(canonicalDeckId);
			}
		}

		const cacheKey = this.buildQueryCacheKey({
			deckIds: canonicalDeckIds,
			horizonDays: options.horizonDays,
		});

		return {
			deckIds: canonicalDeckIds,
			horizonDays: options.horizonDays,
			cacheKey,
			stateKey: "",
		};
	}

	private resolveCanonicalDeckId(
		deckIdentifier: string | null | undefined,
		workspaceData: IRWorkspaceDataSnapshot,
	): string {
		const normalizedIdentifier = String(deckIdentifier || "").trim();
		if (!normalizedIdentifier) {
			return "";
		}

		for (const deck of Object.values(workspaceData.decksRecord || {})) {
			const deckId = String(deck?.id || "").trim();
			const deckPath = String(deck.path || "").trim();
			if (
				normalizedIdentifier === deckId ||
				normalizedIdentifier === deckPath
			) {
				return deckId || normalizedIdentifier;
			}
		}

		return normalizedIdentifier;
	}

	private buildQueryCacheKey(
		options: Pick<IRCalendarQueryScope, "deckIds" | "horizonDays">,
	): string {
		const normalizedDeckIds = this.normalizeIdentifiers(
			options.deckIds || [],
		).sort((left, right) => left.localeCompare(right));
		const deckKey =
			normalizedDeckIds.length > 0 ? normalizedDeckIds.join("||") : "__all__";
		const horizonKey = Number.isFinite(options.horizonDays)
			? String(options.horizonDays)
			: "__default__";
		return `${deckKey}::${horizonKey}`;
	}

	private buildStateKey(
		workspaceData: IRWorkspaceDataSnapshot,
		schedule: IRPlannedSchedule,
	): string {
		return `${workspaceData.generatedAt}::${schedule.generatedAt}`;
	}

	private normalizeIdentifiers(
		values: Array<string | null | undefined>,
	): string[] {
		return Array.from(
			new Set(
				values.map((value) => String(value || "").trim()).filter(Boolean),
			),
		);
	}
}

const calendarQueryServiceByApp = new WeakMap<App, IRCalendarQueryService>();

export function getSharedIRCalendarQueryService(
	app: App,
): IRCalendarQueryService {
	let service = calendarQueryServiceByApp.get(app);
	if (!service) {
		service = new IRCalendarQueryService(app);
		calendarQueryServiceByApp.set(app, service);
	}
	return service;
}
