import type { App } from "obsidian";
import { logger } from "../../utils/logger";
import {
	type IRCalendarDaySummary,
	getSharedIRCalendarDayIndexService,
} from "./IRCalendarDayIndexService";
import { getSharedIRCalendarQueryService } from "./IRCalendarQueryService";
import type { ScheduleItem } from "./IRCalendarScheduleItem";
import { getChunkTopicIds, getTaskTopicId } from "../../utils/ir-topic-compat";
import { mergeDueIndexIntoPriorityProjection, areDayMaterialIdsAlignedWithDue } from "./IRDueDateDayHydrateService";
import {
	getSharedIRDueDateIndexService,
} from "./IRDueDateIndexService";
import { getSharedIRPointStorageService } from "./IRPointStorageService";
import { getSharedIRScheduleIndexService } from "./IRScheduleIndexService";
import { IRStorageService } from "./IRStorageService";

export type IRProjectionHydrateSource =
	| "day_index"
	| "tier0"
	| "stale_disk"
	| "due_index"
	| "none";

export type IRProjectionReadinessLevel =
	| "R0_shell"
	| "R1_day"
	| "R2_month"
	| "R3_materials";

export interface IRProjectionPriorityHydrateResult {
	materialsByDate: Map<string, ScheduleItem[]>;
	daySummaries: Map<string, IRCalendarDaySummary>;
	source: IRProjectionHydrateSource;
}

export type IRProjectionPatch = {
	priorityDateKeys?: string[];
	monthKeys?: string[];
	reason?: string;
	deckIds?: string[];
	/** 后台 reconcile 刚算出的优先日期列表；有值时 UI 应直接合并，避免再次读取尚未落盘的投影。 */
	reconciledMaterialsByDate?: Map<string, ScheduleItem[]>;
	/** 后台 calendar-reconcile 失败时为 true，UI 可进入 degraded 冷却。 */
	reconcileFailed?: boolean;
};

export type IRProjectionPatchListener = (patch: IRProjectionPatch) => void;

export interface IRProjectionEnsureReadyOptions {
	minLevel?: IRProjectionReadinessLevel;
	deckIds?: string[];
	priorityDateKeys?: string[];
	monthKeys?: string[];
}

export interface IRProjectionEnsureReadyResult {
	level: IRProjectionReadinessLevel;
	monthHeatmap: Map<string, Record<string, number>> | null;
	projection: IRProjectionPriorityHydrateResult | null;
}

export interface IRBackgroundReconcileOptions {
	deckIds?: string[];
	forceRecompute?: boolean;
	priorityDateKeys: string[];
}

/**
 * 投影运行时门面：UI 读路径统一入口，避免组件内 load/enrich 编排。
 * 底层复用 IRCalendarDayIndexService（磁盘投影）与 IRCalendarQueryService（重建工具）。
 */
/** L1 全日队列写入后的保护窗口：覆盖 L2 debounce(~750ms) + calendar-reconcile(~2s)。 */
const L1_DAY_QUEUE_FRESH_TTL_MS = 8_000;

export class IRProjectionRuntime {
	private lastReconcileSessionKey: string | null = null;
	private readonly listeners = new Set<IRProjectionPatchListener>();
	private coldStartPreloadPromise: Promise<void> | null = null;
	/** dateKey → 过期时间戳；未过期时后台 reconcile / L2 hydrate 不得冲掉该日队列。 */
	private readonly l1DayQueueFreshUntilByDate = new Map<string, number>();

	constructor(private readonly app: App) {}

	/**
	 * L1 `patchDayQueue` 成功后标记：该日以 L1 全日队列为准，短暂跳过不完整投影覆盖。
	 */
	markL1DayQueueFresh(
		dateKeys: Iterable<string>,
		ttlMs: number = L1_DAY_QUEUE_FRESH_TTL_MS,
	): void {
		const until = Date.now() + Math.max(0, ttlMs);
		for (const raw of dateKeys) {
			const dateKey = String(raw || "").trim();
			if (!dateKey) {
				continue;
			}
			const previous = this.l1DayQueueFreshUntilByDate.get(dateKey) || 0;
			this.l1DayQueueFreshUntilByDate.set(dateKey, Math.max(previous, until));
		}
	}

	isL1DayQueueFresh(dateKey: string): boolean {
		const normalized = String(dateKey || "").trim();
		if (!normalized) {
			return false;
		}
		const until = this.l1DayQueueFreshUntilByDate.get(normalized);
		if (until == null) {
			return false;
		}
		if (Date.now() >= until) {
			this.l1DayQueueFreshUntilByDate.delete(normalized);
			return false;
		}
		return true;
	}

	/** 过滤掉仍在 L1 新鲜窗口内的日期（供 reconcile / L2 notify 使用）。 */
	filterOutL1FreshDateKeys(dateKeys: Iterable<string>): string[] {
		const result: string[] = [];
		for (const raw of dateKeys) {
			const dateKey = String(raw || "").trim();
			if (!dateKey) {
				continue;
			}
			if (!this.isL1DayQueueFresh(dateKey)) {
				result.push(dateKey);
			}
		}
		return result;
	}

	clearL1DayQueueFresh(dateKeys?: Iterable<string>): void {
		if (!dateKeys) {
			this.l1DayQueueFreshUntilByDate.clear();
			return;
		}
		for (const raw of dateKeys) {
			const dateKey = String(raw || "").trim();
			if (dateKey) {
				this.l1DayQueueFreshUntilByDate.delete(dateKey);
			}
		}
	}

	private static readinessRank(level: IRProjectionReadinessLevel): number {
		switch (level) {
			case "R0_shell":
				return 0;
			case "R1_day":
				return 1;
			case "R2_month":
				return 2;
			case "R3_materials":
				return 3;
			default:
				return 0;
		}
	}

	/**
	 * 插件 onload / 月历打开前：并行预读 schedule-index、day-index、due-index、point-files revision。
	 * 不触发全库 point 扫描；due 缺失时仅用已 warm 的 schedule 源内存补齐。
	 */
	preloadColdStartCaches(): Promise<void> {
		if (this.coldStartPreloadPromise) {
			return this.coldStartPreloadPromise;
		}

		this.coldStartPreloadPromise = (async () => {
			const startedAt = Date.now();
			try {
				const pointStorage = getSharedIRPointStorageService(this.app);
				const scheduleIndex = getSharedIRScheduleIndexService(this.app);
				const dueIndex = getSharedIRDueDateIndexService(this.app);
				await pointStorage.initialize();
				const [scheduleWarmed, dayIndexWarmed, dueWarmed] = await Promise.all([
					scheduleIndex.warmDiskCache(),
					getSharedIRCalendarDayIndexService(this.app).warmDiskCache(),
					dueIndex.warmDiskCache(),
					pointStorage.getPointFilesIndexRevision(),
				]).then(([scheduleOk, dayOk, dueOk]) => [scheduleOk, dayOk, dueOk]);

				// schedule 已 warm：始终用 peek 源重建 due（O(index)，禁止 getScheduleSources）。
				// 避免「非空但过期」的 due 磁盘导致今日逾期滚入/ skip 对账漂移。
				if (scheduleWarmed) {
					const warmSources = await scheduleIndex.peekWarmScheduleSources();
					if (warmSources) {
						await dueIndex.rebuildFromWarmScheduleSources(warmSources);
					}
				}

				logger.info("[IRProjectionRuntime] cold start caches preloaded", {
					durationMs: Date.now() - startedAt,
					scheduleWarmed,
					dayIndexWarmed,
					dueWarmed,
				});
			} catch (error) {
				this.coldStartPreloadPromise = null;
				logger.warn("[IRProjectionRuntime] cold start preload failed:", error);
			}
		})();

		return this.coldStartPreloadPromise;
	}

	/**
	 * 确保投影达到指定就绪级别（默认 R1：今日/选中日列表可交互）。
	 * 返回已恢复的月热力与优先日期投影，供 load 编排复用，避免重复 hydrate。
	 */
	async ensureReady(
		options: IRProjectionEnsureReadyOptions = {},
	): Promise<IRProjectionEnsureReadyResult> {
		await this.preloadColdStartCaches();

		const minLevel = options.minLevel ?? "R1_day";
		const priorityDateKeys = Array.from(
			new Set(
				(options.priorityDateKeys || [])
					.map((key) => String(key || "").trim())
					.filter(Boolean),
			),
		);
		const monthKeys = Array.from(
			new Set(
				(options.monthKeys || [])
					.map((key) => String(key || "").trim())
					.filter(Boolean),
			),
		);

		let monthHeatmap: Map<string, Record<string, number>> | null = null;
		let projection: IRProjectionPriorityHydrateResult | null = null;

		if (monthKeys.length > 0) {
			monthHeatmap = await this.hydrateMonthHeatmapFromProjection(
				options.deckIds,
				monthKeys,
			);
		}

		if (priorityDateKeys.length > 0) {
			projection = await this.hydratePriorityDatesFromProjection(
				options.deckIds,
				priorityDateKeys,
			);
		}

		const hasPriorityDates =
			priorityDateKeys.length === 0 || Boolean(projection);
		const hasMonthHeatmap =
			monthKeys.length === 0 || Boolean(monthHeatmap && monthHeatmap.size > 0);
		const level = this.getReadinessLevel(hasPriorityDates, hasMonthHeatmap);

		if (
			IRProjectionRuntime.readinessRank(level) <
			IRProjectionRuntime.readinessRank(minLevel)
		) {
			logger.debug("[IRProjectionRuntime] ensureReady below target", {
				level,
				minLevel,
				hasPriorityDates,
				hasMonthHeatmap,
			});
		}

		return { level, monthHeatmap, projection };
	}

	getReadinessLevel(
		hasPriorityDates: boolean,
		hasMonthHeatmap: boolean,
	): IRProjectionReadinessLevel {
		if (!hasPriorityDates) {
			return "R0_shell";
		}
		if (!hasMonthHeatmap) {
			return "R1_day";
		}
		return "R2_month";
	}

	subscribe(listener: IRProjectionPatchListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	notify(patch: IRProjectionPatch): void {
		for (const listener of this.listeners) {
			try {
				listener(patch);
			} catch (error) {
				logger.warn("[IRProjectionRuntime] listener failed:", error);
			}
		}
	}

	markStale(): void {
		this.lastReconcileSessionKey = null;
		// 允许下次 ensureReady 重新 preload（invalidate 后内存索引可能已空）。
		this.coldStartPreloadPromise = null;
		// 全量失效时解除 L1 保护，避免 vault rebuild 被短暂跳过。
		this.clearL1DayQueueFresh();
	}

	buildReconcileSessionKey(options: IRBackgroundReconcileOptions): string {
		const queryService = getSharedIRCalendarQueryService(this.app);
		const cacheKey = queryService.buildQueryCacheKeyForDeckIds(
			options.deckIds || [],
		);
		const settingsFingerprint = queryService.getSettingsFingerprint();
		const dateKeys = Array.from(
			new Set(
				options.priorityDateKeys
					.map((key) => String(key || "").trim())
					.filter(Boolean),
			),
		).sort();
		return `${cacheKey}::${settingsFingerprint}::${dateKeys.join(",")}::${
			options.forceRecompute ? "force" : "normal"
		}`;
	}

	markBackgroundReconcileComplete(
		options: IRBackgroundReconcileOptions,
		scheduleFingerprint?: string,
	): void {
		const baseKey = this.buildReconcileSessionKey(options);
		const schedulePart = String(scheduleFingerprint || "").trim();
		this.lastReconcileSessionKey = schedulePart
			? `${baseKey}::${schedulePart}`
			: baseKey;
	}

	/**
	 * 指纹与切片齐全时跳过后台 reconcile（原 enrich 全量查询）。
	 */
	async shouldSkipBackgroundReconcile(
		options: IRBackgroundReconcileOptions,
	): Promise<boolean> {
		if (options.forceRecompute) {
			return false;
		}

		const queryService = getSharedIRCalendarQueryService(this.app);
		const cacheKey = queryService.buildQueryCacheKeyForDeckIds(
			options.deckIds || [],
		);
		const settingsFingerprint = queryService.getSettingsFingerprint();
		let scheduleFingerprint = "";
		try {
			scheduleFingerprint = String(
				(await getSharedIRScheduleIndexService(
					this.app,
				).peekScheduleFingerprint()) || "",
			).trim();
		} catch (error) {
			logger.debug(
				"[IRProjectionRuntime] schedule fingerprint peek failed",
				error,
			);
			return false;
		}

		const dateKeys = Array.from(
			new Set(
				options.priorityDateKeys
					.map((key) => String(key || "").trim())
					.filter(Boolean),
			),
		);
		// 禁止用 day-index 自身指纹自洽：schedule 未 warm 时会导致永远 skip、永不补齐今日队列。
		if (!scheduleFingerprint || dateKeys.length === 0) {
			return false;
		}

		// 会话门禁必须精确匹配 schedule 指纹，禁止 startsWith 在指纹变更后误 skip。
		const sessionKey = this.buildReconcileSessionKey(options);
		if (this.lastReconcileSessionKey === `${sessionKey}::${scheduleFingerprint}`) {
			return true;
		}

		const fresh = await getSharedIRCalendarDayIndexService(
			this.app,
		).hasFreshProjectionForPriorityDates({
			cacheKey,
			settingsFingerprint,
			scheduleFingerprint,
			dateKeys,
		});
		if (!fresh) {
			return false;
		}

		// 投影切片“看似新鲜”时仍与 due 倒排按 ID 对账（今日含逾期滚入；牌组作用域只校验本切片）。
		// 已完成沉底项仍在切片中但不在 due 倒排，必须并入 calendar-progress，否则冷启动永远无法 skip。
		const dueIndex = getSharedIRDueDateIndexService(this.app);
		await dueIndex.warmDiskCache();
		if (dueIndex.isMemoryStoreEmpty()) {
			// due 未就绪时不能用「空对空」误判对齐。
			return false;
		}
		const completedIdsByDate = await this.loadCalendarProgressSafe();
		const hydratedSlices = await getSharedIRCalendarDayIndexService(
			this.app,
		).tryHydrateDateKeys({
			cacheKey,
			settingsFingerprint,
			scheduleFingerprint,
			dateKeys,
		});
		const deckFilter = Array.from(
			new Set(
				(options.deckIds || [])
					.map((id) => String(id || "").trim())
					.filter(Boolean),
			),
		);
		for (const dateKey of dateKeys) {
			const dueIds = await dueIndex.getCalendarDuePointIdsForDate(dateKey);
			const scopedDueIds =
				deckFilter.length > 0
					? await this.filterDueIdsByDeckWarm(dueIds, deckFilter)
					: dueIds;
			const sliceItems = hydratedSlices?.materialsByDate.get(dateKey) || [];
			const completedIds = completedIdsByDate[dateKey] || [];
			if (
				!areDayMaterialIdsAlignedWithDue(
					sliceItems,
					scopedDueIds,
					completedIds,
				)
			) {
				return false;
			}
		}

		this.markBackgroundReconcileComplete(options, scheduleFingerprint);
		return true;
	}

	private async filterDueIdsByDeckWarm(
		dueIds: string[],
		deckIds: string[],
	): Promise<string[]> {
		const deckSet = new Set(deckIds);
		const warm = await getSharedIRScheduleIndexService(
			this.app,
		).peekWarmScheduleSources();
		if (!warm) {
			// 无 warm 索引时宁可不 skip，避免牌组视图误跳过补齐。
			return dueIds;
		}
		const deckById = new Map<string, string>();
		for (const chunk of warm.chunks || []) {
			const id = String(chunk.chunkId || "").trim();
			const deckId = String(getChunkTopicIds(chunk)[0] || "").trim();
			if (id && deckId) {
				deckById.set(id, deckId);
			}
		}
		for (const task of [...(warm.pdfTasks || []), ...(warm.epubTasks || [])]) {
			const id = String(task.id || "").trim();
			const deckId = String(getTaskTopicId(task) || "").trim();
			if (id && deckId) {
				deckById.set(id, deckId);
			}
		}
		return dueIds.filter((id) => {
			const deckId = deckById.get(id);
			// 未知牌组归属的 due 点保守保留，宁可多 reconcile 也不漏。
			return !deckId || deckSet.has(deckId);
		});
	}

	async hydratePriorityDatesFromProjection(
		deckIds: string[] | undefined,
		priorityDateKeys: string[],
	): Promise<IRProjectionPriorityHydrateResult | null> {
		const dateKeys = Array.from(
			new Set(
				priorityDateKeys.map((key) => String(key || "").trim()).filter(Boolean),
			),
		);
		if (dateKeys.length === 0) {
			return null;
		}

		const queryService = getSharedIRCalendarQueryService(this.app);

		let materialsByDate = new Map<string, ScheduleItem[]>();
		let daySummaries = new Map<string, IRCalendarDaySummary>();
		let source: IRProjectionHydrateSource = "none";

		const shell = await queryService.tryGetCalendarShellFromDayIndex({
			deckIds,
			priorityDateKeys: dateKeys,
		});
		if (shell) {
			materialsByDate = shell.result.materialsByDate;
			daySummaries = shell.daySummaries;
			source = "day_index";
		} else {
			const tier0 = await queryService.tryGetTier0CalendarResult({
				deckIds,
				priorityDateKeys: dateKeys,
			});
			if (tier0) {
				materialsByDate = tier0.result.materialsByDate;
				daySummaries = tier0.daySummaries;
				source = "tier0";
			} else {
				const staleDisk = await queryService.tryGetStaleDiskCalendarResult({
					deckIds,
					includeReadingMaterials: false,
					priorityDateKeys: dateKeys,
				});
				if (staleDisk) {
					materialsByDate = staleDisk.materialsByDate;
					for (const dateKey of dateKeys) {
						const items = staleDisk.materialsByDate.get(dateKey) || [];
						if (items.length > 0) {
							daySummaries.set(dateKey, { totalCount: items.length });
						}
					}
					source = "stale_disk";
				}
			}
		}

		const completedIdsByDate = await this.loadCalendarProgressSafe();

		// 无论是否有壳，冷路径都做 warm-only due 补洞（内存 map，禁止 snapshot 扫盘）。
		// 仅有壳就跳过会导致：day-index 今日切片为空时，界面只剩历史回顾、看不到今日/逾期队列。
		const merged = await mergeDueIndexIntoPriorityProjection(this.app, {
			deckIds,
			dateKeys,
			materialsByDate,
			daySummaries,
			completedIdsByDate,
			allowPointSnapshotFallback: false,
		});
		materialsByDate = merged.materialsByDate;
		daySummaries = merged.daySummaries;
		if (merged.filledDateKeys.length > 0 && source === "none") {
			source = "due_index";
		}

		if (source === "none" && materialsByDate.size === 0) {
			return null;
		}

		return {
			materialsByDate,
			daySummaries,
			source: source === "none" ? "due_index" : source,
		};
	}

	private async loadCalendarProgressSafe(): Promise<Record<string, string[]>> {
		try {
			const storage = new IRStorageService(this.app);
			await storage.initialize();
			return await storage.getCalendarProgress();
		} catch (error) {
			logger.debug(
				"[IRProjectionRuntime] calendar progress unavailable for due merge",
				error,
			);
			return {};
		}
	}

	async hydrateMonthHeatmapFromProjection(
		deckIds: string[] | undefined,
		monthKeys: string[],
	): Promise<Map<string, Record<string, number>> | null> {
		const normalizedMonthKeys = Array.from(
			new Set(monthKeys.map((key) => String(key || "").trim()).filter(Boolean)),
		);
		if (normalizedMonthKeys.length === 0) {
			return null;
		}

		const queryService = getSharedIRCalendarQueryService(this.app);
		let scheduleFingerprint = "";
		try {
			scheduleFingerprint = String(
				(await getSharedIRScheduleIndexService(
					this.app,
				).peekScheduleFingerprint()) || "",
			).trim();
		} catch {
			scheduleFingerprint = "";
		}
		// 无可靠 schedule 指纹时不恢复热力，避免过期热力把空列表误判为「已加载」。
		if (!scheduleFingerprint) {
			return null;
		}
		return getSharedIRCalendarDayIndexService(this.app).tryHydrateMonthHeatmap({
			cacheKey: queryService.buildQueryCacheKeyForDeckIds(deckIds || []),
			settingsFingerprint: queryService.getSettingsFingerprint(),
			monthKeys: normalizedMonthKeys,
			scheduleFingerprint,
		});
	}
}

const runtimeByApp = new WeakMap<App, IRProjectionRuntime>();

export function getSharedIRProjectionRuntime(app: App): IRProjectionRuntime {
	let runtime = runtimeByApp.get(app);
	if (!runtime) {
		runtime = new IRProjectionRuntime(app);
		runtimeByApp.set(app, runtime);
	}
	return runtime;
}
