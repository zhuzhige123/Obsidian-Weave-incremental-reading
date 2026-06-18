import type { App } from "obsidian";
import { logger } from "../../utils/logger";
import { getSharedIRCalendarDayIndexService } from "./IRCalendarDayIndexService";
import { getSharedIRDueDateIndexService } from "./IRDueDateIndexService";
import { derivePriorityDateKeysFromSchedule, mergePriorityDateKeys } from "./IRCalendarProjectionUtils";
import { getSharedIRCalendarQueryService } from "./IRCalendarQueryService";
import { buildScheduleItemFromProjectedItem } from "./IRCalendarScheduleItem";
import type { ScheduleItem } from "./IRCalendarScheduleItem";
import { buildScheduleFingerprintFromWorkspace } from "./IRScheduleFingerprint";
import { getSharedIRScheduleIndexService } from "./IRScheduleIndexService";
import { getSharedIRWorkspaceSnapshotService } from "./IRWorkspaceSnapshotService";
import { getSharedIRProjectionRuntime } from "./IRProjectionRuntime";
import {
	getSharedIRScheduleKernel,
	IRScheduleKernel,
	type IRPlannedSchedule,
	type RecomputeOptions,
	type ScheduleRecomputeReason,
} from "./IRScheduleKernel";

export const IR_DATA_UPDATED_EVENT = "Weave:ir-data-updated";

export type UpdatedEventDetail = {
	reason: ScheduleRecomputeReason;
	generatedAt: number;
	deckIds?: string[];
	/** 仅合并这些日期的月历列表，避免整页重载。 */
	priorityDateKeys?: string[];
};

export type IRDataInvalidationScope = "none" | "projection" | "calendar" | "full";

export type BroadcastIRDataUpdatedOptions = {
	reason?: ScheduleRecomputeReason;
	generatedAt?: number;
	deckIds?: string[];
	priorityDateKeys?: string[];
	invalidateScheduleCache?: boolean;
	/**
	 * - full：工作区 + 索引 + 查询 + 内核（默认，无 priorityDateKeys 时）
	 * - calendar：仅失效月历查询/投影切片，保留工作区快照
	 * - projection：只广播事件，由调用方已 patch 投影
	 * - none：只广播事件
	 */
	invalidationScope?: IRDataInvalidationScope;
};

const kernelByApp = new WeakMap<App, IRScheduleKernel>();

function getKernel(app: App): IRScheduleKernel {
	let kernel = kernelByApp.get(app);
	if (!kernel) {
		kernel = getSharedIRScheduleKernel(app);
		kernelByApp.set(app, kernel);
	}
	return kernel;
}

function resolveInvalidationScope(
	options?: BroadcastIRDataUpdatedOptions
): IRDataInvalidationScope {
	if (options?.invalidationScope) {
		return options.invalidationScope;
	}
	if (options?.priorityDateKeys && options.priorityDateKeys.length > 0) {
		return "calendar";
	}
	return "projection";
}

function dispatchIRDataUpdatedEvent(detail: UpdatedEventDetail): UpdatedEventDetail {
	window.dispatchEvent(
		new CustomEvent<UpdatedEventDetail>(IR_DATA_UPDATED_EVENT, {
			detail,
		})
	);
	return detail;
}

export function broadcastIRDataUpdated(
	app: App,
	options?: BroadcastIRDataUpdatedOptions
): UpdatedEventDetail {
	const scope = resolveInvalidationScope(options);
	const priorityDateKeys = mergePriorityDateKeys(options?.priorityDateKeys, []);

	if (scope === "full") {
		getSharedIRWorkspaceSnapshotService(app).invalidate();
		getSharedIRScheduleIndexService(app).invalidate();
		getSharedIRCalendarQueryService(app).invalidate();
		if (options?.invalidateScheduleCache !== false) {
			getKernel(app).invalidateScheduleCache();
		}
	} else if (scope === "calendar") {
		getSharedIRCalendarQueryService(app).invalidate({
			priorityDateKeys,
		});
		if (options?.invalidateScheduleCache !== false) {
			getKernel(app).invalidateScheduleCache();
		}
	}

	const detail = dispatchIRDataUpdatedEvent({
		reason: options?.reason ?? "ui_refresh",
		generatedAt: options?.generatedAt ?? Date.now(),
		deckIds: options?.deckIds,
		priorityDateKeys: priorityDateKeys.length > 0 ? priorityDateKeys : options?.priorityDateKeys,
	});
	if (scope === "calendar" && priorityDateKeys.length > 0) {
		notifyProjectionPatch(app, {
			priorityDateKeys,
			deckIds: options?.deckIds,
			reason: options?.reason,
		});
	}
	return detail;
}

export function getLocalTodayDateKey(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export { derivePriorityDateKeysFromSchedule, mergePriorityDateKeys };

/**
 * 将查询结果中的 priority 日期切片写入投影存储（合并 patch，不覆盖未触及日期）。
 */
export async function syncCalendarProjectionFromMaterialsByDate(
	app: App,
	input: {
		cacheKey: string;
		settingsFingerprint: string;
		scheduleFingerprint: string;
		materialsByDate: Map<string, ScheduleItem[]>;
		priorityDateKeys?: string[];
	}
): Promise<void> {
	await getSharedIRCalendarDayIndexService(app).syncFromMaterialsByDate(input);
}

export async function patchCalendarProjectionDaySlices(
	app: App,
	input: {
		cacheKey: string;
		settingsFingerprint: string;
		scheduleFingerprint: string;
		dayPatches: Map<string, ScheduleItem[]>;
	}
): Promise<void> {
	await getSharedIRCalendarDayIndexService(app).patchDaySlices(input);
}

export async function flushCalendarProjectionWrites(app: App): Promise<void> {
	await getSharedIRCalendarDayIndexService(app).flushPendingWrites();
}

/**
 * 仅更新优先级时使用：刷新工作区快照，但不重算计划日程。
 * 对齐 SuperMemo：改优先级只影响队列顺序，不改变 nextRepDate / 完成状态。
 */
export function broadcastPriorityChangeUpdate(
	app: App,
	options?: {
		deckIds?: string[];
		priorityDateKeys?: string[];
	}
): UpdatedEventDetail {
	getSharedIRWorkspaceSnapshotService(app).invalidate();
	return broadcastIRDataUpdated(app, {
		reason: "change_priority",
		deckIds: options?.deckIds,
		priorityDateKeys: mergePriorityDateKeys(options?.priorityDateKeys, [getLocalTodayDateKey()]),
		invalidateScheduleCache: false,
		invalidationScope: "none",
	});
}

/** 即使带 priorityDateKeys 也必须全库 invalidation 的重算原因。 */
const FULL_INVALIDATION_RECOMPUTE_REASONS = new Set<ScheduleRecomputeReason>([
	"import_materials",
	"settings_changed",
	"tag_group_changed",
	"metadata_renamed",
	"metadata_deleted",
	"ui_refresh",
]);

export function shouldUseDeckScopedScheduleRefresh(
	reason: ScheduleRecomputeReason,
	options?: Pick<RecomputeOptions, "deckIds" | "priorityDateKeys">
): boolean {
	if (!options?.deckIds?.length || !options?.priorityDateKeys?.length) {
		return false;
	}
	return !FULL_INVALIDATION_RECOMPUTE_REASONS.has(reason);
}

/** ir-data-updated 可由 runtime.notify 单独驱动的局部刷新（避免 Sidebar 双重重载）。 */
export function isProjectionPrimaryDataUpdate(detail?: UpdatedEventDetail): boolean {
	if (!detail?.priorityDateKeys?.length || !detail.deckIds?.length) {
		return false;
	}
	if (detail.reason === "change_priority") {
		return false;
	}
	return !FULL_INVALIDATION_RECOMPUTE_REASONS.has(detail.reason);
}

function notifyProjectionPatch(
	app: App,
	patch: {
		priorityDateKeys?: string[];
		deckIds?: string[];
		reason?: string;
	}
): void {
	getSharedIRProjectionRuntime(app).notify(patch);
}

export async function recomputeAndBroadcastIRData(
	app: App,
	reason: ScheduleRecomputeReason,
	options?: RecomputeOptions
): Promise<UpdatedEventDetail> {
	try {
		const scopedRefresh = shouldUseDeckScopedScheduleRefresh(reason, options);
		const priorityDateKeys =
			options?.priorityDateKeys && options.priorityDateKeys.length > 0
				? mergePriorityDateKeys(options.priorityDateKeys, [getLocalTodayDateKey()])
				: undefined;

		if (scopedRefresh) {
			getSharedIRCalendarQueryService(app).invalidate({
				priorityDateKeys,
			});
			getSharedIRScheduleIndexService(app).invalidate();
		} else {
			getSharedIRWorkspaceSnapshotService(app).invalidate();
			getSharedIRScheduleIndexService(app).invalidate();
			getSharedIRCalendarQueryService(app).invalidate();
			await getSharedIRDueDateIndexService(app).invalidateAsync();
		}

		const kernel = getKernel(app);
		kernel.invalidateScheduleCache();
		const schedule = await kernel.recomputeScheduleForDeck(reason, options);
		const resolvedPriorityDateKeys =
			priorityDateKeys ??
			derivePriorityDateKeysFromSchedule(schedule, {
				anchorDateKey: getLocalTodayDateKey(),
			});

		const l1PatchedSet = new Set(
			(options?.l1PatchedDateKeys || [])
				.map((key) => String(key || "").trim())
				.filter(Boolean)
		);
		const projectionDateKeys = resolvedPriorityDateKeys.filter((key) => !l1PatchedSet.has(key));

		if (projectionDateKeys.length > 0) {
			await syncCalendarProjectionFromPlannedSchedule(app, schedule, {
				deckIds: schedule.deckIds,
				priorityDateKeys: projectionDateKeys,
			});
		}

		if (scopedRefresh) {
			getSharedIRWorkspaceSnapshotService(app).invalidate();
		}

		const detail: UpdatedEventDetail = {
			reason,
			generatedAt: schedule.generatedAt,
			deckIds: schedule.deckIds,
			priorityDateKeys: resolvedPriorityDateKeys,
		};
		dispatchIRDataUpdatedEvent(detail);
		if (scopedRefresh) {
			notifyProjectionPatch(app, {
				priorityDateKeys: resolvedPriorityDateKeys,
				deckIds: schedule.deckIds,
				reason,
			});
		}
		return detail;
	} catch (error) {
		getSharedIRWorkspaceSnapshotService(app).invalidate();
		logger.error("[IRScheduleRefreshService] 重排并广播失败:", { reason, options, error });
		const detail: UpdatedEventDetail = {
			reason,
			generatedAt: Date.now(),
			deckIds: options?.deckIds,
			priorityDateKeys: mergePriorityDateKeys(options?.priorityDateKeys, [getLocalTodayDateKey()]),
		};
		return dispatchIRDataUpdatedEvent(detail);
	}
}

async function syncCalendarProjectionFromPlannedSchedule(
	app: App,
	schedule: IRPlannedSchedule,
	options: { deckIds: string[]; priorityDateKeys: string[] }
): Promise<void> {
	try {
		const queryService = getSharedIRCalendarQueryService(app);
		const settingsFingerprint = queryService.getSettingsFingerprint();
		const workspaceData = await getSharedIRWorkspaceSnapshotService(app).getWorkspaceData();
		const scheduleFingerprint = buildScheduleFingerprintFromWorkspace(workspaceData);
		const cacheKey = queryService.buildQueryCacheKeyForDeckIds(
			options.deckIds,
			undefined
		);
		const materialsByDate = new Map<string, ScheduleItem[]>();
		for (const dateKey of options.priorityDateKeys) {
			const normalizedDateKey = String(dateKey || "").trim();
			if (!normalizedDateKey) {
				continue;
			}
			const plannedItems = schedule.itemsByDate.get(normalizedDateKey) || [];
			materialsByDate.set(
				normalizedDateKey,
				plannedItems.map((item) => buildScheduleItemFromProjectedItem(item))
			);
		}
		if (materialsByDate.size === 0) {
			return;
		}
		await syncCalendarProjectionFromMaterialsByDate(app, {
			cacheKey,
			settingsFingerprint,
			scheduleFingerprint,
			materialsByDate,
			priorityDateKeys: options.priorityDateKeys,
		});
	} catch (error) {
		logger.debug("[IRScheduleRefreshService] Failed to sync calendar projection:", error);
	}
}
