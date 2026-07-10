/**
 * Premium feature IDs for the standalone incremental-reading plugin.
 * User-facing names/descriptions are resolved via i18n (`ir.premium.*` in incremental-reading.ts).
 */
export const IR_PREMIUM_FEATURES = {
	INCREMENTAL_READING: "incremental-reading",
	IMPORT_EXTERNAL_READING_POINTS: "import-external-reading-points",
	ASSOCIATED_NOTES: "associated-notes",
	TAG_GROUPS: "tag-groups",
	SCHEDULING_STRATEGY_SETTINGS: "scheduling-strategy-settings",
	INTERLEAVE_LEARNING_SETTINGS: "interleave-learning-settings",
	ANALYTICS_VIEW: "analytics-view",
	FOLDER_SUBSCRIPTION: "folder-subscription",
	READING_TIMER: "reading-timer",
	CALENDAR_BACKGROUND_WALL: "calendar-background-wall",
} as const;

export type IRPremiumFeatureId =
	typeof IR_PREMIUM_FEATURES[keyof typeof IR_PREMIUM_FEATURES];

export const IR_FEATURE_METADATA: Record<
	IRPremiumFeatureId,
	{ name: string; description: string; icon?: string }
> = {
	[IR_PREMIUM_FEATURES.INCREMENTAL_READING]: {
		name: "Incremental reading",
		description: "Incremental reading workflow",
		icon: "book-reader",
	},
	[IR_PREMIUM_FEATURES.IMPORT_EXTERNAL_READING_POINTS]: {
		name: "Import PDF/EPUB reading points",
		description: "Import chapter reading points from PDF and EPUB",
		icon: "file-plus-2",
	},
	[IR_PREMIUM_FEATURES.ASSOCIATED_NOTES]: {
		name: "Linked notes",
		description: "Link, create, and manage notes for reading points",
		icon: "link",
	},
	[IR_PREMIUM_FEATURES.TAG_GROUPS]: {
		name: "Tag groups",
		description: "Enable tag-group policies and management",
		icon: "tags",
	},
	[IR_PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS]: {
		name: "Scheduling strategy settings",
		description:
			"Configure processing-flow / reading-list and scheduling parameters",
		icon: "calendar-cog",
	},
	[IR_PREMIUM_FEATURES.INTERLEAVE_LEARNING_SETTINGS]: {
		name: "Interleaved learning",
		description: "Configure interleaving and same-topic consecutive limits",
		icon: "shuffle",
	},
	[IR_PREMIUM_FEATURES.ANALYTICS_VIEW]: {
		name: "Analytics view",
		description: "View incremental-reading analytics and statistics",
		icon: "bar-chart-2",
	},
	[IR_PREMIUM_FEATURES.FOLDER_SUBSCRIPTION]: {
		name: "Folder subscription",
		description: "Automatically scan and sync Markdown in subscribed folders",
		icon: "folder-sync",
	},
	[IR_PREMIUM_FEATURES.READING_TIMER]: {
		name: "Reading timer",
		description: "Track reading sessions and cumulative duration",
		icon: "timer",
	},
	[IR_PREMIUM_FEATURES.CALENDAR_BACKGROUND_WALL]: {
		name: "Calendar background wall",
		description: "Customize calendar background image and fade settings",
		icon: "image",
	},
};

export const IR_PREMIUM_ONLY_FEATURE_IDS = new Set<string>([
	IR_PREMIUM_FEATURES.IMPORT_EXTERNAL_READING_POINTS,
	IR_PREMIUM_FEATURES.ASSOCIATED_NOTES,
	IR_PREMIUM_FEATURES.TAG_GROUPS,
	IR_PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS,
	IR_PREMIUM_FEATURES.INTERLEAVE_LEARNING_SETTINGS,
	IR_PREMIUM_FEATURES.ANALYTICS_VIEW,
	IR_PREMIUM_FEATURES.FOLDER_SUBSCRIPTION,
	IR_PREMIUM_FEATURES.READING_TIMER,
	IR_PREMIUM_FEATURES.CALENDAR_BACKGROUND_WALL,
]);

export const IR_PREMIUM_BENEFIT_FEATURE_ORDER = [
	IR_PREMIUM_FEATURES.IMPORT_EXTERNAL_READING_POINTS,
	IR_PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS,
	IR_PREMIUM_FEATURES.INTERLEAVE_LEARNING_SETTINGS,
	IR_PREMIUM_FEATURES.FOLDER_SUBSCRIPTION,
	IR_PREMIUM_FEATURES.TAG_GROUPS,
	IR_PREMIUM_FEATURES.ANALYTICS_VIEW,
	IR_PREMIUM_FEATURES.READING_TIMER,
	IR_PREMIUM_FEATURES.CALENDAR_BACKGROUND_WALL,
	IR_PREMIUM_FEATURES.ASSOCIATED_NOTES,
] as const;
