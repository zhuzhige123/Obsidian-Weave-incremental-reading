import { get } from "svelte/store";

import {
	applyPluginUiLanguagePreference,
	i18n,
	shouldFollowObsidianUiLanguage,
	syncI18nWithObsidianLanguage,
	trArray,
} from "../i18n";

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
});
