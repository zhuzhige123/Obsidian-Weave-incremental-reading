import type { ScheduleItem } from "../../../services/incremental-reading/IRCalendarScheduleItem";
import type { PreviewDetails } from "../ir-schedule-impact-preview-types";

export const IRCALENDAR_SCHEDULING_MENU_ACTIONS = [
	"intensive",
	"normal",
	"postpone",
	"slow",
] as const;

export type IRCalendarSchedulingAction =
	typeof IRCALENDAR_SCHEDULING_MENU_ACTIONS[number];

/**
 * 调度菜单展示顺序：非「稍后」项按下次复习日由近到远，「稍后」紧跟「正常」。
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

	const withoutPostpone = actions.filter((action) => action !== "postpone");
	const sorted = [...withoutPostpone].sort(compareDue);
	const normalIndex = sorted.indexOf("normal");
	if (normalIndex < 0) {
		return [...sorted, "postpone"];
	}
	return [
		...sorted.slice(0, normalIndex + 1),
		"postpone",
		...sorted.slice(normalIndex + 1),
	];
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
