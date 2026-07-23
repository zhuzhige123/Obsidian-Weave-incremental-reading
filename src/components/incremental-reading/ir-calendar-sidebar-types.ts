import type { ScheduleItem } from "../../services/incremental-reading/IRCalendarScheduleItem";
import type { IRDailyLoadOverloadLevel } from "../../services/incremental-reading/IRDailyLoadAllocator";

export type IRCalendarDataPhase =
	| "cold_start_blocking"
	| "warm_ready"
	| "degraded"
	| "error_recoverable";

export interface IRCalendarDayVisualState {
	key: string;
	totalCount: number;
	completedCount: number;
	pendingCount: number;
	completionRatio: number;
	hasTasks: boolean;
	isFullyCompleted: boolean;
	isPartiallyCompleted: boolean;
	isTodayPending: boolean;
	isOverduePending: boolean;
}

export interface IRCalendarWeekdayLabel {
	key: string;
	label: string;
	isWeekend: boolean;
}

export interface IRCalendarMonthDay {
	date: Date;
	otherMonth: boolean;
}

export interface IRCalendarSelectedDayLoadStats {
	baseline: number;
	stretchCeiling: number;
	assignedMinutes: number;
	baselineCount: number;
	stretchCount: number;
	assignedCount: number;
	overloadLevel: IRDailyLoadOverloadLevel;
	enabled: boolean;
}

export interface IRCalendarSearchResultEntry {
	item: ScheduleItem;
	dateKey: string;
}

export interface IRCalendarMaterialListProps {
	displayedMaterials: ScheduleItem[];
	hasActiveSearch: boolean;
	displayedMaterialDateKeys: Map<string, string>;
	continuousReadingEnabled: boolean;
	expandedMaterialIds: Set<string>;
	loadingSiblings: Set<string>;
	siblingCache: Map<string, ScheduleItem[]>;
	processedChunkIds: Set<string>;
	timerBusyBlockId: string | null;
	t: (key: string, vars?: Record<string, string | number>) => string;
	getDisplayedMaterialDateLabel: (
		materialId: string,
		dateKeys: Map<string, string>,
	) => string;
	getScheduleItemDeckName: (material: ScheduleItem) => string;
	getMaterialExpandButtonLabel: (isExpanded: boolean) => string;
	getReadingPointTypeIndicator: (
		material: ScheduleItem,
	) => { icon: string; label: string } | null;
	isSourceMissing: (materialId: string) => boolean;
	getParentProgressForMaterial: (
		materialId: string,
	) => {
		totalChildren: number;
		completedChildren: number;
		percent: number;
	} | null;
	handleMaterialClick: (material: ScheduleItem, event?: MouseEvent) => void;
	openMaterial: (material: ScheduleItem) => Promise<void>;
	toggleMaterialExpand: (material: ScheduleItem) => Promise<void> | void;
	handleMaterialContextMenu: (
		event: MouseEvent,
		anchor: HTMLElement,
		material: ScheduleItem,
	) => void;
	handleLongPressStart: (
		event: PointerEvent,
		anchor: HTMLElement,
		material: ScheduleItem,
	) => void;
	handleLongPressMove: (event: PointerEvent) => void;
	handleLongPressEnd: (event: PointerEvent) => void;
	openSchedulingMenu: (event: MouseEvent, material: ScheduleItem) => void;
	hasVisibleAssociatedNote: (material: ScheduleItem) => boolean;
	getAssociatedNoteActionLabel: (material: ScheduleItem) => string;
	getAssociatedNoteActionTooltip: (material: ScheduleItem) => string;
	handleAssociatedNoteClick: (
		event: MouseEvent,
		material: ScheduleItem,
	) => void;
	isTimerRunningForBlock: (blockId: string) => boolean;
	getDisplayedTimerSeconds: (blockId: string) => number;
	getReadingTimerButtonTitle: (blockId: string) => string;
	toggleReadingTimer: (material: ScheduleItem) => Promise<void>;
	formatCompactTimerDuration: (totalSeconds: number) => string;
	formatTimerDuration: (totalSeconds: number) => string;
	formatSiblingDueDate: (nextRepDate: number) => string;
	batchSelectionMode: boolean;
	isBatchSelected: (materialId: string) => boolean;
	toggleBatchSelection: (materialId: string, event?: MouseEvent) => void;
	readOnlyHistoryMode: boolean;
}
