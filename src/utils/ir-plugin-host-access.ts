import type { App } from "obsidian";
import type { IncrementalReadingSettings } from "../types/plugin-settings.d";
import {
	DEFAULT_ADVANCED_SCHEDULE_SETTINGS,
	type IRAdvancedScheduleSettings,
} from "../types/ir-types";
import { buildDefaultIncrementalReadingSettings } from "../services/incremental-reading/ir-settings";
import { getIncrementalReadingPlugin } from "../services/incremental-reading/ir-runtime";

export function readIncrementalReadingSettings(app: App): IncrementalReadingSettings {
	const plugin = getIncrementalReadingPlugin(app);
	return (
		plugin?.settings?.incrementalReading ??
		buildDefaultIncrementalReadingSettings(plugin?.settings?.weaveParentFolder ?? "")
	);
}

export function readAdvancedScheduleSettingsSnapshot(app: App): IRAdvancedScheduleSettings {
	const defaults = DEFAULT_ADVANCED_SCHEDULE_SETTINGS;

	try {
		const ir = readIncrementalReadingSettings(app);
		const enableTagGroupPrior = ir.enableTagGroupPrior ?? defaults.enableTagGroupPrior;

		return {
			...defaults,
			dailyTimeBudgetMinutes: ir.dailyTimeBudgetMinutes ?? defaults.dailyTimeBudgetMinutes,
			maxAppearancesPerDay: ir.maxAppearancesPerDay ?? defaults.maxAppearancesPerDay,
			interleaveMode: ir.interleaveMode ?? defaults.interleaveMode,
			maxConsecutiveSameTopic: ir.maxConsecutiveSameTopic ?? defaults.maxConsecutiveSameTopic,
			enableTagGroupPrior,
			agingStrength: ir.agingStrength ?? defaults.agingStrength,
			autoPostponeStrategy: ir.autoPostponeStrategy ?? defaults.autoPostponeStrategy,
			priorityHalfLifeDays: ir.priorityHalfLifeDays ?? defaults.priorityHalfLifeDays,
			tagGroupLearningSpeed: enableTagGroupPrior ? "medium" : "off",
			defaultIntervalFactor: ir.defaultIntervalFactor ?? defaults.defaultIntervalFactor,
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
