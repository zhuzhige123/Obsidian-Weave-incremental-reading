import type { ScheduleItem } from "../../../services/incremental-reading/IRCalendarScheduleItem";
import type { PreviewDetails } from "../ir-schedule-impact-preview-types";

export const IRCALENDAR_SCHEDULING_MENU_ACTIONS = [
	"intensive",
	"normal",
	"slow",
	"postpone",
] as const;

export type IRCalendarSchedulingAction =
	typeof IRCALENDAR_SCHEDULING_MENU_ACTIONS[number];

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
