import type {
	IRPlannedSchedule,
	IRPlannedScheduleItem,
} from "./IRScheduleKernel";

/** 从 dateKey（YYYY-MM-DD）提取月份键 YYYY-MM */
export function toCalendarMonthKey(dateKey: string): string {
	const normalized = String(dateKey || "").trim();
	if (normalized.length >= 7) {
		return normalized.slice(0, 7);
	}
	return normalized;
}

export function normalizeDateKeys(
	dateKeys: Array<string | null | undefined>,
): string[] {
	return Array.from(
		new Set(dateKeys.map((key) => String(key || "").trim()).filter(Boolean)),
	).sort();
}

export function mergePriorityDateKeys(
	primary: Array<string | null | undefined> | undefined,
	secondary: Array<string | null | undefined> | undefined,
): string[] {
	return normalizeDateKeys([...(primary || []), ...(secondary || [])]);
}

export function dateKeyFromRepTimestamp(
	nextRepDate: number | undefined | null,
): string | null {
	const timestamp = Number(nextRepDate);
	if (!Number.isFinite(timestamp) || timestamp <= 0) {
		return null;
	}
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) {
		return null;
	}
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/**
 * 从计划表条目推断受影响的日历日期（含旧日期与新日期）。
 */
export function deriveAffectedDateKeysFromPlannedItems(
	items: Array<Pick<IRPlannedScheduleItem, "id" | "nextRepDate">>,
	options?: {
		previousDateKeys?: string[];
		anchorDateKey?: string;
	},
): string[] {
	const keys = new Set<string>();
	const anchor = String(options?.anchorDateKey || "").trim();
	if (anchor) {
		keys.add(anchor);
	}
	for (const previousKey of options?.previousDateKeys || []) {
		const normalized = String(previousKey || "").trim();
		if (normalized) {
			keys.add(normalized);
		}
	}
	for (const item of items) {
		const dateKey = dateKeyFromRepTimestamp(item.nextRepDate);
		if (dateKey) {
			keys.add(dateKey);
		}
	}
	return Array.from(keys).sort();
}

export function derivePriorityDateKeysFromSchedule(
	schedule:
		| IRPlannedSchedule
		| { days?: Array<{ dateKey?: string; items?: unknown[] }> },
	options?: { anchorDateKey?: string; limit?: number },
): string[] {
	const keys = new Set<string>();
	const anchor = String(options?.anchorDateKey || "").trim();
	if (anchor) {
		keys.add(anchor);
	}
	for (const day of schedule.days || []) {
		const dateKey = String(day?.dateKey || "").trim();
		if (!dateKey) {
			continue;
		}
		if (Array.isArray(day.items) && day.items.length > 0) {
			keys.add(dateKey);
		}
	}
	const limit = Math.max(1, Math.min(31, Math.floor(options?.limit ?? 14)));
	return Array.from(keys).sort().slice(0, limit);
}

export function buildMonthSummariesFromDayCounts(
	daySummaries: Record<string, { totalCount: number }>,
): Record<string, Record<string, number>> {
	const monthSummaries: Record<string, Record<string, number>> = {};
	for (const [dateKey, summary] of Object.entries(daySummaries)) {
		const normalizedDateKey = String(dateKey || "").trim();
		if (!normalizedDateKey) {
			continue;
		}
		const monthKey = toCalendarMonthKey(normalizedDateKey);
		if (!monthSummaries[monthKey]) {
			monthSummaries[monthKey] = {};
		}
		monthSummaries[monthKey][normalizedDateKey] = Math.max(
			0,
			Number(summary?.totalCount || 0),
		);
	}
	return monthSummaries;
}
