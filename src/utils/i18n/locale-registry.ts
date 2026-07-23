/**
 * Single source of truth for supported UI languages, host detection, and
 * per-locale missing-key fallback chains.
 */

export type SupportedLanguage =
	| "zh-CN"
	| "en-US"
	| "ja-JP"
	| "ko-KR"
	| "ru-RU"
	| "zh-TW";

/** Nested TS catalogs are authored only in these two locales. */
export type AuthoringLanguage = "zh-CN" | "en-US";

export const AUTHORING_LANGUAGES: readonly AuthoringLanguage[] = [
	"zh-CN",
	"en-US",
] as const;

/** Follow Obsidian host language, or pin plugin UI to a specific locale. */
export type PluginUiLanguagePreference = "auto" | SupportedLanguage;

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
	"zh-CN",
	"zh-TW",
	"en-US",
	"ja-JP",
	"ko-KR",
	"ru-RU",
] as const;

export const PLUGIN_UI_LANGUAGE_OPTIONS: PluginUiLanguagePreference[] = [
	"auto",
	...SUPPORTED_LANGUAGES,
];

/**
 * Missing-key fallback per locale.
 * - Additive locales fall back to their authoring base (en or zh).
 * - en-US falls back to zh-CN for historical bilingual coverage.
 * - zh-CN has no fallback (return the raw key).
 */
const LOCALE_FALLBACK: Record<SupportedLanguage, SupportedLanguage | null> = {
	"zh-CN": null,
	"zh-TW": "zh-CN",
	"en-US": "zh-CN",
	"ja-JP": "en-US",
	"ko-KR": "en-US",
	"ru-RU": "en-US",
};

/** i18n key segment for settings language option labels. */
export const LANGUAGE_OPTION_LABEL_KEYS: Record<
	PluginUiLanguagePreference,
	string
> = {
	auto: "irSettings.standalone.language.auto",
	"zh-CN": "irSettings.standalone.language.zhCN",
	"zh-TW": "irSettings.standalone.language.zhTW",
	"en-US": "irSettings.standalone.language.enUS",
	"ja-JP": "irSettings.standalone.language.jaJP",
	"ko-KR": "irSettings.standalone.language.koKR",
	"ru-RU": "irSettings.standalone.language.ruRU",
};

export function isSupportedLanguage(
	value: unknown,
): value is SupportedLanguage {
	return (
		typeof value === "string" &&
		(SUPPORTED_LANGUAGES as readonly string[]).includes(value)
	);
}

export function normalizePluginUiLanguagePreference(
	value: unknown,
): PluginUiLanguagePreference {
	if (value === "auto") {
		return "auto";
	}
	if (isSupportedLanguage(value)) {
		return value;
	}
	return "auto";
}

export function getLocaleFallback(
	language: SupportedLanguage,
): SupportedLanguage | null {
	return LOCALE_FALLBACK[language];
}

/**
 * Map an Obsidian / browser / moment language tag to a supported plugin locale.
 */
export function resolveHostLanguage(
	raw: string | null | undefined,
): SupportedLanguage | null {
	if (!raw) {
		return null;
	}

	const normalized = String(raw).trim().replace(/_/g, "-");
	if (!normalized) {
		return null;
	}

	const lower = normalized.toLowerCase();

	if (lower === "zh-tw" || lower.startsWith("zh-tw")) {
		return "zh-TW";
	}
	if (lower === "zh-hk" || lower.startsWith("zh-hk")) {
		return "zh-TW";
	}
	if (lower.includes("hant")) {
		return "zh-TW";
	}
	if (lower === "zh" || lower === "zh-cn" || lower.startsWith("zh")) {
		return "zh-CN";
	}

	if (lower === "ja" || lower.startsWith("ja-") || lower.startsWith("ja_")) {
		return "ja-JP";
	}
	if (lower === "ko" || lower.startsWith("ko-") || lower.startsWith("ko_")) {
		return "ko-KR";
	}
	if (lower === "ru" || lower.startsWith("ru-") || lower.startsWith("ru_")) {
		return "ru-RU";
	}

	if (lower === "en" || lower.startsWith("en-") || lower.startsWith("en_")) {
		return "en-US";
	}

	return "en-US";
}
