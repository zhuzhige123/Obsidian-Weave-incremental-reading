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

export interface IRCalendarMonthDay {
	date: Date;
	otherMonth: boolean;
}

export function getMondayFirstWeekdayIndex(date: Date): number {
	return (date.getDay() + 6) % 7;
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

export function formatCalendarDateKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
		2,
		"0",
	)}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseCalendarDateKey(dateKey: string): Date | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || "").trim());
	if (!match) return null;
	return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function isSameCalendarDay(left: Date, right: Date): boolean {
	return (
		left.getFullYear() === right.getFullYear() &&
		left.getMonth() === right.getMonth() &&
		left.getDate() === right.getDate()
	);
}
