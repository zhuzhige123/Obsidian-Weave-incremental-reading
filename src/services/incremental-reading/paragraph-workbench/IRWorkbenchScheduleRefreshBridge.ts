import type { App } from "obsidian";
import type { ScheduleRecomputeReason } from "../IRScheduleKernel";
import { getSharedIRProjectionRuntime } from "../IRProjectionRuntime";
import { getSharedIRRefreshScheduler } from "../IRRefreshScheduler";
import { mergePriorityDateKeys } from "../IRCalendarProjectionUtils";
import {
	getLocalTodayDateKey,
	recomputeAndBroadcastIRData,
} from "../IRScheduleRefreshService";

export type IRWorkbenchScheduleRefreshOptions = {
	deckIds?: string[];
	/** 改期目标日等额外优先日期（会与今日合并去重） */
	extraPriorityDateKeys?: string[];
};

/**
 * 段落工作台（WIP）调度突变后的统一刷新入口。
 * 产品 UI/流程尚未完成；此处仅挂接 Projection Runtime 边界，避免无 scope 的全库 invalidation。
 */
export async function refreshIRAfterWorkbenchScheduleMutation(
	app: App,
	reason: ScheduleRecomputeReason,
	options?: IRWorkbenchScheduleRefreshOptions
): Promise<void> {
	const deckIds = options?.deckIds?.map((id) => String(id || "").trim()).filter(Boolean);
	const priorityDateKeys = mergePriorityDateKeys(options?.extraPriorityDateKeys, [getLocalTodayDateKey()]);

	await recomputeAndBroadcastIRData(app, reason, {
		deckIds,
		priorityDateKeys,
	});

	getSharedIRRefreshScheduler(app).scheduleCalendarReconcile({
		deckIds,
		priorityDateKeys,
		forceRecompute: false,
		reason: `workbench-${reason}`,
	});
}

export function dateToLocalDateKey(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/**
 * 工作台（WIP）订阅投影 patch：月历/后台 reconcile 完成后刷新队列计数。
 * 不迁移 `resolveTopicQueueProgress` 读路径；仅在外部调度变更时同步 UI 数字。
 */
export function subscribeIRWorkbenchProjectionRefresh(
	app: App,
	onRefresh: () => void,
	getTopicId?: () => string | undefined
): () => void {
	return getSharedIRProjectionRuntime(app).subscribe((patch) => {
		if (patch.reconcileFailed) {
			return;
		}

		const topicId = String(getTopicId?.() || "").trim();
		if (topicId && patch.deckIds?.length) {
			const deckIds = patch.deckIds.map((id) => String(id || "").trim()).filter(Boolean);
			if (deckIds.length > 0 && !deckIds.includes(topicId)) {
				return;
			}
		}

		onRefresh();
	});
}
