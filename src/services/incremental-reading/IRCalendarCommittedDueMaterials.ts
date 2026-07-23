import { shouldExcludeScheduleItemBySource } from "../../utils/ir-internal-data-path";
import {
	buildScheduleItemFromProjectedItem,
	type ScheduleItem,
} from "./IRCalendarScheduleItem";
import { formatDueDateKeyFromTimestamp } from "./IRDueDateIndexService";
import type {
	IRProjectedScheduleItem,
	IRProjectedScheduleSummary,
} from "./IRProjectedScheduleSummary";
import { assembleScheduleItemsForDailyQueue } from "./IRScheduleItemSort";

function getLocalTodayDateKey(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function isInactiveCalendarStatus(status?: string): boolean {
	const normalized = String(status || "")
		.trim()
		.toLowerCase();
	return (
		normalized === "done" ||
		normalized === "suspended" ||
		normalized === "archived" ||
		normalized === "removed"
	);
}

/**
 * 承诺 due / 手动钉日 / 序列锚点（不滚入今天）。
 * 禁止使用 PlanGenerator 改写后的 nextRepDate（内存平滑槽）。
 */
export function resolveCommittedCalendarDateKey(
	item: Pick<
		IRProjectedScheduleItem,
		| "manualSchedulePinnedDateKey"
		| "sourceSequenceLocked"
		| "sourceSequenceAnchorDateKey"
		| "committedNextRepDate"
		| "nextRepDate"
	>,
): string | null {
	const pinned = String(item.manualSchedulePinnedDateKey || "").trim();
	if (pinned) {
		return pinned;
	}
	if (item.sourceSequenceLocked) {
		const anchor = String(item.sourceSequenceAnchorDateKey || "").trim();
		if (anchor) {
			return anchor;
		}
	}
	const committedTs = Number(item.committedNextRepDate || 0);
	if (committedTs > 0) {
		return formatDueDateKeyFromTimestamp(committedTs);
	}
	return formatDueDateKeyFromTimestamp(Number(item.nextRepDate || 0));
}

/**
 * 月历展示日：开放且逾期的项滚入今天（与旧 plan 槽 / legacy 行为对齐）。
 */
export function resolveCalendarDisplayDateKey(
	item: Pick<
		IRProjectedScheduleItem,
		| "manualSchedulePinnedDateKey"
		| "sourceSequenceLocked"
		| "sourceSequenceAnchorDateKey"
		| "committedNextRepDate"
		| "nextRepDate"
		| "scheduleStatus"
	>,
	todayKey: string = getLocalTodayDateKey(),
): string | null {
	const committedKey = resolveCommittedCalendarDateKey(item);
	if (!committedKey) {
		return null;
	}
	if (
		committedKey < todayKey &&
		!isInactiveCalendarStatus(item.scheduleStatus)
	) {
		return todayKey;
	}
	return committedKey;
}

export type CalendarDateMembershipItem = Pick<
	IRProjectedScheduleItem,
	| "manualSchedulePinnedDateKey"
	| "sourceSequenceLocked"
	| "sourceSequenceAnchorDateKey"
	| "committedNextRepDate"
	| "nextRepDate"
	| "scheduleStatus"
> & { id?: string };

/**
 * 判断阅读点是否应出现在某月历日的材料列表中。
 * - 开放逾期项只属于今天（滚入后）
 * - 当日 calendar-progress 已完成 id 可保留在历史日（沉底回看）
 */
export function scheduleItemBelongsOnCalendarDate(
	item: CalendarDateMembershipItem,
	dateKey: string,
	todayKey: string = getLocalTodayDateKey(),
	completedIdSet?: Set<string>,
): boolean {
	const normalizedDateKey = String(dateKey || "").trim();
	if (!normalizedDateKey) {
		return false;
	}
	const id = String(item.id || "").trim();
	if (id && completedIdSet?.has(id)) {
		return true;
	}
	return resolveCalendarDisplayDateKey(item, todayKey) === normalizedDateKey;
}

/**
 * 过滤出属于目标月历日的材料；用于 past-day due 补洞，避免开放逾期挂回过去日。
 */
export function filterScheduleItemsForCalendarDate<
	T extends CalendarDateMembershipItem,
>(
	items: T[],
	dateKey: string,
	todayKey: string = getLocalTodayDateKey(),
	completedIdSet?: Set<string>,
): T[] {
	return items.filter((item) =>
		scheduleItemBelongsOnCalendarDate(
			item,
			dateKey,
			todayKey,
			completedIdSet,
		),
	);
}

function collectUniqueProjectedItems(
	summary: IRProjectedScheduleSummary,
): IRProjectedScheduleItem[] {
	const byId = new Map<string, IRProjectedScheduleItem>();
	for (const day of summary.schedule.days || []) {
		for (const item of day.items || []) {
			const id = String(item.id || "").trim();
			if (id) {
				byId.set(id, item);
			}
		}
	}
	for (const load of summary.dayLoadsByDate.values()) {
		for (const item of load.items || []) {
			const id = String(item.id || "").trim();
			if (id && !byId.has(id)) {
				byId.set(id, item);
			}
		}
	}
	return Array.from(byId.values());
}

function toCommittedScheduleItem(item: IRProjectedScheduleItem): ScheduleItem {
	const committedTs = Number(
		item.committedNextRepDate || item.nextRepDate || 0,
	);
	return buildScheduleItemFromProjectedItem({
		...item,
		nextRepDate: committedTs,
		nextReviewDate: committedTs > 0 ? new Date(committedTs) : null,
	});
}

/**
 * 从投影计划装配月历 materialsByDate：按承诺 due 分桶（逾期开放项滚入今天）。
 * 负载分析仍可用 plan dayLoads；仅日历材料列表走本路径。
 * 若传入 `ghostPointIds`，会收集应排除并自动清理的 `.irdeck` 幽灵阅读点 id。
 */
export function buildCalendarMaterialsByCommittedDue(
	summary: IRProjectedScheduleSummary,
	options?: { todayKey?: string; ghostPointIds?: string[] },
): Map<string, ScheduleItem[]> {
	const todayKey = String(options?.todayKey || "").trim() || getLocalTodayDateKey();
	const materialsByDate = new Map<string, ScheduleItem[]>();
	const ghostPointIds = options?.ghostPointIds;

	for (const item of collectUniqueProjectedItems(summary)) {
		const dateKey = resolveCalendarDisplayDateKey(item, todayKey);
		if (!dateKey) {
			continue;
		}
		const scheduleItem = toCommittedScheduleItem(item);
		if (shouldExcludeScheduleItemBySource(scheduleItem)) {
			const id = String(scheduleItem.id || item.id || "").trim();
			if (id && ghostPointIds) {
				ghostPointIds.push(id);
			}
			continue;
		}
		const list = materialsByDate.get(dateKey) || [];
		list.push(scheduleItem);
		materialsByDate.set(dateKey, list);
	}

	for (const [dateKey, items] of materialsByDate.entries()) {
		materialsByDate.set(
			dateKey,
			assembleScheduleItemsForDailyQueue(items, dateKey),
		);
	}

	return materialsByDate;
}
