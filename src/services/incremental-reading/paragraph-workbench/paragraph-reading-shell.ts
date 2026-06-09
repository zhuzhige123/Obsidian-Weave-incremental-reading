import type {
	IRParagraphWorkbenchDisplaySettings,
	IRParagraphWorkbenchSurfaceStyle,
	IRParagraphWorkbenchTransitionStyle,
} from "../../../types/plugin-settings.d";
import type { ParagraphWorkbenchDisplay } from "./types";

export const PARAGRAPH_WORKBENCH_FONT_SCALE_MIN = 85;
export const PARAGRAPH_WORKBENCH_FONT_SCALE_MAX = 135;
export const PARAGRAPH_WORKBENCH_FONT_SCALE_DEFAULT = 100;

export const DEFAULT_PARAGRAPH_WORKBENCH_DISPLAY_SETTINGS: Required<IRParagraphWorkbenchDisplaySettings> =
	{
		fontScale: PARAGRAPH_WORKBENCH_FONT_SCALE_DEFAULT,
		surfaceStyle: "spotlight",
		transitionStyle: "settle",
	};

export function clampParagraphWorkbenchFontScale(value: unknown): number {
	const numeric = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(numeric)) {
		return PARAGRAPH_WORKBENCH_FONT_SCALE_DEFAULT;
	}
	return Math.max(
		PARAGRAPH_WORKBENCH_FONT_SCALE_MIN,
		Math.min(PARAGRAPH_WORKBENCH_FONT_SCALE_MAX, Math.round(numeric))
	);
}

export function normalizeParagraphWorkbenchSurfaceStyle(
	value: unknown,
	fallback: IRParagraphWorkbenchSurfaceStyle = DEFAULT_PARAGRAPH_WORKBENCH_DISPLAY_SETTINGS.surfaceStyle
): IRParagraphWorkbenchSurfaceStyle {
	return value === "blend" || value === "dashed" || value === "spotlight" ? value : fallback;
}

export function normalizeParagraphWorkbenchTransitionStyle(
	value: unknown,
	fallback: IRParagraphWorkbenchTransitionStyle = DEFAULT_PARAGRAPH_WORKBENCH_DISPLAY_SETTINGS.transitionStyle
): IRParagraphWorkbenchTransitionStyle {
	return value === "steady" || value === "fade" || value === "settle" || value === "slide"
		? value
		: fallback;
}

export function resolveParagraphWorkbenchDisplaySettings(
	settings?: IRParagraphWorkbenchDisplaySettings | null
): Required<IRParagraphWorkbenchDisplaySettings> {
	return {
		fontScale: clampParagraphWorkbenchFontScale(settings?.fontScale),
		surfaceStyle: normalizeParagraphWorkbenchSurfaceStyle(settings?.surfaceStyle),
		transitionStyle: normalizeParagraphWorkbenchTransitionStyle(settings?.transitionStyle),
	};
}

export const PARAGRAPH_SCHEDULE_INTERVAL_DAYS = [1, 3, 7, 14] as const;
export type ParagraphScheduleIntervalDays = (typeof PARAGRAPH_SCHEDULE_INTERVAL_DAYS)[number];

export const PARAGRAPH_PRIORITY_UI_MIN = 0;
export const PARAGRAPH_PRIORITY_UI_MAX = 10;
export const PARAGRAPH_PRIORITY_UI_DEFAULT = 5;

export function clampParagraphPriorityUi(value: unknown, fallback = PARAGRAPH_PRIORITY_UI_DEFAULT): number {
	const numeric = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(numeric)) {
		return fallback;
	}
	return Math.max(
		PARAGRAPH_PRIORITY_UI_MIN,
		Math.min(PARAGRAPH_PRIORITY_UI_MAX, Math.round(numeric * 2) / 2)
	);
}

export function buildParagraphWorkbenchDisplay(input: {
	bookPercent: number;
	segmentIndex: number;
	segmentTotal: number;
	remainingMs?: number;
	topicName?: string;
	queueDone?: number;
	queueTotal?: number;
}): ParagraphWorkbenchDisplay {
	const segmentTotal = Math.max(1, input.segmentTotal);
	const segmentIndex = Math.max(0, Math.min(input.segmentIndex, segmentTotal - 1));
	const bookPercent = Math.max(0, Math.min(100, Math.round(input.bookPercent)));
	const remainingMs =
		typeof input.remainingMs === "number" && Number.isFinite(input.remainingMs)
			? Math.max(0, input.remainingMs)
			: undefined;
	const estimatedBookMinutes =
		remainingMs !== undefined ? Math.max(1, Math.round(remainingMs / 60_000)) : undefined;
	const remainingSegments = Math.max(0, segmentTotal - segmentIndex - 1);
	const estimatedBlockMinutes =
		estimatedBookMinutes !== undefined && segmentTotal > 0
			? Math.max(1, Math.round((estimatedBookMinutes * remainingSegments) / segmentTotal))
			: undefined;

	return {
		bookPercent,
		segmentIndex: segmentIndex + 1,
		segmentTotal,
		estimatedBookMinutes,
		estimatedBlockMinutes,
		topicName: String(input.topicName || "").trim() || undefined,
		queueDone:
			typeof input.queueDone === "number" && Number.isFinite(input.queueDone)
				? Math.max(0, Math.round(input.queueDone))
				: undefined,
		queueTotal:
			typeof input.queueTotal === "number" && Number.isFinite(input.queueTotal)
				? Math.max(0, Math.round(input.queueTotal))
				: undefined,
		postponeMinutes: estimatedBlockMinutes ?? estimatedBookMinutes,
	};
}

export function resolveParagraphPostponeMinutes(
	display: ParagraphWorkbenchDisplay | null | undefined
): number | undefined {
	if (!display) {
		return undefined;
	}
	const minutes = display.postponeMinutes ?? display.estimatedBlockMinutes ?? display.estimatedBookMinutes;
	if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) {
		return undefined;
	}
	return Math.max(1, Math.round(minutes));
}

export function normalizeParagraphScheduleIntervalDays(
	value: unknown,
	fallback: ParagraphScheduleIntervalDays = 7
): ParagraphScheduleIntervalDays {
	const numeric = typeof value === "number" ? value : Number(value);
	if (numeric === 1 || numeric === 3 || numeric === 7 || numeric === 14) {
		return numeric;
	}
	return fallback;
}

