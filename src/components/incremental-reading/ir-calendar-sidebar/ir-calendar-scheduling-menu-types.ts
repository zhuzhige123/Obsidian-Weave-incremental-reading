import type { ScheduleItem } from "../../../services/incremental-reading/IRCalendarScheduleItem";
import type { PreviewDetails } from "../ir-schedule-impact-preview-types";

export const IRCALENDAR_SCHEDULING_ARRANGE_ACTIONS = [
	"intensive",
	"normal",
	"slow",
] as const;

export const IRCALENDAR_SCHEDULING_MENU_ACTIONS = [
	...IRCALENDAR_SCHEDULING_ARRANGE_ACTIONS,
	"postpone",
] as const;

export type IRCalendarSchedulingAction =
	typeof IRCALENDAR_SCHEDULING_MENU_ACTIONS[number];

export type IRCalendarSchedulingArrangeAction =
	typeof IRCALENDAR_SCHEDULING_ARRANGE_ACTIONS[number];

/**
 * 安排档位按下次复习日由近到远排序；推迟始终单独分区置底。
 */
export function sortSchedulingMenuActionsByDueDate(
	actions: readonly IRCalendarSchedulingAction[],
	nextRepDateByAction: Partial<Record<IRCalendarSchedulingAction, number>>,
): IRCalendarSchedulingAction[] {
	const compareDue = (
		a: IRCalendarSchedulingAction,
		b: IRCalendarSchedulingAction,
	): number => {
		const dateA = nextRepDateByAction[a] ?? Number.MAX_SAFE_INTEGER;
		const dateB = nextRepDateByAction[b] ?? Number.MAX_SAFE_INTEGER;
		return dateA - dateB;
	};

	const arrange = actions.filter(
		(action): action is IRCalendarSchedulingArrangeAction =>
			action !== "postpone",
	);
	const sortedArrange = [...arrange].sort(compareDue);
	const includePostpone = actions.includes("postpone");
	return includePostpone ? [...sortedArrange, "postpone"] : sortedArrange;
}

export type IRCalendarSchedulingMenuPreviewState =
	| "idle"
	| "loading"
	| "ready"
	| "error";

export interface IRCalendarSchedulingMenuConfigItem {
	action: IRCalendarSchedulingAction;
	label: string;
	color: string;
	intervalMultiplier: number;
	isPostpone: boolean;
	disabled?: boolean;
	metaText?: string;
}

export interface IRCalendarSchedulingMenuContext {
	target: ScheduleItem;
	pinnedKey: string;
}

export type IRCalendarSchedulingPreviewByAction = Record<
	IRCalendarSchedulingAction,
	PreviewDetails | null
>;

export type IRCalendarSchedulingDateByAction = Record<
	IRCalendarSchedulingAction,
	string
>;
