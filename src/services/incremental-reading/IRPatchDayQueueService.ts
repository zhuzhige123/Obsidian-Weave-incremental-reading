import type { App } from "obsidian";
import type { ScheduleItem } from "./IRCalendarScheduleItem";
import { getSharedIRCalendarQueryService } from "./IRCalendarQueryService";
import { formatDueDateKeyFromTimestamp } from "./IRDueDateIndexService";
import { assembleScheduleItemsForDailyQueue } from "./IRScheduleItemSort";
import { patchCalendarProjectionDaySlices } from "./IRScheduleRefreshService";
import { getSharedIRScheduleIndexService } from "./IRScheduleIndexService";

export interface PatchDayQueueInput {
	dateKey: string;
	items: ScheduleItem[];
	completedIds?: Iterable<string>;
	completedIdOrder?: string[];
	deckIds?: string[];
	/** 可选：避免 L1 再次拉全库 workspace 算指纹。 */
	scheduleFingerprint?: string;
}

/**
 * L1：当日队列 patch — 重排/沉底已完成项并写入月历投影，不经过 kernel 全量重算。
 * `items` 必须是当日完整队列（未完成 + 已完成），不可仅传 pinned/已完成切片。
 * due 倒排索引由 L0 mutator 唯一维护。
 */
export async function patchDayQueue(app: App, input: PatchDayQueueInput): Promise<void> {
	const dateKey = String(input.dateKey || "").trim();
	if (!dateKey || input.items.length === 0) {
		return;
	}

	const assembled = assembleScheduleItemsForDailyQueue(input.items, dateKey, {
		completedIds: input.completedIds,
		completedIdOrder: input.completedIdOrder,
	});

	const queryService = getSharedIRCalendarQueryService(app);
	const scheduleFingerprint =
		String(input.scheduleFingerprint || "").trim() ||
		(await getSharedIRScheduleIndexService(app).getScheduleSources()).scheduleFingerprint;
	const dayPatches = new Map<string, ScheduleItem[]>([[dateKey, assembled]]);

	await patchCalendarProjectionDaySlices(app, {
		cacheKey: queryService.buildQueryCacheKeyForDeckIds(input.deckIds, undefined),
		settingsFingerprint: queryService.getSettingsFingerprint(),
		scheduleFingerprint,
		dayPatches,
	});
	// L1 只写磁盘投影；侧栏已在乐观 UI 中更新。L2 debounced 重算会广播一次 complete_block。
}

export function collectDueDateKeysForScheduleMutation(
	previousNextRepDate: number | undefined,
	nextRepDate: number | undefined,
	pinnedDateKey: string
): string[] {
	const keys = new Set<string>([String(pinnedDateKey || "").trim()].filter(Boolean));
	const previousKey = formatDueDateKeyFromTimestamp(previousNextRepDate);
	const nextKey = formatDueDateKeyFromTimestamp(nextRepDate);
	if (previousKey) {
		keys.add(previousKey);
	}
	if (nextKey) {
		keys.add(nextKey);
	}
	return Array.from(keys);
}
