export type {
	AuthoringLanguage,
	PluginUiLanguagePreference,
	SupportedLanguage,
} from "./locale-registry";

export interface TranslationKey {
	[key: string]: string | TranslationKey;
}

export interface I18nConfig {
	defaultLanguage: import("./locale-registry").SupportedLanguage;
	fallbackLanguage: import("./locale-registry").SupportedLanguage;
	supportedLanguages: import("./locale-registry").SupportedLanguage[];
}
