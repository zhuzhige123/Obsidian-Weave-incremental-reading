import { standaloneBaseTranslations } from "./resources/base";
import {
	incrementalReadingTranslationOverrides,
	incrementalReadingTranslations,
} from "./resources/incremental-reading";
import { irStandaloneUiTranslationOverrides } from "./resources/ir-standalone-ui-overrides";
import { irUiSurfaceTranslations } from "./resources/ir-ui-surfaces";
import { licenseUiTranslationOverrides } from "./resources/license-ui";
import type { AuthoringLanguage, TranslationKey } from "./types";

export const translations: Record<AuthoringLanguage, TranslationKey> = {
	"zh-CN": {
		...standaloneBaseTranslations["zh-CN"],
		...incrementalReadingTranslations["zh-CN"],
		...irUiSurfaceTranslations["zh-CN"],
	},
	"en-US": {
		...standaloneBaseTranslations["en-US"],
		...incrementalReadingTranslations["en-US"],
		...irUiSurfaceTranslations["en-US"],
	},
};

export const translationOverrides: Partial<
	Record<AuthoringLanguage, TranslationKey>
> = {
	"zh-CN": {
		...licenseUiTranslationOverrides["zh-CN"],
		...incrementalReadingTranslationOverrides["zh-CN"],
		...irStandaloneUiTranslationOverrides["zh-CN"],
	},
	"en-US": {
		...licenseUiTranslationOverrides["en-US"],
		...incrementalReadingTranslationOverrides["en-US"],
		...irStandaloneUiTranslationOverrides["en-US"],
	},
};
