import type { ScheduleItem } from "./IRCalendarScheduleItem";
import type { IRPlannedScheduleItem } from "./IRScheduleKernel";
import { IRCognitiveProfileService } from "./IRCognitiveProfileService";

const profileService = new IRCognitiveProfileService();

export type IRScheduleSortableItem = Pick<
	ScheduleItem | IRPlannedScheduleItem,
	| "id"
	| "priority"
	| "nextRepDate"
	| "explanation"
	| "sourceSequenceGroup"
	| "sourceSequenceOrder"
	| "sourceSequenceLocked"
	| "sourceSequenceAnchorDateKey"
	| "manualSchedulePinnedDateKey"
>;

export function getScheduleItemManualPriority(item: IRScheduleSortableItem): number {
	const manualPriority = item.explanation?.manualPriority;
	if (typeof manualPriority === "number" && Number.isFinite(manualPriority)) {
		return manualPriority;
	}
	return Number(item.priority || 0);
}

export function getScheduleItemEffectivePriority(item: IRScheduleSortableItem): number {
	const explanationPriority = item.explanation?.effectivePriority;
	if (typeof explanationPriority === "number" && Number.isFinite(explanationPriority)) {
		return explanationPriority;
	}
	return getScheduleItemManualPriority(item);
}

export function getScheduleItemOverdueDays(item: IRScheduleSortableItem): number {
	const explanationOverdue = item.explanation?.overdueDays;
	if (typeof explanationOverdue === "number" && Number.isFinite(explanationOverdue)) {
		return Math.max(0, explanationOverdue);
	}
	return 0;
}

export function isScheduleItemInitialSequenceLockedForDay(
	item: IRScheduleSortableItem,
	dayKey: string
): boolean {
	return Boolean(
		item.sourceSequenceLocked &&
			item.sourceSequenceGroup &&
			typeof item.sourceSequenceOrder === "number" &&
			item.sourceSequenceAnchorDateKey &&
			item.sourceSequenceAnchorDateKey === dayKey
	);
}

export function compareScheduleItemsSourceSequenceWithinDay(
	left: IRScheduleSortableItem,
	right: IRScheduleSortableItem,
	dayKey: string
): number {
	if (
		!isScheduleItemInitialSequenceLockedForDay(left, dayKey) ||
		!isScheduleItemInitialSequenceLockedForDay(right, dayKey)
	) {
		return 0;
	}
	if (left.sourceSequenceGroup !== right.sourceSequenceGroup) {
		return 0;
	}
	return Number(left.sourceSequenceOrder || 0) - Number(right.sourceSequenceOrder || 0);
}

/**
 * 日历侧栏 / 当日阅读队列的展示排序。
 *
 * 对齐 SuperMemo 优先级队列：手动优先级决定当天阅读顺序；
 * 同优先级时才用导入顺序、综合分等作 tie-break。
 */
export function compareScheduleItemsForDailyQueue(
	left: IRScheduleSortableItem,
	right: IRScheduleSortableItem,
	dayKey?: string
): number {
	const manualPriorityDiff =
		getScheduleItemManualPriority(right) - getScheduleItemManualPriority(left);
	if (manualPriorityDiff !== 0) {
		return manualPriorityDiff;
	}

	const effectivePriorityDiff =
		getScheduleItemEffectivePriority(right) - getScheduleItemEffectivePriority(left);
	if (effectivePriorityDiff !== 0) {
		return effectivePriorityDiff;
	}

	const overdueDiff = getScheduleItemOverdueDays(right) - getScheduleItemOverdueDays(left);
	if (overdueDiff !== 0) {
		return overdueDiff;
	}

	if (dayKey) {
		const sequenceCompare = compareScheduleItemsSourceSequenceWithinDay(left, right, dayKey);
		if (sequenceCompare !== 0) {
			return sequenceCompare;
		}
	}

	const scoreDiff =
		(right.explanation?.compositeScore ?? 0) - (left.explanation?.compositeScore ?? 0);
	if (scoreDiff !== 0) {
		return scoreDiff;
	}

	const nextRepDateDiff = (left.nextRepDate || 0) - (right.nextRepDate || 0);
	if (nextRepDateDiff !== 0) {
		return nextRepDateDiff;
	}

	return String(left.id || "").localeCompare(String(right.id || ""), "zh-CN");
}

export function patchScheduleItemPriorityFields(
	item: IRScheduleSortableItem,
	itemId: string,
	priorityUi: number,
	priorityEff: number
): IRScheduleSortableItem {
	if (item.id !== itemId) {
		return item;
	}

	const scheduleItem = item as ScheduleItem;
	const explanation = item.explanation
		? (() => {
				const profile = profileService.computeProfile({
					scheduleStatus: scheduleItem.scheduleStatus || "new",
					nextRepDate: item.nextRepDate,
					manualPriority: priorityUi,
					effectivePriority: priorityEff,
					intervalDays: scheduleItem.intervalDays,
					estimatedMinutes: item.explanation.estimatedMinutes,
					nowMs: Date.now(),
				});
				return {
					...item.explanation,
					manualPriority: priorityUi,
					effectivePriority: priorityEff,
					scoreBreakdown: profile,
					compositeScore: profile.compositeScore,
				};
		  })()
		: undefined;

	return {
		...item,
		priority: priorityUi,
		explanation,
	};
}

export function sortScheduleItemsForDailyQueue<T extends IRScheduleSortableItem>(
	items: T[],
	dayKey: string
): T[] {
	return [...items].sort((left, right) => compareScheduleItemsForDailyQueue(left, right, dayKey));
}

/**
 * 组装当日阅读队列：未完成项按调度优先级排在前面，已完成项按完成顺序排在末尾。
 */
export function assembleScheduleItemsForDailyQueue<T extends IRScheduleSortableItem & { id: string }>(
	items: T[],
	dayKey: string,
	options: {
		completedIds?: Iterable<string>;
		/** 已完成项在列表末尾的显示顺序（通常为 calendar-progress 中的完成顺序）。 */
		completedIdOrder?: string[];
	} = {}
): T[] {
	const completedSet = new Set(
		Array.from(options.completedIds ?? [])
			.map((id) => String(id || "").trim())
			.filter(Boolean)
	);
	if (completedSet.size === 0) {
		return sortScheduleItemsForDailyQueue(items, dayKey);
	}

	const byId = new Map<string, T>();
	for (const item of items) {
		const normalizedId = String(item.id || "").trim();
		if (!normalizedId) {
			continue;
		}
		byId.set(normalizedId, item);
	}

	const pending = sortScheduleItemsForDailyQueue(
		Array.from(byId.values()).filter((item) => !completedSet.has(item.id)),
		dayKey
	);

	const completedOrderSource =
		options.completedIdOrder && options.completedIdOrder.length > 0
			? options.completedIdOrder
			: Array.from(completedSet);

	const completed: T[] = [];
	const seenCompleted = new Set<string>();
	for (const id of completedOrderSource) {
		const normalizedId = String(id || "").trim();
		if (!normalizedId || seenCompleted.has(normalizedId) || !completedSet.has(normalizedId)) {
			continue;
		}
		const item = byId.get(normalizedId);
		if (!item) {
			continue;
		}
		seenCompleted.add(normalizedId);
		completed.push(item);
	}

	for (const item of byId.values()) {
		if (completedSet.has(item.id) && !seenCompleted.has(item.id)) {
			completed.push(item);
		}
	}

	return [...pending, ...completed];
}

export function patchScheduleItemsInMapByDate<T extends IRScheduleSortableItem>(
	materialsByDate: Map<string, T[]>,
	itemId: string,
	priorityUi: number,
	priorityEff: number,
	limitToDateKeys?: string[]
): Map<string, T[]> {
	const allowedDateKeys =
		limitToDateKeys && limitToDateKeys.length > 0
			? new Set(limitToDateKeys.map((key) => String(key || "").trim()).filter(Boolean))
			: null;

	return new Map(
		Array.from(materialsByDate.entries(), ([dateKey, items]) => {
			if (allowedDateKeys && !allowedDateKeys.has(dateKey)) {
				return [dateKey, items];
			}

			const patched = items.map((item) =>
				patchScheduleItemPriorityFields(item, itemId, priorityUi, priorityEff)
			) as T[];
			return [dateKey, sortScheduleItemsForDailyQueue(patched, dateKey)];
		})
	);
}

export function collectScheduleItemDateKeys(
	itemId: string,
	materialsByDate: Map<string, IRScheduleSortableItem[]>,
	pinnedByDate: Map<string, IRScheduleSortableItem[]> = new Map()
): string[] {
	const dateKeys = new Set<string>();
	for (const [dateKey, items] of materialsByDate.entries()) {
		if (items.some((item) => item.id === itemId)) {
			dateKeys.add(dateKey);
		}
	}
	for (const [dateKey, items] of pinnedByDate.entries()) {
		if (items.some((item) => item.id === itemId)) {
			dateKeys.add(dateKey);
		}
	}
	return Array.from(dateKeys);
}
