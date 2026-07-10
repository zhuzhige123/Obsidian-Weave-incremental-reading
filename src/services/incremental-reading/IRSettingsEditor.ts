import type { IncrementalReadingSettingsHost } from "../../components/settings/types/incremental-reading-settings-host";
import { getLegacyIRImportFolder } from "../../config/paths";
import type {
	IncrementalReadingFolderSubscriptionInitialScheduleMode,
	IncrementalReadingFolderSubscriptionRule,
	IncrementalReadingFolderSubscriptionSettings,
	IncrementalReadingSettings,
} from "../../types/plugin-settings.d";
import {
	createIncrementalReadingFolderSubscriptionRuleId,
	normalizeIncrementalReadingFolderSubscriptionSettings,
} from "./folder-subscription-settings";
import { buildDefaultIncrementalReadingSettings } from "./ir-settings";

type RootSettingsState = {
	incrementalReading?: IncrementalReadingSettings;
};

type UpdateSettingsState = (settings: RootSettingsState) => void;

export class IRSettingsEditor {
	private readonly plugin: IncrementalReadingSettingsHost;
	private readonly getState: () => RootSettingsState;
	private readonly updateState: UpdateSettingsState;

	constructor(options: {
		plugin: IncrementalReadingSettingsHost;
		getState: () => RootSettingsState;
		updateState: UpdateSettingsState;
	}) {
		this.plugin = options.plugin;
		this.getState = options.getState;
		this.updateState = options.updateState;
	}

	getNormalizedIncrementalReadingSettings(): IncrementalReadingSettings {
		const defaultIRSettings = buildDefaultIncrementalReadingSettings(
			this.plugin.settings?.weaveParentFolder,
		);
		return {
			...defaultIRSettings,
			...this.plugin.getIncrementalReadingSettings(),
			importFolder: getLegacyIRImportFolder(
				this.plugin.settings?.weaveParentFolder,
			),
		};
	}

	ensureIncrementalReadingSettings(): IncrementalReadingSettings {
		const state = this.getState();
		if (!state.incrementalReading) {
			const nextSettings = this.getNormalizedIncrementalReadingSettings();
			this.updateState({
				...state,
				incrementalReading: nextSettings,
			});
			return nextSettings;
		}
		return state.incrementalReading;
	}

	async save(
		syncFolderSubscription = false,
	): Promise<IncrementalReadingSettings> {
		const incrementalReading = this.ensureIncrementalReadingSettings();
		const savedSettings = await this.plugin.saveIncrementalReadingSettings(
			incrementalReading,
			{
				syncFolderSubscription,
			},
		);
		this.updateState({
			...this.getState(),
			incrementalReading: savedSettings,
		});
		return savedSettings;
	}

	getFolderSubscriptionSettingsSnapshot(): IncrementalReadingFolderSubscriptionSettings {
		return normalizeIncrementalReadingFolderSubscriptionSettings(
			this.ensureIncrementalReadingSettings().folderSubscription,
		);
	}

	applyNormalizedFolderSubscriptionSettings(): void {
		const incrementalReading = this.ensureIncrementalReadingSettings();
		const normalizedFolderSubscription =
			normalizeIncrementalReadingFolderSubscriptionSettings(
				incrementalReading.folderSubscription,
			);
		if (
			JSON.stringify(incrementalReading.folderSubscription || {}) !==
			JSON.stringify(normalizedFolderSubscription)
		) {
			incrementalReading.folderSubscription = normalizedFolderSubscription;
		}
	}

	getFolderSubscriptionRules(): IncrementalReadingFolderSubscriptionRule[] {
		return this.getFolderSubscriptionSettingsSnapshot().rules || [];
	}

	updateFolderSubscriptionSettings(
		updater: (
			current: IncrementalReadingFolderSubscriptionSettings,
		) => IncrementalReadingFolderSubscriptionSettings,
	): void {
		const incrementalReading = this.ensureIncrementalReadingSettings();
		incrementalReading.folderSubscription =
			normalizeIncrementalReadingFolderSubscriptionSettings(
				updater(this.getFolderSubscriptionSettingsSnapshot()),
			);
	}

	createEmptyFolderSubscriptionRule(): IncrementalReadingFolderSubscriptionRule {
		return {
			id: createIncrementalReadingFolderSubscriptionRuleId(),
			enabled: true,
			folderPath: "",
			deckId: "",
		};
	}

	getFolderSubscriptionImportConfirmThreshold(): number {
		const value = Number(
			this.getFolderSubscriptionSettingsSnapshot().importConfirmThreshold ?? 20,
		);
		if (!Number.isFinite(value) || value < 0) {
			return 20;
		}
		return Math.min(200, Math.round(value));
	}

	getFolderSubscriptionInitialScheduleMode(): IncrementalReadingFolderSubscriptionInitialScheduleMode {
		return this.getFolderSubscriptionSettingsSnapshot().initialScheduleMode ===
			"scheduled"
			? "scheduled"
			: "today";
	}

	updateIncrementalReading(
		updater: (settings: IncrementalReadingSettings) => void,
	): void {
		updater(this.ensureIncrementalReadingSettings());
	}
}
