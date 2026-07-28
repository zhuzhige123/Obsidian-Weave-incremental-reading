import { i18n } from "../../utils/i18n";

export type StandaloneIRSettingsTabId =
	| "basic"
	| "core-scheduling"
	| "advanced"
	| "license"
	| "about";

export type StandaloneIRSettingsSearchEntry = {
	tab: StandaloneIRSettingsTabId;
	nameKey: string;
	descKey?: string;
	aliases?: string[];
};

const SEARCH_ENTRIES: readonly StandaloneIRSettingsSearchEntry[] = [
	{
		tab: "basic",
		nameKey: "irSettings.standalone.tabs.basic",
		aliases: ["basic", "general"],
	},
	{
		tab: "basic",
		nameKey: "irSettings.standalone.language.title",
		descKey: "irSettings.standalone.language.description",
		aliases: ["language", "locale", "i18n"],
	},
	{
		tab: "basic",
		nameKey: "irSettings.standalone.premiumPreview.title",
		descKey: "irSettings.standalone.premiumPreview.description",
		aliases: ["premium", "preview"],
	},
	{
		tab: "basic",
		nameKey: "irSettings.standalone.dataFolders.title",
		descKey: "irSettings.standalone.dataFolders.description",
		aliases: ["data folder", "storage", "paths"],
	},
	{
		tab: "basic",
		nameKey: "irSettings.standalone.dataFolders.saveFolderName",
		descKey: "irSettings.standalone.dataFolders.saveFolderDesc",
		aliases: ["plugin data", "weave Incremental reading"],
	},
	{
		tab: "basic",
		nameKey: "irSettings.standalone.dataFolders.readingPointFolderName",
		descKey: "irSettings.standalone.dataFolders.readingPointFolderDesc",
		aliases: ["reading point folder", "markdown folder"],
	},
	{
		tab: "core-scheduling",
		nameKey: "irSettings.scheduleTitle",
		aliases: ["core scheduling", "schedule", "daily cap"],
	},
	{
		tab: "core-scheduling",
		nameKey: "irSettings.strategyTitle",
		aliases: ["scheduling strategy", "processing", "reading list"],
	},
	{
		tab: "core-scheduling",
		nameKey: "irSettings.autoSubscribeTitle",
		aliases: ["folder subscription", "clipping folder"],
	},
	{
		tab: "advanced",
		nameKey: "irSettings.advancedTitle",
		aliases: ["advanced scheduling", "tag groups"],
	},
	{
		tab: "advanced",
		nameKey: "irSettings.tagSourceMarkdownYamlKeyLabel",
		descKey: "irSettings.tagSourceMarkdownYamlKeyDesc",
		aliases: ["tag sync", "yaml tags", "weave_tags", "tags"],
	},
	{
		tab: "license",
		nameKey: "irSettings.standalone.tabs.license",
		aliases: ["license", "activation", "premium"],
	},
	{
		tab: "about",
		nameKey: "irSettings.standalone.tabs.about",
		aliases: ["about", "version", "docs"],
	},
];

function resolveLabel(key: string): string {
	const translated = i18n.t(key);
	if (translated && translated !== key) {
		return translated;
	}
	const leaf = key.split(".").pop();
	return leaf || key;
}

/** Flat aliases for the single Obsidian 1.13+ settings-search host entry. */
export function buildStandaloneIRSettingsSearchAliases(
	extra: string[] = [],
): string[] {
	const aliases = new Set<string>([
		"incremental reading",
		"IR",
		"scheduling",
		"tag groups",
		"reading points",
		"topics",
		"calendar",
		...extra,
	]);

	for (const entry of SEARCH_ENTRIES) {
		aliases.add(resolveLabel(entry.nameKey));
		if (entry.descKey) {
			aliases.add(resolveLabel(entry.descKey));
		}
		for (const alias of entry.aliases || []) {
			aliases.add(alias);
		}
	}

	return [...aliases].filter(Boolean);
}

export function listStandaloneIRSettingsSearchEntries(): StandaloneIRSettingsSearchEntry[] {
	return SEARCH_ENTRIES.map((entry) => ({ ...entry }));
}

export function resolveStandaloneIRSettingsTabId(
	value: unknown,
): StandaloneIRSettingsTabId | null {
	if (typeof value !== "string") {
		return null;
	}
	switch (value.trim()) {
		case "basic":
		case "core-scheduling":
		case "advanced":
		case "license":
		case "about":
			return value.trim() as StandaloneIRSettingsTabId;
		default:
			return null;
	}
}

export const STANDALONE_IR_SETTINGS_NAVIGATE_EVENT =
	"WeaveIncrementalReading:navigate-settings";
