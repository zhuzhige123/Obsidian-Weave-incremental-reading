export function parseCalendarDateKey(dateKey: string): Date | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || "").trim());
	if (!match) {
		return null;
	}
	const year = Number(match[1]);
	const month = Number(match[2]) - 1;
	const day = Number(match[3]);
	const date = new Date(year, month, day);
	if (
		date.getFullYear() !== year ||
		date.getMonth() !== month ||
		date.getDate() !== day
	) {
		return null;
	}
	date.setHours(0, 0, 0, 0);
	return date;
}

export function startOfCalendarDay(date: Date): Date {
	const next = new Date(date);
	next.setHours(0, 0, 0, 0);
	return next;
}

export function isPastCalendarDate(date: Date, today: Date): boolean {
	return (
		startOfCalendarDay(date).getTime() < startOfCalendarDay(today).getTime()
	);
}

export function isPastCalendarDateKey(dateKey: string, today: Date): boolean {
	const parsed = parseCalendarDateKey(dateKey);
	if (!parsed) {
		return false;
	}
	return isPastCalendarDate(parsed, today);
}

export function dateKeyBelongsToMonth(
	dateKey: string,
	monthKey: string,
): boolean {
	const normalizedMonth = String(monthKey || "").trim();
	if (!normalizedMonth) {
		return true;
	}
	return String(dateKey || "")
		.trim()
		.startsWith(`${normalizedMonth}-`);
}

export function buildPastDateCompletionCounts(
	byDate: Record<string, string[]>,
	options: { monthKey?: string; today: Date },
): Map<string, number> {
	const counts = new Map<string, number>();
	const todayStart = startOfCalendarDay(options.today).getTime();

	for (const [dateKey, ids] of Object.entries(byDate || {})) {
		if (options.monthKey && !dateKeyBelongsToMonth(dateKey, options.monthKey)) {
			continue;
		}
		const parsed = parseCalendarDateKey(dateKey);
		if (!parsed || parsed.getTime() >= todayStart) {
			continue;
		}
		const uniqueIds = Array.from(
			new Set((ids || []).map((id) => String(id || "").trim()).filter(Boolean)),
		);
		if (uniqueIds.length > 0) {
			counts.set(dateKey, uniqueIds.length);
		}
	}

	return counts;
}

export function buildHistoryDaySummaries(
	byDate: Record<string, string[]>,
	options: { monthKey?: string; today: Date },
): Map<string, { totalCount: number; completedCount: number }> {
	const summaries = new Map<
		string,
		{ totalCount: number; completedCount: number }
	>();
	for (const [dateKey, count] of buildPastDateCompletionCounts(
		byDate,
		options,
	).entries()) {
		summaries.set(dateKey, { totalCount: count, completedCount: count });
	}
	return summaries;
}
