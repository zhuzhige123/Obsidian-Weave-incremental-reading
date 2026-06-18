import type { App } from "obsidian";
import { logger } from "../../utils/logger";
import { getSharedIRCalendarBackgroundLoadCoordinator } from "./IRCalendarBackgroundLoadCoordinator";
import type { IRCalendarDaySummary } from "./IRCalendarDayIndexService";
import {
	getSharedIRCalendarQueryService,
	type IRCalendarQueryResult,
} from "./IRCalendarQueryService";
import type { ScheduleItem } from "./IRCalendarScheduleItem";
import {
	getSharedIRProjectionRuntime,
	type IRProjectionPriorityHydrateResult,
} from "./IRProjectionRuntime";

const CALENDAR_TIER0_TIMEOUT_MS = 8_000;

export type IRCalendarViewLoadPhase =
	| "shell_only"
	| "tier0"
	| "fast_query"
	| "full_rebuild"
	| "empty";

export interface IRCalendarViewLoadOptions {
	deckIds?: string[];
	priorityDateKeys: string[];
	monthKeys: string[];
	forceRecompute?: boolean;
	isCancelled?: () => boolean;
}

export interface IRCalendarViewLoadResult {
	phase: IRCalendarViewLoadPhase;
	monthHeatmap: Map<string, Record<string, number>> | null;
	projectionHydrate: IRProjectionPriorityHydrateResult | null;
	tier0: {
		result: IRCalendarQueryResult;
		daySummaries: Map<string, IRCalendarDaySummary>;
	} | null;
	fastQuery: IRCalendarQueryResult | null;
	fullQuery: IRCalendarQueryResult | null;
	scheduleReconcile: {
		deckIds?: string[];
		priorityDateKeys: string[];
		forceRecompute: boolean;
	};
}

async function awaitWithTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	label: string
): Promise<T | null> {
	let timeoutId: number | undefined;
	try {
		return await Promise.race([
			promise,
			new Promise<null>((resolve) => {
				timeoutId = window.setTimeout(() => {
					logger.debug(`[IRCalendarViewLoad] ${label} timed out after ${timeoutMs}ms`);
					resolve(null);
				}, timeoutMs);
			}),
		]);
	} finally {
		if (timeoutId !== undefined) {
			window.clearTimeout(timeoutId);
		}
	}
}

function runHeavyLoad<T>(app: App, task: () => Promise<T>): Promise<T> {
	return getSharedIRCalendarBackgroundLoadCoordinator(app).runHeavyLoad("sidebar-load", task);
}

/**
 * 月历视图加载编排（Phase 4 M6）：从 Sidebar 迁出的唯一 load 路径。
 */
export async function loadIRCalendarView(
	app: App,
	options: IRCalendarViewLoadOptions
): Promise<IRCalendarViewLoadResult> {
	const deckIds = options.deckIds;
	const priorityDateKeys = Array.from(
		new Set(options.priorityDateKeys.map((key) => String(key || "").trim()).filter(Boolean))
	);
	const monthKeys = Array.from(
		new Set(options.monthKeys.map((key) => String(key || "").trim()).filter(Boolean))
	);
	const forceRecompute = Boolean(options.forceRecompute);
	const isCancelled = options.isCancelled ?? (() => false);
	const runtime = getSharedIRProjectionRuntime(app);
	const queryService = getSharedIRCalendarQueryService(app);

	const scheduleReconcile = {
		deckIds,
		priorityDateKeys,
		forceRecompute: false,
	};

	const { monthHeatmap, projection: projectionHydrate } = forceRecompute
		? {
				monthHeatmap: await runtime.hydrateMonthHeatmapFromProjection(deckIds, monthKeys),
				projection: null as IRProjectionPriorityHydrateResult | null,
			}
		: await runtime.ensureReady({
				minLevel: "R1_day",
				deckIds,
				priorityDateKeys,
				monthKeys,
			});
	if (isCancelled()) {
		return {
			phase: "empty",
			monthHeatmap,
			projectionHydrate: null,
			tier0: null,
			fastQuery: null,
			fullQuery: null,
			scheduleReconcile,
		};
	}

	if (forceRecompute) {
		const fullQuery = await runHeavyLoad(app, () =>
			queryService.getCalendarQueryResult({
				deckIds,
				forceRecompute: true,
				reason: "ui_refresh",
				includeReadingMaterials: true,
				preferDiskCache: false,
			})
		);
		runtime.markStale();
		return {
			phase: "full_rebuild",
			monthHeatmap,
			projectionHydrate: null,
			tier0: null,
			fastQuery: null,
			fullQuery,
			scheduleReconcile: { ...scheduleReconcile, forceRecompute: false },
		};
	}

	if (isCancelled()) {
		return {
			phase: projectionHydrate ? "shell_only" : "empty",
			monthHeatmap,
			projectionHydrate,
			tier0: null,
			fastQuery: null,
			fullQuery: null,
			scheduleReconcile,
		};
	}

	// 已有日索引/投影切片时立即返回，禁止同步 tier-0 / lean query 阻塞首屏。
	// shell 仅校验 settings 指纹，与 shouldSkip（schedule 指纹）可能不一致；后者只影响后台 reconcile。
	if (projectionHydrate) {
		const skipReconcile = await runtime.shouldSkipBackgroundReconcile({
			deckIds,
			priorityDateKeys,
			forceRecompute: false,
		});
		if (!skipReconcile) {
			logger.debug("[IRCalendarViewLoad] projection shell served; deferring reconcile", {
				source: projectionHydrate.source,
				priorityDateKeys,
			});
		}
		return {
			phase: "shell_only",
			monthHeatmap,
			projectionHydrate,
			tier0: null,
			fastQuery: null,
			fullQuery: null,
			scheduleReconcile,
		};
	}

	const skipReconcile = await runtime.shouldSkipBackgroundReconcile({
		deckIds,
		priorityDateKeys,
		forceRecompute: false,
	});
	if (skipReconcile) {
		return {
			phase: "shell_only",
			monthHeatmap,
			projectionHydrate: null,
			tier0: null,
			fastQuery: null,
			fullQuery: null,
			scheduleReconcile,
		};
	}

	const tier0 = await awaitWithTimeout(
		queryService.tryGetTier0CalendarResult({ deckIds, priorityDateKeys }),
		CALENDAR_TIER0_TIMEOUT_MS,
		"tier-0 calendar hydration"
	);
	if (isCancelled()) {
		return {
			phase: tier0 ? "tier0" : "empty",
			monthHeatmap,
			projectionHydrate: null,
			tier0,
			fastQuery: null,
			fullQuery: null,
			scheduleReconcile,
		};
	}

	if (tier0) {
		return {
			phase: "tier0",
			monthHeatmap,
			projectionHydrate: null,
			tier0,
			fastQuery: null,
			fullQuery: null,
			scheduleReconcile,
		};
	}

	logger.debug("[IRCalendarViewLoad] no projection shell; deferring lean query to background reconcile", {
		priorityDateKeys,
	});

	return {
		phase: "empty",
		monthHeatmap,
		projectionHydrate: null,
		tier0: null,
		fastQuery: null,
		fullQuery: null,
		scheduleReconcile,
	};
}

/** 月历切月时仅恢复热力图投影，不触发 load 编排。 */
export async function hydrateIRCalendarMonthHeatmap(
	app: App,
	deckIds: string[] | undefined,
	monthKeys: string[]
): Promise<Map<string, Record<string, number>> | null> {
	return getSharedIRProjectionRuntime(app).hydrateMonthHeatmapFromProjection(deckIds, monthKeys);
}
