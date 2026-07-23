export const IR_CALENDAR_WEEKDAY_KEYS = [
	"weekdayMon",
	"weekdayTue",
	"weekdayWed",
	"weekdayThu",
	"weekdayFri",
	"weekdaySat",
	"weekdaySun",
] as const;

export type IRCalendarWeekdayKey = typeof IR_CALENDAR_WEEKDAY_KEYS[number];

export type IRCalendarViewMode = "full" | "two-row" | "one-row";

export const IR_CALENDAR_VIEW_MODES: readonly IRCalendarViewMode[] = [
	"one-row",
	"two-row",
	"full",
] as const;

export interface IRCalendarMonthDay {
	date: Date;
	otherMonth: boolean;
}

export function getMondayFirstWeekdayIndex(date: Date): number {
	return (date.getDay() + 6) % 7;
}

export function resolveIRCalendarViewMode(
	mode: unknown,
	fallback: IRCalendarViewMode = "full",
): IRCalendarViewMode {
	if (mode === "full" || mode === "two-row" || mode === "one-row") {
		return mode;
	}
	return fallback;
}

export function buildMonthCalendarDays(
	year: number,
	month: number,
): IRCalendarMonthDay[] {
	const firstDay = new Date(year, month, 1);
	const lastDay = new Date(year, month + 1, 0);
	const days: IRCalendarMonthDay[] = [];

	const startDay = getMondayFirstWeekdayIndex(firstDay);
	for (let i = startDay - 1; i >= 0; i -= 1) {
		days.push({ date: new Date(year, month, -i), otherMonth: true });
	}

	for (let i = 1; i <= lastDay.getDate(); i += 1) {
		days.push({ date: new Date(year, month, i), otherMonth: false });
	}

	const remaining = 42 - days.length;
	for (let i = 1; i <= remaining; i += 1) {
		days.push({ date: new Date(year, month + 1, i), otherMonth: true });
	}

	return days;
}

/**
 * Resolve which days to render for the sidebar calendar modes.
 * - full: complete 6×7 month grid
 * - two-row: 14 days anchored around today / selected / month start
 * - one-row: same full month strip (laid out as a horizontal scroller in UI)
 */
export function getIRCalendarDisplayDays(params: {
	days: IRCalendarMonthDay[];
	viewMode: IRCalendarViewMode;
	currentDate: Date;
	today: Date;
	selectedDate: Date;
	isSameDay?: (left: Date, right: Date) => boolean;
}): IRCalendarMonthDay[] {
	const {
		days,
		viewMode,
		currentDate,
		today,
		selectedDate,
		isSameDay = isSameCalendarDay,
	} = params;

	if (viewMode !== "two-row") {
		return days;
	}

	const isCurrentDisplayedMonth =
		currentDate.getFullYear() === today.getFullYear() &&
		currentDate.getMonth() === today.getMonth();
	const isSelectedInDisplayedMonth =
		selectedDate.getFullYear() === currentDate.getFullYear() &&
		selectedDate.getMonth() === currentDate.getMonth();
	const anchorDate = isCurrentDisplayedMonth
		? today
		: isSelectedInDisplayedMonth
			? selectedDate
			: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
	const anchorIndex = days.findIndex(({ date }) => isSameDay(date, anchorDate));

	if (anchorIndex < 0) {
		return days.slice(0, 14);
	}

	const rowStart = Math.floor(anchorIndex / 7) * 7;
	const visibleDays = days.slice(rowStart, Math.min(rowStart + 14, days.length));

	if (visibleDays.length === 14) {
		return visibleDays;
	}

	const lastVisibleDate =
		visibleDays.length > 0
			? visibleDays[visibleDays.length - 1].date
			: anchorDate;
	const paddedDays = [...visibleDays];
	for (let offset = 1; paddedDays.length < 14; offset += 1) {
		paddedDays.push({
			date: new Date(
				lastVisibleDate.getFullYear(),
				lastVisibleDate.getMonth(),
				lastVisibleDate.getDate() + offset,
			),
			otherMonth: true,
		});
	}

	return paddedDays;
}

export function formatCalendarDateKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
		2,
		"0",
	)}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Convert a reading-point timestamp (ms / ISO / Date) to a local YYYY-MM-DD key.
 * Matches IR calendar day boundaries (not UTC `toISOString` days).
 */
export function toCalendarDateKey(value: unknown): string {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? "" : formatCalendarDateKey(value);
	}

	if (typeof value === "number" && Number.isFinite(value) && value > 0) {
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? "" : formatCalendarDateKey(date);
	}

	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) {
			return "";
		}
		// Bare YYYY-MM-DD keeps the written calendar day.
		if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
			return parseCalendarDateKey(trimmed) ? trimmed : "";
		}
		const parsed = Date.parse(trimmed);
		if (!Number.isFinite(parsed) || parsed <= 0) {
			return "";
		}
		return formatCalendarDateKey(new Date(parsed));
	}

	return "";
}

export function parseCalendarDateKey(dateKey: string): Date | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || "").trim());
	if (!match) return null;
	return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Shift a YYYY-MM-DD key by whole local calendar days. */
export function shiftCalendarDateKey(dateKey: string, dayOffset: number): string {
	const parsed = parseCalendarDateKey(dateKey);
	if (!parsed || !Number.isFinite(dayOffset)) {
		return "";
	}
	parsed.setDate(parsed.getDate() + dayOffset);
	return formatCalendarDateKey(parsed);
}

export function isSameCalendarDay(left: Date, right: Date): boolean {
	return (
		left.getFullYear() === right.getFullYear() &&
		left.getMonth() === right.getMonth() &&
		left.getDate() === right.getDate()
	);
}
