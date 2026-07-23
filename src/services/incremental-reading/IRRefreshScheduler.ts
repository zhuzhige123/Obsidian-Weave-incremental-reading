import type { App } from "obsidian";
import { logger } from "../../utils/logger";
import { getSharedIRCalendarBackgroundLoadCoordinator } from "./IRCalendarBackgroundLoadCoordinator";
import { getSharedIRCalendarQueryService } from "./IRCalendarQueryService";
import type { ScheduleItem } from "./IRCalendarScheduleItem";
import { getSharedIRHostCriticalWorkGuard } from "./IRHostCriticalWorkGuard";
import {
	type IRBackgroundReconcileOptions,
	getSharedIRProjectionRuntime,
} from "./IRProjectionRuntime";
import { getSharedIRScheduleIndexService } from "./IRScheduleIndexService";
import { getSharedIRScheduleKernel } from "./IRScheduleKernel";
import { IRTagGroupService } from "./IRTagGroupService";

export type IRRefreshWorkKind =
	| "calendar-reconcile"
	| "rebuild-vault"
	| "bootstrap";

export type IRRuntimeBootstrapPhase =
	| "idle"
	| "bootstrapping"
	| "ready"
	| "degraded";

export interface IRRefreshWorkUnit {
	kind: IRRefreshWorkKind;
	deckIds?: string[];
	priorityDateKeys: string[];
	forceRecompute?: boolean;
	reason?: string;
}

const DEFAULT_CALENDAR_RECONCILE_DEBOUNCE_MS = 2000;
const BOOTSTRAP_IDLE_TIMEOUT_MS = 4000;
const BOOTSTRAP_FALLBACK_DELAY_MS = 400;
const BOOTSTRAP_LEAN_QUERY_TIMEOUT_MS = 45_000;
const BOOTSTRAP_DEFER_RETRY_MS = 2500;

function getLocalTodayDateKey(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

async function awaitWithTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	label: string,
): Promise<T | null> {
	let timeoutId: number | undefined;
	try {
		return await Promise.race([
			promise,
			new Promise<null>((resolve) => {
				timeoutId = window.setTimeout(() => {
					logger.debug(
						`[IRRefreshScheduler] ${label} timed out after ${timeoutMs}ms`,
					);
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

/**
 * 统一后台刷新队列：bootstrap、calendar-reconcile、vault-rebuild。
 */
export class IRRefreshScheduler {
	private pendingCalendarReconcile: IRRefreshWorkUnit | null = null;
	private calendarDebounceTimer: number | null = null;
	private inflightReconcile: Promise<void> | null = null;
	private bootstrapPhase: IRRuntimeBootstrapPhase = "idle";
	private bootstrapPromise: Promise<void> | null = null;
	private lastBootstrapAt = 0;

	constructor(
		private readonly app: App,
		private readonly calendarDebounceMs = DEFAULT_CALENDAR_RECONCILE_DEBOUNCE_MS,
	) {}

	getBootstrapPhase(): IRRuntimeBootstrapPhase {
		return this.bootstrapPhase;
	}

	isBootstrapReady(): boolean {
		return (
			this.bootstrapPhase === "ready" || this.bootstrapPhase === "degraded"
		);
	}

	markBootstrapStale(): void {
		if (this.bootstrapPhase === "ready") {
			this.bootstrapPhase = "degraded";
		}
		getSharedIRProjectionRuntime(this.app).markStale();
	}

	scheduleCalendarReconcile(
		options: IRBackgroundReconcileOptions & { reason?: string },
		immediate = false,
	): void {
		void getSharedIRProjectionRuntime(this.app)
			.shouldSkipBackgroundReconcile(options)
			.then((skip) => {
				if (skip) {
					logger.debug(
						"[IRRefreshScheduler] skipped calendar-reconcile (fresh projection)",
						{
							reason: options.reason,
						},
					);
					return;
				}
				this.mergePendingCalendarReconcile({
					kind: "calendar-reconcile",
					deckIds: options.deckIds,
					priorityDateKeys: options.priorityDateKeys,
					forceRecompute: options.forceRecompute,
					reason: options.reason,
				});
				if (immediate) {
					void this.flushCalendarReconcile();
					return;
				}
				this.scheduleCalendarDebounce();
			})
			.catch((error) => {
				logger.warn(
					"[IRRefreshScheduler] failed to evaluate reconcile skip:",
					error,
				);
			});
	}

	scheduleVaultRebuild(
		options: IRBackgroundReconcileOptions & { reason?: string },
	): void {
		this.cancelPendingCalendarReconcile();
		getSharedIRProjectionRuntime(this.app).markStale();
		this.mergePendingCalendarReconcile({
			kind: "rebuild-vault",
			deckIds: options.deckIds,
			priorityDateKeys: options.priorityDateKeys,
			forceRecompute: true,
			reason: options.reason || "vault-rebuild",
		});
		void this.flushCalendarReconcile();
	}

	scheduleBootstrap(): Promise<void> {
		if (this.bootstrapPromise) {
			return this.bootstrapPromise;
		}
		if (this.isBootstrapReady()) {
			return Promise.resolve();
		}

		this.bootstrapPromise = new Promise<void>((resolve) => {
			const run = (): void => {
				void (async () => {
					const coordinator = getSharedIRCalendarBackgroundLoadCoordinator(
						this.app,
					);
					const hostCriticalWorkGuard = getSharedIRHostCriticalWorkGuard(
						this.app,
					);
					if (
						coordinator.isHeavyLoadActive() ||
						hostCriticalWorkGuard.shouldDeferVaultBackgroundWork()
					) {
						window.setTimeout(run, BOOTSTRAP_DEFER_RETRY_MS);
						return;
					}

					this.bootstrapPhase = "bootstrapping";
					const startedAt = Date.now();
					const runtime = getSharedIRProjectionRuntime(this.app);
					try {
						await runtime.preloadColdStartCaches();
						const todayKey = getLocalTodayDateKey();
						const projectionFresh = await runtime.shouldSkipBackgroundReconcile(
							{
								priorityDateKeys: [todayKey],
							},
						);
						if (projectionFresh) {
							this.bootstrapPhase = "ready";
							this.lastBootstrapAt = Date.now();
							logger.info(
								"[IRRefreshScheduler] bootstrap ready from cold projection cache",
								{
									durationMs: Date.now() - startedAt,
									skipReconcile: true,
								},
							);
							return;
						}

						logger.info(
							"[IRRefreshScheduler] cold projection not fresh; checking day-index shell",
							{
								durationMs: Date.now() - startedAt,
								skipReconcile: false,
							},
						);

						const calendarQuery = getSharedIRCalendarQueryService(this.app);
						const dayShell = await calendarQuery.tryGetCalendarShellFromDayIndex({
							priorityDateKeys: [todayKey],
						});
						if (dayShell) {
							// 日索引壳可用：首屏可立即交互；完整 lean 交给后台 reconcile，不占 heavy-load。
							this.bootstrapPhase = "ready";
							this.lastBootstrapAt = Date.now();
							logger.info(
								"[IRRefreshScheduler] bootstrap ready from day-index shell (lean deferred)",
								{
									durationMs: Date.now() - startedAt,
									dateCount: dayShell.result.materialsByDate.size,
								},
							);
							this.scheduleCalendarReconcile({
								priorityDateKeys: [todayKey],
								reason: "bootstrap-shell-deferred",
							});
							return;
						}

						await coordinator.runHeavyLoad("warmup", async () => {
							const tagGroupService = new IRTagGroupService(this.app);
							await tagGroupService.initialize();

							// 优先 peek warm，避免 bootstrap 强制 getScheduleSources → 全量重建。
							const warmSources = await getSharedIRScheduleIndexService(this.app)
								.peekWarmScheduleSources()
								.catch(() => null);
							if (!warmSources) {
								await getSharedIRScheduleIndexService(this.app)
									.getScheduleSources()
									.catch(() => undefined);
							}

							await calendarQuery.tryGetTier0CalendarResult({
								priorityDateKeys: [todayKey],
							});

							const leanResult = await awaitWithTimeout(
								calendarQuery.getCalendarQueryResult({
									reason: "ui_refresh",
									includeReadingMaterials: false,
									preferDiskCache: true,
									priorityDateKeys: [todayKey],
								}),
								BOOTSTRAP_LEAN_QUERY_TIMEOUT_MS,
								"bootstrap lean calendar query",
							);

							const kernel = getSharedIRScheduleKernel(this.app);
							if (
								!leanResult &&
								!kernel.getCachedSchedule({ leanSchedule: true })
							) {
								await kernel.recomputeScheduleForDeck("ui_refresh", {
									leanSchedule: true,
								});
							}

							if (!leanResult) {
								this.bootstrapPhase = "degraded";
								logger.warn(
									"[IRRefreshScheduler] bootstrap finished in degraded mode",
									{
										durationMs: Date.now() - startedAt,
									},
								);
								return;
							}

							this.bootstrapPhase = "ready";
							this.lastBootstrapAt = Date.now();
							const scheduleFingerprint = String(
								(await getSharedIRScheduleIndexService(
									this.app,
								).peekScheduleFingerprint()) || "",
							).trim();
							runtime.markBackgroundReconcileComplete(
								{ priorityDateKeys: [todayKey] },
								scheduleFingerprint || undefined,
							);
							logger.info("[IRRefreshScheduler] bootstrap ready", {
								durationMs: Date.now() - startedAt,
								scheduleDates: leanResult.materialsByDate.size,
							});
						});
					} catch (error) {
						this.bootstrapPhase = "degraded";
						logger.warn("[IRRefreshScheduler] bootstrap failed", error);
					} finally {
						if (this.bootstrapPhase === "bootstrapping") {
							this.bootstrapPhase = "degraded";
						}
						this.bootstrapPromise = null;
						resolve();
					}
				})();
			};

			if (
				typeof window !== "undefined" &&
				typeof window.requestIdleCallback === "function"
			) {
				window.requestIdleCallback(() => run(), {
					timeout: BOOTSTRAP_IDLE_TIMEOUT_MS,
				});
				return;
			}
			window.setTimeout(run, BOOTSTRAP_FALLBACK_DELAY_MS);
		});

		return this.bootstrapPromise;
	}

	getLastBootstrapAt(): number {
		return this.lastBootstrapAt;
	}

	cancelPendingCalendarReconcile(): void {
		if (this.calendarDebounceTimer) {
			window.clearTimeout(this.calendarDebounceTimer);
			this.calendarDebounceTimer = null;
		}
		this.pendingCalendarReconcile = null;
	}

	private mergePendingCalendarReconcile(unit: IRRefreshWorkUnit): void {
		if (!this.pendingCalendarReconcile) {
			this.pendingCalendarReconcile = {
				kind: unit.kind,
				deckIds: unit.deckIds,
				priorityDateKeys: [...unit.priorityDateKeys],
				forceRecompute: unit.forceRecompute,
				reason: unit.reason,
			};
			return;
		}

		const mergedDateKeys = new Set(
			this.pendingCalendarReconcile.priorityDateKeys,
		);
		for (const dateKey of unit.priorityDateKeys) {
			mergedDateKeys.add(dateKey);
		}
		this.pendingCalendarReconcile = {
			kind: unit.forceRecompute
				? "rebuild-vault"
				: this.pendingCalendarReconcile.kind,
			deckIds: unit.deckIds ?? this.pendingCalendarReconcile.deckIds,
			priorityDateKeys: Array.from(mergedDateKeys),
			forceRecompute:
				unit.forceRecompute || this.pendingCalendarReconcile.forceRecompute,
			reason: unit.reason ?? this.pendingCalendarReconcile.reason,
		};
	}

	private scheduleCalendarDebounce(): void {
		if (this.calendarDebounceTimer) {
			window.clearTimeout(this.calendarDebounceTimer);
		}
		this.calendarDebounceTimer = window.setTimeout(() => {
			this.calendarDebounceTimer = null;
			void this.flushCalendarReconcile();
		}, this.calendarDebounceMs);
	}

	private async flushCalendarReconcile(): Promise<void> {
		if (this.inflightReconcile) {
			await this.inflightReconcile;
		}
		const unit = this.pendingCalendarReconcile;
		if (!unit) {
			return;
		}
		this.pendingCalendarReconcile = null;

		const hostCriticalWorkGuard = getSharedIRHostCriticalWorkGuard(this.app);
		if (hostCriticalWorkGuard.shouldDeferVaultBackgroundWork()) {
			this.pendingCalendarReconcile = unit;
			window.setTimeout(() => {
				void this.flushCalendarReconcile();
			}, BOOTSTRAP_DEFER_RETRY_MS);
			return;
		}

		const runtime = getSharedIRProjectionRuntime(this.app);
		if (unit.kind === "calendar-reconcile") {
			const skip = await runtime.shouldSkipBackgroundReconcile({
				deckIds: unit.deckIds,
				forceRecompute: unit.forceRecompute,
				priorityDateKeys: unit.priorityDateKeys,
			});
			if (skip) {
				return;
			}
		}

		const run = (async () => {
			const coordinator = getSharedIRCalendarBackgroundLoadCoordinator(
				this.app,
			);
			const includeMaterials = unit.kind === "rebuild-vault";
			let reconciledMaterialsByDate: Map<string, ScheduleItem[]> | undefined;
			// L1 刚写入的全日队列不得被 committed-due 子集 / 空切片 force-replace。
			const replaceableDateKeys = runtime.filterOutL1FreshDateKeys(
				unit.priorityDateKeys,
			);
			await coordinator.runHeavyLoad("sidebar-reconcile", async () => {
				const queryService = getSharedIRCalendarQueryService(this.app);
				const queryResult = await queryService.getCalendarQueryResult({
					deckIds: unit.deckIds,
					forceRecompute: unit.forceRecompute === true,
					reason: "ui_refresh",
					includeReadingMaterials: includeMaterials,
					preferDiskCache: unit.forceRecompute !== true,
					priorityDateKeys: unit.priorityDateKeys,
				});
				reconciledMaterialsByDate = new Map();
				for (const dateKey of replaceableDateKeys) {
					const items = queryResult.materialsByDate.get(dateKey);
					// 查询未给出该日切片时不要写入 []，否则会冲掉侧栏已有队列。
					if (!items) {
						continue;
					}
					reconciledMaterialsByDate.set(dateKey, items);
				}
			});
			const scheduleFingerprint = String(
				(await getSharedIRScheduleIndexService(
					this.app,
				).peekScheduleFingerprint()) || "",
			).trim();
			runtime.markBackgroundReconcileComplete(
				{
					deckIds: unit.deckIds,
					forceRecompute: unit.forceRecompute,
					priorityDateKeys: unit.priorityDateKeys,
				},
				scheduleFingerprint || undefined,
			);
			// 无可安全推送的切片时不要 notify：避免无 materials 的 hydrate 覆盖 L1/已有队列。
			if (
				replaceableDateKeys.length === 0 ||
				!reconciledMaterialsByDate ||
				reconciledMaterialsByDate.size === 0
			) {
				return;
			}
			runtime.notify({
				priorityDateKeys: replaceableDateKeys,
				deckIds: unit.deckIds,
				reason: unit.reason || unit.kind,
				reconciledMaterialsByDate,
			});
		})();

		this.inflightReconcile = run;
		try {
			await run;
		} catch (error) {
			logger.warn("[IRRefreshScheduler] refresh work failed:", error);
			runtime.notify({
				priorityDateKeys: unit.priorityDateKeys,
				deckIds: unit.deckIds,
				reason: unit.reason || unit.kind,
				reconcileFailed: true,
			});
		} finally {
			if (this.inflightReconcile === run) {
				this.inflightReconcile = null;
			}
		}
	}
}

const schedulerByApp = new WeakMap<App, IRRefreshScheduler>();

export function getSharedIRRefreshScheduler(app: App): IRRefreshScheduler {
	let scheduler = schedulerByApp.get(app);
	if (!scheduler) {
		scheduler = new IRRefreshScheduler(app);
		schedulerByApp.set(app, scheduler);
	}
	return scheduler;
}
