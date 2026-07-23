import {
	resolveCalendarDisplayDateKey,
	resolveCommittedCalendarDateKey,
} from "./IRCalendarCommittedDueMaterials";
import { formatDueDateKeyFromTimestamp } from "./IRDueDateIndexService";

/**
 * 信息窗调度字段：与月历「承诺 due → 列表日」分桶对齐，
 * 区分「列表出现日」与「首次排期 / 完成后下次复习」。
 */
export interface IRBlockInfoScheduleFields {
	nextRepDate?: number | null;
	scheduleStatus?: string | null;
	reviewCount?: number | null;
	lastReview?: string | null;
	manualSchedulePinnedDateKey?: string | null;
	sourceSequenceLocked?: boolean | null;
	sourceSequenceAnchorDateKey?: string | null;
	committedNextRepDate?: number | null;
}

export interface IRBlockInfoScheduleDisplay {
	/** 月历列表实际出现的日期（逾期开放项会滚入今天） */
	listAppearDateKey: string | null;
	/** 承诺分桶日（pin / 序列锚点 / committed / nextRep） */
	committedDateKey: string | null;
	/** 钉日或序列锚点（若存在且与磁盘 due 日不同，供信息窗单独展示） */
	scheduleAnchorDateKey: string | null;
	/** 是否因逾期从承诺日滚入今天 */
	rolledIntoToday: boolean;
	/**
	 * 滚入提示所用日期：优先磁盘逾期 due（用户语义上的「下次复习」），
	 * 避免钉日/序列锚点被误标成「承诺日」。
	 */
	rolledFromDateKey: string | null;
	/** 磁盘 nextRepDate（原始调度时间戳） */
	diskDueTimestamp: number | null;
	diskDueDateKey: string | null;
	/** 下次复习已相对今天逾期（仍可出现在今日列表） */
	nextReviewOverdue: boolean;
	/** 是否已至少完成过一次阅读（有复习次数或上次复习） */
	hasCompletedReview: boolean;
	/** 未完成：首次排期时间戳 */
	firstScheduleTimestamp: number | null;
	/** 已完成：下次复习时间戳（当前承诺 due 写入值） */
	nextReviewTimestamp: number | null;
	/** 未完成：下次复习尚未由完成动作计算 */
	nextReviewPending: boolean;
}

export function hasCompletedReadingPoint(
	input: Pick<IRBlockInfoScheduleFields, "reviewCount" | "lastReview">,
): boolean {
	const reviews = Number(input.reviewCount || 0);
	if (Number.isFinite(reviews) && reviews > 0) {
		return true;
	}
	return Boolean(String(input.lastReview || "").trim());
}

function getLocalTodayDateKey(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function resolveScheduleAnchorDateKey(
	input: IRBlockInfoScheduleFields,
): string | null {
	const pinned = String(input.manualSchedulePinnedDateKey || "").trim();
	if (pinned) {
		return pinned;
	}
	if (input.sourceSequenceLocked === true) {
		const anchor = String(input.sourceSequenceAnchorDateKey || "").trim();
		if (anchor) {
			return anchor;
		}
	}
	return null;
}

export function buildIRBlockInfoScheduleDisplay(
	input: IRBlockInfoScheduleFields,
	todayKey: string = getLocalTodayDateKey(),
): IRBlockInfoScheduleDisplay {
	const nextRepDate = Number(input.nextRepDate || 0);
	const explicitCommitted = Number(input.committedNextRepDate || 0);
	const committedTs =
		explicitCommitted > 0
			? explicitCommitted
			: nextRepDate > 0
				? nextRepDate
				: 0;

	const projected = {
		manualSchedulePinnedDateKey:
			String(input.manualSchedulePinnedDateKey || "").trim() || undefined,
		sourceSequenceLocked: input.sourceSequenceLocked === true,
		sourceSequenceAnchorDateKey:
			String(input.sourceSequenceAnchorDateKey || "").trim() || undefined,
		committedNextRepDate: committedTs > 0 ? committedTs : undefined,
		nextRepDate: nextRepDate > 0 ? nextRepDate : committedTs,
		scheduleStatus: String(input.scheduleStatus || "").trim(),
	};

	const committedDateKey = resolveCommittedCalendarDateKey(projected);
	const listAppearDateKey = resolveCalendarDisplayDateKey(
		projected,
		todayKey,
	);
	const rolledIntoToday = Boolean(
		committedDateKey &&
			listAppearDateKey &&
			committedDateKey !== listAppearDateKey,
	);

	const completed = hasCompletedReadingPoint(input);
	const diskDueTimestamp = nextRepDate > 0 ? nextRepDate : null;
	const diskDueDateKey = formatDueDateKeyFromTimestamp(nextRepDate);
	const scheduleAnchorDateKey = resolveScheduleAnchorDateKey(input);
	const showAnchorSeparately = Boolean(
		scheduleAnchorDateKey &&
			scheduleAnchorDateKey !== diskDueDateKey &&
			scheduleAnchorDateKey !== listAppearDateKey,
	);
	const nextReviewOverdue = Boolean(
		completed &&
			diskDueDateKey &&
			diskDueDateKey < todayKey &&
			!String(input.scheduleStatus || "")
				.trim()
				.toLowerCase()
				.match(/^(done|suspended|archived|removed)$/),
	);
	const rolledFromDateKey = rolledIntoToday
		? diskDueDateKey && diskDueDateKey < todayKey
			? diskDueDateKey
			: committedDateKey
		: null;

	return {
		listAppearDateKey,
		committedDateKey,
		scheduleAnchorDateKey: showAnchorSeparately ? scheduleAnchorDateKey : null,
		rolledIntoToday,
		rolledFromDateKey,
		diskDueTimestamp,
		diskDueDateKey,
		nextReviewOverdue,
		hasCompletedReview: completed,
		firstScheduleTimestamp: !completed && diskDueTimestamp ? diskDueTimestamp : null,
		nextReviewTimestamp: completed && diskDueTimestamp ? diskDueTimestamp : null,
		nextReviewPending: !completed,
	};
}
