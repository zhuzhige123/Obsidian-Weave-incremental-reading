/**
 * 选中日补洞 / 列表 loading 门控（从 Sidebar 抽离，便于单测）。
 *
 * 契约：
 * - 阻塞式 loading 仅在「列表仍空且期望有材料」时出现，避免残缺列表被整页 spinner 冲掉。
 * - 选日 / $effect 只要未 satisfied，就应 kick hydrate（含热力 N、列表子集）。
 */

export interface SelectedDateHydrateKickInput {
	isPastDate: boolean;
	loadSatisfied: boolean;
}

/** 选日或 selectedDate 变化后，是否应主动 ensureSelectedDateMaterialsLoaded。 */
export function shouldKickSelectedDateHydrate(
	input: SelectedDateHydrateKickInput,
): boolean {
	return !input.isPastDate && !input.loadSatisfied;
}

export interface SelectedDateMaterialsPendingInput {
	isPastDate: boolean;
	hasActiveSearch: boolean;
	/** 选中日未过滤队列是否为空（不含「隐藏今日已完成」后的空）。 */
	materialsEmpty: boolean;
	loadSatisfied: boolean;
	reconcilePending: boolean;
	isColdStartBlocking: boolean;
	/** 热力或已加载计数：>0 表示用户有理由期待列表非空。 */
	expectedMaterialSignal: number;
}

/**
 * 阅读列表是否应用阻塞式「准备中」占位。
 * 列表已有子集时返回 false：后台补洞，不打断浏览。
 */
export function shouldShowSelectedDateMaterialsPending(
	input: SelectedDateMaterialsPendingInput,
): boolean {
	if (input.isPastDate || input.hasActiveSearch || input.loadSatisfied) {
		return false;
	}
	if (!input.materialsEmpty) {
		return false;
	}
	return (
		input.reconcilePending ||
		input.isColdStartBlocking ||
		input.expectedMaterialSignal > 0
	);
}

export interface ActiveDayReadingListEmptyKindInput {
	isPastDate: boolean;
	hasActiveSearch: boolean;
	isLoading: boolean;
	displayedCount: number;
	unfilteredCount: number;
	activeTagFilter: string;
	hideTodayCompleted: boolean;
	isToday: boolean;
}

export type ActiveDayReadingListEmptyKind =
	| "none"
	| "completed_hidden"
	| "day_empty";

/**
 * 活跃日（非历史 / 非搜索）空列表文案分支。
 * tag 过滤空由调用方在此之前处理。
 */
export function resolveActiveDayReadingListEmptyKind(
	input: ActiveDayReadingListEmptyKindInput,
): ActiveDayReadingListEmptyKind {
	if (
		input.isPastDate ||
		input.hasActiveSearch ||
		input.isLoading ||
		input.displayedCount > 0
	) {
		return "none";
	}
	if (input.activeTagFilter && input.unfilteredCount > 0) {
		return "none";
	}
	if (
		input.hideTodayCompleted &&
		input.isToday &&
		input.unfilteredCount > 0
	) {
		return "completed_hidden";
	}
	return "day_empty";
}
