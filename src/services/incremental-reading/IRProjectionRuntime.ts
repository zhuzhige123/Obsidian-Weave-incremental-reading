import type { App } from "obsidian";
import { logger } from "../../utils/logger";
import {
	type IRCalendarDaySummary,
	getSharedIRCalendarDayIndexService,
} from "./IRCalendarDayIndexService";
import { getSharedIRCalendarQueryService } from "./IRCalendarQueryService";
import type { ScheduleItem } from "./IRCalendarScheduleItem";
import { getSharedIRPointStorageService } from "./IRPointStorageService";
import { getSharedIRScheduleIndexService } from "./IRScheduleIndexService";

export type IRProjectionHydrateSource =
	| "day_index"
	| "tier0"
	| "stale_disk"
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
export class IRProjectionRuntime {
	private lastReconcileSessionKey: string | null = null;
	private readonly listeners = new Set<IRProjectionPatchListener>();
	private coldStartPreloadPromise: Promise<void> | null = null;

	constructor(private readonly app: App) {}

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
	 * 插件 onload / 月历打开前：并行预读 schedule-index、day-index、point-files revision。
	 * 不触发全库 point 扫描。
	 */
	preloadColdStartCaches(): Promise<void> {
		if (this.coldStartPreloadPromise) {
			return this.coldStartPreloadPromise;
		}

		this.coldStartPreloadPromise = (async () => {
			try {
				const pointStorage = getSharedIRPointStorageService(this.app);
				await pointStorage.initialize();
				await Promise.all([
					getSharedIRScheduleIndexService(this.app).warmDiskCache(),
					getSharedIRCalendarDayIndexService(this.app).warmDiskCache(),
					pointStorage.getPointFilesIndexRevision(),
				]);
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

		const sessionKey = this.buildReconcileSessionKey(options);
		if (this.lastReconcileSessionKey?.startsWith(`${sessionKey}::`)) {
			return true;
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
		if (!scheduleFingerprint) {
			const manifest = await getSharedIRCalendarDayIndexService(
				this.app,
			).peekScopeManifest(cacheKey);
			scheduleFingerprint = String(manifest?.scheduleFingerprint || "").trim();
		}

		const dateKeys = Array.from(
			new Set(
				options.priorityDateKeys
					.map((key) => String(key || "").trim())
					.filter(Boolean),
			),
		);
		if (!scheduleFingerprint || dateKeys.length === 0) {
			return false;
		}

		const fresh = await getSharedIRCalendarDayIndexService(
			this.app,
		).hasFreshProjectionForPriorityDates({
			cacheKey,
			settingsFingerprint,
			scheduleFingerprint,
			dateKeys,
		});
		if (fresh) {
			this.markBackgroundReconcileComplete(options, scheduleFingerprint);
			return true;
		}
		return false;
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

		const shell = await queryService.tryGetCalendarShellFromDayIndex({
			deckIds,
			priorityDateKeys: dateKeys,
		});
		if (shell) {
			return {
				materialsByDate: shell.result.materialsByDate,
				daySummaries: shell.daySummaries,
				source: "day_index",
			};
		}

		const tier0 = await queryService.tryGetTier0CalendarResult({
			deckIds,
			priorityDateKeys: dateKeys,
		});
		if (tier0) {
			return {
				materialsByDate: tier0.result.materialsByDate,
				daySummaries: tier0.daySummaries,
				source: "tier0",
			};
		}

		const staleDisk = await queryService.tryGetStaleDiskCalendarResult({
			deckIds,
			includeReadingMaterials: false,
			priorityDateKeys: dateKeys,
		});
		if (staleDisk) {
			const daySummaries = new Map<string, IRCalendarDaySummary>();
			for (const dateKey of dateKeys) {
				const items = staleDisk.materialsByDate.get(dateKey) || [];
				if (items.length > 0) {
					daySummaries.set(dateKey, { totalCount: items.length });
				}
			}
			return {
				materialsByDate: staleDisk.materialsByDate,
				daySummaries,
				source: "stale_disk",
			};
		}

		return null;
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
		return getSharedIRCalendarDayIndexService(this.app).tryHydrateMonthHeatmap({
			cacheKey: queryService.buildQueryCacheKeyForDeckIds(deckIds || []),
			settingsFingerprint: queryService.getSettingsFingerprint(),
			monthKeys: normalizedMonthKeys,
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
