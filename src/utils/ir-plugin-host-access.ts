import type { App } from "obsidian";
import {
	DEFAULT_FLOW_STRETCH_PERCENT,
	DEFAULT_MAX_ESTIMATED_MINUTES_PER_ITEM,
	clampDailyReadingPointCap,
	clampFlowStretchPercent,
	clampMaxEstimatedMinutesPerItem,
	computeReadingPointStretchCap,
} from "../services/incremental-reading/IRDailyLoadAllocator";
import { getIncrementalReadingPlugin } from "../services/incremental-reading/ir-runtime";
import { buildDefaultIncrementalReadingSettings } from "../services/incremental-reading/ir-settings";
import {
	DEFAULT_ADVANCED_SCHEDULE_SETTINGS,
	type IRAdvancedScheduleSettings,
} from "../types/ir-types";
import type { IncrementalReadingSettings } from "../types/plugin-settings.d";

export function readIncrementalReadingSettings(
	app: App,
): IncrementalReadingSettings {
	const plugin = getIncrementalReadingPlugin(app);
	return (
		plugin?.settings?.incrementalReading ??
		buildDefaultIncrementalReadingSettings(
			plugin?.settings?.weaveParentFolder ?? "",
		)
	);
}

export function readAdvancedScheduleSettingsSnapshot(
	app: App,
): IRAdvancedScheduleSettings {
	const defaults = DEFAULT_ADVANCED_SCHEDULE_SETTINGS;

	try {
		const ir = readIncrementalReadingSettings(app);
		const enableTagGroupPrior =
			ir.enableTagGroupPrior ?? defaults.enableTagGroupPrior;

		return {
			...defaults,
			dailyTimeBudgetMinutes:
				ir.dailyTimeBudgetMinutes ?? defaults.dailyTimeBudgetMinutes,
			flowStretchPercent: clampFlowStretchPercent(
				ir.flowStretchPercent ??
					defaults.flowStretchPercent ??
					DEFAULT_FLOW_STRETCH_PERCENT,
			),
			enableLoadBasedDefer: ir.enableLoadBasedDefer !== false,
			maxEstimatedMinutesPerItem: clampMaxEstimatedMinutesPerItem(
				ir.maxEstimatedMinutesPerItem ??
					defaults.maxEstimatedMinutesPerItem ??
					DEFAULT_MAX_ESTIMATED_MINUTES_PER_ITEM,
			),
			dailyReadingPointCap: clampDailyReadingPointCap(
				ir.dailyReadingPointCap ?? defaults.dailyReadingPointCap,
			),
			dailyReadingPointStretchCap: computeReadingPointStretchCap(
				clampDailyReadingPointCap(
					ir.dailyReadingPointCap ?? defaults.dailyReadingPointCap,
				),
				clampFlowStretchPercent(
					ir.flowStretchPercent ?? defaults.flowStretchPercent,
				),
				ir.dailyReadingPointStretchCap ?? defaults.dailyReadingPointStretchCap,
			),
			horizonSpreadDays: Math.max(
				5,
				Math.min(
					14,
					Math.round(
						Number(ir.horizonSpreadDays ?? defaults.horizonSpreadDays ?? 7),
					),
				),
			),
			enableHorizonSmoothing: ir.enableHorizonSmoothing !== false,
			interleaveProfile:
				ir.interleaveProfile ?? defaults.interleaveProfile ?? "related-soft",
			maxTopicSharePercent: Math.max(
				40,
				Math.min(
					90,
					Math.round(
						Number(
							ir.maxTopicSharePercent ?? defaults.maxTopicSharePercent ?? 60,
						),
					),
				),
			),
			maxAppearancesPerDay:
				ir.maxAppearancesPerDay ?? defaults.maxAppearancesPerDay,
			interleaveMode: ir.interleaveMode ?? defaults.interleaveMode,
			maxConsecutiveSameTopic:
				ir.maxConsecutiveSameTopic ?? defaults.maxConsecutiveSameTopic,
			enableTagGroupPrior,
			agingStrength: ir.agingStrength ?? defaults.agingStrength,
			autoPostponeStrategy:
				ir.autoPostponeStrategy ?? defaults.autoPostponeStrategy,
			priorityHalfLifeDays:
				ir.priorityHalfLifeDays ?? defaults.priorityHalfLifeDays,
			tagGroupLearningSpeed: enableTagGroupPrior ? "medium" : "off",
			defaultIntervalFactor:
				ir.defaultIntervalFactor ?? defaults.defaultIntervalFactor,
			maxIntervalDays: ir.maxInterval ?? defaults.maxIntervalDays,
		};
	} catch {
		return defaults;
	}
}

export function readTagGroupFollowMode(app: App): "off" | "ask" | "auto" {
	try {
		return readIncrementalReadingSettings(app).tagGroupFollowMode ?? "ask";
	} catch {
		return "ask";
	}
}
