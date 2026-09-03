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
		markdownBlockFocusModeEnabled: false,
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
	const raw = (settings ?? {}) as Partial<IncrementalReadingSettings> & {
		dailyNewLimit?: number;
		dailyReviewLimit?: number;
	};
	const {
		dailyNewLimit: legacyDailyNewLimit,
		dailyReviewLimit: legacyDailyReviewLimit,
		...restSettings
	} = raw;

	const hasExplicitCap = typeof restSettings.dailyReadingPointCap === "number";
	let dailyReadingPointCap = hasExplicitCap
		? Math.max(5, Math.min(40, Math.round(restSettings.dailyReadingPointCap!)))
		: defaults.dailyReadingPointCap!;
	if (!hasExplicitCap) {
		const migratedCandidates: number[] = [];
		if (
			typeof legacyDailyNewLimit === "number" &&
			Number.isFinite(legacyDailyNewLimit) &&
			legacyDailyNewLimit !== 20
		) {
			migratedCandidates.push(legacyDailyNewLimit);
		}
		if (
			typeof legacyDailyReviewLimit === "number" &&
			Number.isFinite(legacyDailyReviewLimit) &&
			legacyDailyReviewLimit !== 50
		) {
			migratedCandidates.push(Math.min(legacyDailyReviewLimit, 40));
		}
		if (migratedCandidates.length > 0) {
			dailyReadingPointCap = Math.max(
				5,
				Math.min(40, Math.round(Math.max(...migratedCandidates))),
			);
		}
	}

	return {
		...defaults,
		...restSettings,
		// 已合并进 weaveParentFolder：不再单独持久化自定义 importFolder，读取时由 resolveIRImportFolder 从数据根推导
		importFolder: "",
		selectionQuickCreateLastFolder: String(
			restSettings.selectionQuickCreateLastFolder || "",
		).trim(),
		readingTargetInboxDeckId: String(
			restSettings.readingTargetInboxDeckId || "",
		).trim(),
		readingTargetLastDeckId: String(
			restSettings.readingTargetLastDeckId || "",
		).trim(),
		readingTargetAppendSourceBacklink:
			restSettings.readingTargetAppendSourceBacklink === true,
		readingTargetDefaultNoteBacked:
			restSettings.readingTargetDefaultNoteBacked === true,
		markdownBlockFocusModeEnabled:
			restSettings.markdownBlockFocusModeEnabled === true,
		folderSubscription: normalizeIncrementalReadingFolderSubscriptionSettings(
			restSettings.folderSubscription,
		),
		calendarSidebar: normalizeIRCalendarSidebarSettings(
			restSettings.calendarSidebar,
		),
		paragraphWorkbench: resolveParagraphWorkbenchDisplaySettings(
			restSettings.paragraphWorkbench,
		),
		tagSource: normalizeIRTagSourcePolicy(restSettings.tagSource),
		flowStretchPercent:
			typeof restSettings.flowStretchPercent === "number"
				? Math.max(0, Math.min(40, Math.round(restSettings.flowStretchPercent)))
				: defaults.flowStretchPercent,
		enableLoadBasedDefer: restSettings.enableLoadBasedDefer !== false,
		maxEstimatedMinutesPerItem:
			typeof restSettings.maxEstimatedMinutesPerItem === "number"
				? Math.max(
						5,
						Math.min(30, Math.round(restSettings.maxEstimatedMinutesPerItem)),
				  )
				: defaults.maxEstimatedMinutesPerItem,
		dailyReadingPointCap,
		dailyReadingPointStretchCap:
			typeof restSettings.dailyReadingPointStretchCap === "number"
				? Math.max(
						5,
						Math.min(45, Math.round(restSettings.dailyReadingPointStretchCap)),
				  )
				: defaults.dailyReadingPointStretchCap,
		horizonSpreadDays:
			typeof restSettings.horizonSpreadDays === "number"
				? Math.max(5, Math.min(14, Math.round(restSettings.horizonSpreadDays)))
				: defaults.horizonSpreadDays,
		enableHorizonSmoothing: restSettings.enableHorizonSmoothing !== false,
		interleaveProfile:
			restSettings.interleaveProfile === "off" ||
			restSettings.interleaveProfile === "soft" ||
			restSettings.interleaveProfile === "related-soft"
				? restSettings.interleaveProfile
				: defaults.interleaveProfile,
		maxTopicSharePercent:
			typeof restSettings.maxTopicSharePercent === "number"
				? Math.max(40, Math.min(90, Math.round(restSettings.maxTopicSharePercent)))
				: defaults.maxTopicSharePercent,
	};
}
