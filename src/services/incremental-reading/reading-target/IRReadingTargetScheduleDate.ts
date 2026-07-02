import type { App } from "obsidian";
import type { IRReadingTargetSchedulePin } from "./IRReadingTargetTypes";
import {
	getProjectedDayLoad,
	getProjectedScheduleSummary,
	type IRProjectedDayLoad,
} from "../IRProjectedScheduleSummary";

export type ReadingTargetDayLoadLevel = "normal" | "warning" | "overloaded";

export type ReadingTargetScheduleMode = "custom" | "auto";

export interface ReadingTargetScheduleRecommendation {
	date: Date;
	dateKey: string;
	itemCount: number;
	existingEstimatedMinutes: number;
	projectedMinutes: number;
	dailyBudgetMinutes: number;
	level: ReadingTargetDayLoadLevel;
	loadRatioPercent: number;
	daysFromStart: number;
	summary: string;
}

export interface ReadingTargetDayLoadAssessment {
	dateKey: string;
	itemCount: number;
	totalEstimatedMinutes: number;
	dailyBudgetMinutes: number;
	level: ReadingTargetDayLoadLevel;
}

export function normalizeScheduleDate(date: Date): Date {
	const normalized = new Date(date);
	normalized.setHours(0, 0, 0, 0);
	return normalized;
}

export function formatLocalDateKey(date: Date): string {
	const normalized = normalizeScheduleDate(date);
	return `${normalized.getFullYear()}-${String(normalized.getMonth() + 1).padStart(2, "0")}-${String(
		normalized.getDate()
	).padStart(2, "0")}`;
}

export function parseLocalDateKey(dateKey: string): Date | null {
	const match = String(dateKey || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) {
		return null;
	}
	const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}
	return normalizeScheduleDate(parsed);
}

export function addScheduleDays(date: Date, days: number): Date {
	const normalized = normalizeScheduleDate(date);
	const next = new Date(normalized);
	next.setDate(next.getDate() + days);
	return normalizeScheduleDate(next);
}

export function getScheduleToday(): Date {
	return normalizeScheduleDate(new Date());
}

export function getScheduleTomorrow(from = new Date()): Date {
	return addScheduleDays(from, 1);
}

/** 「下周一」：若今天是周一则取下一个周一（+7 天）。 */
export function getNextMonday(from = new Date()): Date {
	const normalized = normalizeScheduleDate(from);
	const weekday = normalized.getDay();
	const daysUntilNextMonday = weekday === 0 ? 1 : weekday === 1 ? 7 : 8 - weekday;
	return addScheduleDays(normalized, daysUntilNextMonday);
}

export function toDateInputValue(date: Date): string {
	return formatLocalDateKey(date);
}

export function resolveReadingTargetSchedulePin(scheduleDate: Date): IRReadingTargetSchedulePin {
	const pinned = normalizeScheduleDate(scheduleDate);
	return {
		nextRepDate: pinned.getTime(),
		dateKey: formatLocalDateKey(pinned),
	};
}

export function computeReadingTargetDayLoadLevel(
	totalEstimatedMinutes: number,
	dailyBudgetMinutes: number
): ReadingTargetDayLoadLevel {
	const budget = Math.max(1, Number(dailyBudgetMinutes) || 40);
	const minutes = Math.max(0, Number(totalEstimatedMinutes) || 0);
	if (minutes >= Math.max(60, budget)) {
		return "overloaded";
	}
	if (minutes >= Math.max(40, budget * 0.8)) {
		return "warning";
	}
	return "normal";
}

export function assessReadingTargetDayLoad(
	dateKey: string,
	load: IRProjectedDayLoad | undefined,
	dailyBudgetMinutes: number
): ReadingTargetDayLoadAssessment {
	const totalEstimatedMinutes = Math.max(0, Number(load?.totalEstimatedMinutes || 0));
	const itemCount = load?.items?.length ?? 0;
	const level = computeReadingTargetDayLoadLevel(totalEstimatedMinutes, dailyBudgetMinutes);
	return {
		dateKey,
		itemCount,
		totalEstimatedMinutes,
		dailyBudgetMinutes,
		level,
	};
}

export async function loadReadingTargetDayLoadAssessment(
	app: App,
	date: Date,
	deckId: string,
	dailyBudgetMinutes: number
): Promise<ReadingTargetDayLoadAssessment> {
	const dateKey = formatLocalDateKey(date);
	const summary = await getProjectedScheduleSummary(app, {
		deckIds: [deckId],
		horizonDays: 21,
		reason: "ui_refresh",
	});
	const load = getProjectedDayLoad(summary, dateKey, [deckId]);
	return assessReadingTargetDayLoad(dateKey, load, dailyBudgetMinutes);
}

function scoreScheduleCandidate(
	offset: number,
	projectedMinutes: number,
	level: ReadingTargetDayLoadLevel,
	dailyBudgetMinutes: number
): number {
	const budget = Math.max(1, dailyBudgetMinutes);
	const levelPenalty = level === "overloaded" ? 1000 : level === "warning" ? 100 : 0;
	return levelPenalty + (projectedMinutes / budget) * 10 + offset * 0.05;
}

function buildScheduleRecommendationSummary(
	offset: number,
	level: ReadingTargetDayLoadLevel,
	loadRatioPercent: number,
	projectedMinutes: number,
	dailyBudgetMinutes: number
): string {
	if (offset === 0 && level === "normal") {
		return `今天负载适中，加入后约 ${loadRatioPercent}% 日预算（${projectedMinutes}/${dailyBudgetMinutes} 分钟），适合排入今天。`;
	}
	if (level === "normal") {
		return `未来 ${offset} 天内负载最轻的一天，加入后约 ${loadRatioPercent}% 日预算。`;
	}
	if (level === "warning") {
		return `近期日程较满，推荐相对较轻的一天；加入后约 ${loadRatioPercent}% 日预算。`;
	}
	return `近期负载偏高，已选择未来 ${offset} 天内相对最轻的一天；加入后约 ${loadRatioPercent}% 日预算。`;
}

/**
 * 根据 projected 负载与日预算，在时间窗内推荐首次阅读日（智能排期模式）。
 */
export async function recommendReadingTargetScheduleDate(
	app: App,
	deckId: string,
	dailyBudgetMinutes: number,
	options?: {
		startDate?: Date;
		horizonDays?: number;
		estimatedMinutesForNewItem?: number;
	}
): Promise<ReadingTargetScheduleRecommendation> {
	const budget = Math.max(1, Number(dailyBudgetMinutes) || 40);
	const start = normalizeScheduleDate(options?.startDate ?? getScheduleToday());
	const horizonDays = Math.max(1, options?.horizonDays ?? 21);
	const newItemMinutes = Math.max(1, Number(options?.estimatedMinutesForNewItem) || 5);

	const summary = await getProjectedScheduleSummary(app, {
		deckIds: [deckId],
		horizonDays,
		reason: "ui_refresh",
	});

	let best:
		| {
				date: Date;
				offset: number;
				existingMinutes: number;
				projectedMinutes: number;
				itemCount: number;
				level: ReadingTargetDayLoadLevel;
				score: number;
		  }
		| undefined;

	for (let offset = 0; offset < horizonDays; offset += 1) {
		const candidate = addScheduleDays(start, offset);
		const dateKey = formatLocalDateKey(candidate);
		const load = getProjectedDayLoad(summary, dateKey, [deckId]);
		const existingMinutes = Math.max(0, Number(load.totalEstimatedMinutes || 0));
		const projectedMinutes = existingMinutes + newItemMinutes;
		const level = computeReadingTargetDayLoadLevel(projectedMinutes, budget);
		const score = scoreScheduleCandidate(offset, projectedMinutes, level, budget);

		if (!best || score < best.score) {
			best = {
				date: candidate,
				offset,
				existingMinutes,
				projectedMinutes,
				itemCount: load.items.length,
				level,
				score,
			};
		}
	}

	const pick = best ?? {
		date: start,
		offset: 0,
		existingMinutes: 0,
		projectedMinutes: newItemMinutes,
		itemCount: 0,
		level: computeReadingTargetDayLoadLevel(newItemMinutes, budget),
		score: 0,
	};

	const loadRatioPercent = Math.min(
		999,
		Math.round((pick.projectedMinutes / budget) * 100)
	);

	return {
		date: pick.date,
		dateKey: formatLocalDateKey(pick.date),
		itemCount: pick.itemCount,
		existingEstimatedMinutes: pick.existingMinutes,
		projectedMinutes: pick.projectedMinutes,
		dailyBudgetMinutes: budget,
		level: pick.level,
		loadRatioPercent,
		daysFromStart: pick.offset,
		summary: buildScheduleRecommendationSummary(
			pick.offset,
			pick.level,
			loadRatioPercent,
			pick.projectedMinutes,
			budget
		),
	};
}
