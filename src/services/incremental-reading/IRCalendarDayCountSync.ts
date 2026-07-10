import type { ScheduleItem } from "./IRCalendarScheduleItem";

/**
 * 从已加载的当日队列材料构建热力图计数（与列表同一投影源）。
 */
export function buildVisibleDayCountsByDate(
	materialsByDate: Map<string, ScheduleItem[]>,
	pinnedByDate: Map<string, ScheduleItem[]>,
	shouldIncludeItem: (item: ScheduleItem) => boolean,
): Map<string, number> {
	const counts = new Map<string, number>();
	const dateKeys = new Set<string>([
		...materialsByDate.keys(),
		...pinnedByDate.keys(),
	]);

	for (const dateKey of dateKeys) {
		const ids = new Set<string>();
		for (const item of materialsByDate.get(dateKey) || []) {
			if (shouldIncludeItem(item)) {
				ids.add(item.id);
			}
		}
		for (const item of pinnedByDate.get(dateKey) || []) {
			if (shouldIncludeItem(item)) {
				ids.add(item.id);
			}
		}
		counts.set(dateKey, ids.size);
	}

	return counts;
}

export function mergeCalendarDayCountMaps(
	base: Map<string, number>,
	updates: Map<string, number>,
): Map<string, number> {
	const merged = new Map(base);
	for (const [dateKey, count] of updates.entries()) {
		merged.set(dateKey, Math.max(0, Number(count) || 0));
	}
	return merged;
}

export function mergeCalendarDaySummariesFromCounts(
	daySummaries: Map<string, { totalCount: number }>,
	counts: Map<string, number>,
): Map<string, { totalCount: number }> {
	const merged = new Map(daySummaries);
	for (const [dateKey, count] of counts.entries()) {
		merged.set(dateKey, { totalCount: Math.max(0, Number(count) || 0) });
	}
	return merged;
}
