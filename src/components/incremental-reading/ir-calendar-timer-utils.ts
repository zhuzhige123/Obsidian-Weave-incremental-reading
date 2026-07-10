import type { IRCalendarActiveReadingTimerState } from "../../stores/ir-calendar-timer-store";

export function formatTimerDuration(totalSeconds: number): string {
	const safeSeconds = Math.max(0, Math.floor(totalSeconds));
	const hours = Math.floor(safeSeconds / 3600);
	const minutes = Math.floor((safeSeconds % 3600) / 60);
	const seconds = safeSeconds % 60;
	if (hours > 0) {
		return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
			2,
			"0",
		)}:${String(seconds).padStart(2, "0")}`;
	}
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
		2,
		"0",
	)}`;
}

export function formatCompactTimerDuration(
	totalSeconds: number,
	labels: { hoursShort: string; minutesShort: string },
): string {
	const safeSeconds = Math.max(0, Math.floor(totalSeconds));
	if (safeSeconds < 3600) {
		const minutes = Math.floor(safeSeconds / 60);
		const seconds = safeSeconds % 60;
		return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
			2,
			"0",
		)}`;
	}

	const hours = Math.floor(safeSeconds / 3600);
	const minutes = Math.floor((safeSeconds % 3600) / 60);
	return `${hours}${labels.hoursShort} ${String(minutes).padStart(2, "0")}${
		labels.minutesShort
	}`;
}

export function getDisplayedTimerSeconds(params: {
	blockId: string;
	activeReadingTimer: IRCalendarActiveReadingTimerState | null;
	timerNowMs: number;
	timerTotalsByBlockId: Record<string, number>;
}): number {
	const { blockId, activeReadingTimer, timerNowMs, timerTotalsByBlockId } =
		params;
	if (activeReadingTimer?.blockId === blockId) {
		return (
			activeReadingTimer.baseSeconds +
			Math.max(
				0,
				Math.floor((timerNowMs - activeReadingTimer.startedAtMs) / 1000),
			)
		);
	}
	return timerTotalsByBlockId[blockId] ?? 0;
}

export function getReadingTimerButtonTitle(params: {
	blockId: string;
	activeReadingTimer: IRCalendarActiveReadingTimerState | null;
	timerNowMs: number;
	timerTotalsByBlockId: Record<string, number>;
	labels: {
		pauseReadingTimer: string;
		resumeTimer: (duration: string) => string;
		startTimer: string;
	};
}): string {
	const seconds = getDisplayedTimerSeconds(params);
	const timerText = formatTimerDuration(seconds);
	const isRunning = params.activeReadingTimer?.blockId === params.blockId;

	if (isRunning) {
		return `${params.labels.pauseReadingTimer} (${timerText})`;
	}
	if (seconds > 0) {
		return params.labels.resumeTimer(timerText);
	}
	return params.labels.startTimer;
}
