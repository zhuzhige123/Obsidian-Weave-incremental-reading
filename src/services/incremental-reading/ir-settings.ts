import { resolveIRImportFolder } from "../../config/paths";
import type {
	IRCalendarSidebarSettings,
	IncrementalReadingFolderSubscriptionSettings,
	IncrementalReadingSettings,
} from "../../types/plugin-settings.d";
import { normalizeIncrementalReadingFolderSubscriptionSettings } from "./folder-subscription-settings";
import {
	DEFAULT_IR_TAG_SOURCE_POLICY,
	normalizeIRTagSourcePolicy,
} from "./ir-tag-source-policy";
import { resolveParagraphWorkbenchDisplaySettings } from "./paragraph-workbench/paragraph-reading-shell";

export const DEFAULT_IR_CALENDAR_SIDEBAR_SETTINGS: IRCalendarSidebarSettings = {
	continuousReadingEnabled: false,
	autoStartNextTimerEnabled: false,
	showSchedulingPreview: false,
	calendarViewMode: "full",
	showMaterialTimers: true,
	showReadingPointTypeLabels: false,
	showMissingSourceIndicators: true,
	hideTodayCompletedReadingPoints: false,
	backgroundWall: {
		imagePath: "",
		fadePercent: 72,
	},
};

function resolveCalendarViewMode(
	mode: unknown,
): NonNullable<IRCalendarSidebarSettings["calendarViewMode"]> {
	if (mode === "full" || mode === "two-row" || mode === "one-row") {
		return mode;
	}
	return DEFAULT_IR_CALENDAR_SIDEBAR_SETTINGS.calendarViewMode ?? "full";
}

export const DEFAULT_IR_FOLDER_SUBSCRIPTION_SETTINGS: IncrementalReadingFolderSubscriptionSettings =
	{
		rules: [],
		initialScheduleMode: "today",
		importConfirmThreshold: 20,
	};

export function buildDefaultIncrementalReadingSettings(
	weaveParentFolder?: string | null,
): IncrementalReadingSettings {
	return {
		defaultIntervalFactor: 1.5,
		dailyNewLimit: 20,
		dailyReviewLimit: 50,
		defaultSplitLevel: 2,
		interleaveMode: true,
		maxConsecutiveSameTopic: 3,
		reviewThreshold: 7,
		maxInterval: 365,
		importFolder: resolveIRImportFolder(
			undefined,
			String(weaveParentFolder || "").trim(),
		),
		selectionQuickCreateDeleteSource: false,
		selectionQuickCreateLastFolder: "",
		selectionQuickCreateBacklinkPosition: "start",
		selectionQuickCreateSourceDocumentBacklinkPosition: "start",
		appendSourceDocumentBacklinkOnSplitImport: false,
		scheduleStrategy: "processing",
		dailyTimeBudgetMinutes: 40,
		flowStretchPercent: 15,
		enableLoadBasedDefer: true,
		maxEstimatedMinutesPerItem: 18,
		dailyReadingPointCap: 15,
		dailyReadingPointStretchCap: 17,
		horizonSpreadDays: 7,
		enableHorizonSmoothing: true,
		interleaveProfile: "related-soft",
		maxTopicSharePercent: 60,
		maxAppearancesPerDay: 2,
		enableTagGroupPrior: true,
		agingStrength: "low",
		autoPostponeStrategy: "gentle",
		priorityHalfLifeDays: 7,
		learnAheadDays: 3,
		tagGroupFollowMode: "ask",
		tagSource: {
			...DEFAULT_IR_TAG_SOURCE_POLICY,
		},
		folderSubscription: {
			...DEFAULT_IR_FOLDER_SUBSCRIPTION_SETTINGS,
		},
		calendarSidebar: {
			...DEFAULT_IR_CALENDAR_SIDEBAR_SETTINGS,
			backgroundWall: {
				...DEFAULT_IR_CALENDAR_SIDEBAR_SETTINGS.backgroundWall,
			},
		},
		paragraphWorkbench: resolveParagraphWorkbenchDisplaySettings(),
	};
}

export function normalizeIRCalendarSidebarSettings(
	settings?: Partial<IRCalendarSidebarSettings> | null,
): IRCalendarSidebarSettings {
	return {
		...DEFAULT_IR_CALENDAR_SIDEBAR_SETTINGS,
		...(settings ?? {}),
		calendarViewMode: resolveCalendarViewMode(settings?.calendarViewMode),
		backgroundWall: {
			...DEFAULT_IR_CALENDAR_SIDEBAR_SETTINGS.backgroundWall,
			...(settings?.backgroundWall ?? {}),
			imagePath: String(settings?.backgroundWall?.imagePath || "").trim(),
			fadePercent: Number.isFinite(
				Number(settings?.backgroundWall?.fadePercent),
			)
				? Number(settings?.backgroundWall?.fadePercent)
				: DEFAULT_IR_CALENDAR_SIDEBAR_SETTINGS.backgroundWall?.fadePercent ??
				  72,
		},
	};
}

export function normalizeIncrementalReadingSettings(
	settings?: Partial<IncrementalReadingSettings> | null,
	weaveParentFolder?: string | null,
): IncrementalReadingSettings {
	const defaults = buildDefaultIncrementalReadingSettings(weaveParentFolder);
	return {
		...defaults,
		...(settings ?? {}),
		// 已合并进 weaveParentFolder：不再单独持久化自定义 importFolder，读取时由 resolveIRImportFolder 从数据根推导
		importFolder: "",
		selectionQuickCreateLastFolder: String(
			settings?.selectionQuickCreateLastFolder || "",
		).trim(),
		readingTargetInboxDeckId: String(
			settings?.readingTargetInboxDeckId || "",
		).trim(),
		readingTargetLastDeckId: String(
			settings?.readingTargetLastDeckId || "",
		).trim(),
		readingTargetAppendSourceBacklink:
			settings?.readingTargetAppendSourceBacklink === true,
		readingTargetDefaultNoteBacked:
			settings?.readingTargetDefaultNoteBacked === true,
		folderSubscription: normalizeIncrementalReadingFolderSubscriptionSettings(
			settings?.folderSubscription,
		),
		calendarSidebar: normalizeIRCalendarSidebarSettings(
			settings?.calendarSidebar,
		),
		paragraphWorkbench: resolveParagraphWorkbenchDisplaySettings(
			settings?.paragraphWorkbench,
		),
		tagSource: normalizeIRTagSourcePolicy(settings?.tagSource),
		flowStretchPercent:
			typeof settings?.flowStretchPercent === "number"
				? Math.max(0, Math.min(40, Math.round(settings.flowStretchPercent)))
				: defaults.flowStretchPercent,
		enableLoadBasedDefer: settings?.enableLoadBasedDefer !== false,
		maxEstimatedMinutesPerItem:
			typeof settings?.maxEstimatedMinutesPerItem === "number"
				? Math.max(
						5,
						Math.min(30, Math.round(settings.maxEstimatedMinutesPerItem)),
				  )
				: defaults.maxEstimatedMinutesPerItem,
		dailyReadingPointCap:
			typeof settings?.dailyReadingPointCap === "number"
				? Math.max(5, Math.min(40, Math.round(settings.dailyReadingPointCap)))
				: defaults.dailyReadingPointCap,
		dailyReadingPointStretchCap:
			typeof settings?.dailyReadingPointStretchCap === "number"
				? Math.max(
						5,
						Math.min(45, Math.round(settings.dailyReadingPointStretchCap)),
				  )
				: defaults.dailyReadingPointStretchCap,
		horizonSpreadDays:
			typeof settings?.horizonSpreadDays === "number"
				? Math.max(5, Math.min(14, Math.round(settings.horizonSpreadDays)))
				: defaults.horizonSpreadDays,
		enableHorizonSmoothing: settings?.enableHorizonSmoothing !== false,
		interleaveProfile:
			settings?.interleaveProfile === "off" ||
			settings?.interleaveProfile === "soft" ||
			settings?.interleaveProfile === "related-soft"
				? settings.interleaveProfile
				: defaults.interleaveProfile,
		maxTopicSharePercent:
			typeof settings?.maxTopicSharePercent === "number"
				? Math.max(40, Math.min(90, Math.round(settings.maxTopicSharePercent)))
				: defaults.maxTopicSharePercent,
	};
}
