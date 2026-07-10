import type { SupportedLanguage } from "./types";

/** Follow Obsidian host language, or pin plugin UI to a specific locale. */
export type PluginUiLanguagePreference = "auto" | SupportedLanguage;

export const PLUGIN_UI_LANGUAGE_OPTIONS: PluginUiLanguagePreference[] = [
	"auto",
	"zh-CN",
	"en-US",
];

export function normalizePluginUiLanguagePreference(
	value: unknown,
): PluginUiLanguagePreference {
	if (value === "zh-CN" || value === "en-US") {
		return value;
	}
	return "auto";
}
