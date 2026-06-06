import type { SupportedLanguage, TranslationKey } from './types';
import { standaloneBaseTranslations } from './resources/base';
import { licenseUiTranslationOverrides } from './resources/license-ui';
import { irStandaloneUiTranslationOverrides } from './resources/ir-standalone-ui-overrides';
import { incrementalReadingTranslations, incrementalReadingTranslationOverrides } from './resources/incremental-reading';

export const translations: Record<SupportedLanguage, TranslationKey> = {
	'zh-CN': {
		...standaloneBaseTranslations['zh-CN'],
		...incrementalReadingTranslations['zh-CN'],
	},
	'en-US': {
		...standaloneBaseTranslations['en-US'],
		...incrementalReadingTranslations['en-US'],
	},
};

export const translationOverrides: Partial<Record<SupportedLanguage, TranslationKey>> = {
	'zh-CN': {
		...licenseUiTranslationOverrides['zh-CN'],
		...incrementalReadingTranslationOverrides['zh-CN'],
		...irStandaloneUiTranslationOverrides['zh-CN'],
	},
	'en-US': {
		...licenseUiTranslationOverrides['en-US'],
		...incrementalReadingTranslationOverrides['en-US'],
		...irStandaloneUiTranslationOverrides['en-US'],
	},
};
