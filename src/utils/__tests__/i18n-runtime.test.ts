import { get } from "svelte/store";

import {
	applyPluginUiLanguagePreference,
	i18n,
	shouldFollowObsidianUiLanguage,
	syncI18nWithObsidianLanguage,
	trArray,
} from "../i18n";
import { flattenTranslationTree } from "../i18n/hydrate-locale";
import { SUPPORTED_LANGUAGES } from "../i18n/locale-registry";
import { flattenTranslationLeafKeys, translationCatalog } from "../i18n";

describe("i18n runtime fallbacks", () => {
	beforeEach(() => {
		window.localStorage.removeItem("language");
		applyPluginUiLanguagePreference("en-US");
	});

	it("prefers concrete translations for high-value keys", () => {
		expect(i18n.t("about.license.activation.activate")).toBe("Activate");
		expect(i18n.t("common.close")).toBe("Close");
		expect(i18n.t("irSidebar.title")).toBe("Incremental reading calendar");
		expect(i18n.t("settingsUtils.operationFailed")).toBe("Operation failed");
	});

	it("returns unresolved keys verbatim instead of pseudo-localized English text", () => {
		expect(i18n.t("runtimeFallback.avgTime")).toBe("runtimeFallback.avgTime");
		expect(i18n.t("runtimeFallback.openMenu")).toBe("runtimeFallback.openMenu");
	});

	it("keeps list translations empty when no real translation exists", () => {
		const toArray = get(trArray);
		expect(toArray("runtimeFallback.avgTime")).toEqual([]);
	});

	it("applies detected Obsidian language only after stable consecutive detections", () => {
		applyPluginUiLanguagePreference("auto");
		window.localStorage.setItem("language", "zh");

		syncI18nWithObsidianLanguage();
		expect(i18n.getCurrentLanguage()).toBe("en-US");

		syncI18nWithObsidianLanguage();
		expect(i18n.getCurrentLanguage()).toBe("zh-CN");
	});

	it("detects additive host languages when preference is auto", () => {
		applyPluginUiLanguagePreference("auto");

		window.localStorage.setItem("language", "ja");
		syncI18nWithObsidianLanguage();
		syncI18nWithObsidianLanguage();
		expect(i18n.getCurrentLanguage()).toBe("ja-JP");

		window.localStorage.setItem("language", "ko-KR");
		syncI18nWithObsidianLanguage();
		syncI18nWithObsidianLanguage();
		expect(i18n.getCurrentLanguage()).toBe("ko-KR");

		window.localStorage.setItem("language", "ru");
		syncI18nWithObsidianLanguage();
		syncI18nWithObsidianLanguage();
		expect(i18n.getCurrentLanguage()).toBe("ru-RU");

		window.localStorage.setItem("language", "zh-TW");
		syncI18nWithObsidianLanguage();
		syncI18nWithObsidianLanguage();
		expect(i18n.getCurrentLanguage()).toBe("zh-TW");
	});

	it("keeps pinned plugin ui language when preference is not auto", () => {
		applyPluginUiLanguagePreference("en-US");
		window.localStorage.setItem("language", "zh");

		syncI18nWithObsidianLanguage();
		syncI18nWithObsidianLanguage();

		expect(shouldFollowObsidianUiLanguage()).toBe(false);
		expect(i18n.getCurrentLanguage()).toBe("en-US");
		expect(i18n.t("irDataMgmt.title")).toBe(
			"Incremental Reading Data Management",
		);
	});

	it("keeps catalog leaf key parity across all supported languages", () => {
		const enKeys = flattenTranslationLeafKeys(translationCatalog["en-US"]).sort();
		for (const language of SUPPORTED_LANGUAGES) {
			const keys = flattenTranslationLeafKeys(translationCatalog[language]).sort();
			expect(keys).toEqual(enKeys);
		}
	});

	it("keeps placeholder tokens aligned for additive locales", () => {
		const extract = (text: string): string =>
			[...text.matchAll(/\{(\w+)\}/g)]
				.map((match) => match[1]!)
				.sort()
				.join(",");

		const enFlat = flattenTranslationTree(translationCatalog["en-US"]);
		const additive = ["ja-JP", "ko-KR", "ru-RU", "zh-TW"] as const;
		const mismatches: string[] = [];

		for (const language of additive) {
			const flat = flattenTranslationTree(translationCatalog[language]);
			for (const [key, enText] of Object.entries(enFlat)) {
				if (extract(enText) !== extract(flat[key] ?? "")) {
					mismatches.push(`${language}:${key}`);
				}
			}
		}

		expect(mismatches).toEqual([]);
	});

	it("serves additive locale strings when language is pinned", () => {
		applyPluginUiLanguagePreference("ja-JP");
		expect(i18n.t("common.close")).toBe("閉じる");

		applyPluginUiLanguagePreference("ko-KR");
		expect(i18n.t("common.close")).toBe("닫기");

		applyPluginUiLanguagePreference("ru-RU");
		expect(i18n.t("common.close")).toBe("Закрыть");

		applyPluginUiLanguagePreference("zh-TW");
		expect(i18n.t("common.close")).toBe("關閉");
	});
});
