import { describe, expect, it } from "vitest";
import {
	IR_TUTORIAL_CONTENT_BY_LANG,
	IR_TUTORIAL_TAB_IDS,
	IR_TUTORIAL_TABS_BY_LANG,
} from "../ir-tutorial-content";
import enUSTutorial from "../tutorial-locales/en-US.json";
import jaJPTutorial from "../tutorial-locales/ja-JP.json";
import koKRTutorial from "../tutorial-locales/ko-KR.json";
import ruRUTutorial from "../tutorial-locales/ru-RU.json";
import zhCNTutorial from "../tutorial-locales/zh-CN.json";
import zhTWTutorial from "../tutorial-locales/zh-TW.json";

const LOCALIZED_LANGS = ["zh-TW", "ja-JP", "ko-KR", "ru-RU"] as const;

function sectionCount(
	lang: (typeof LOCALIZED_LANGS)[number] | "en-US" | "zh-CN",
): number {
	return IR_TUTORIAL_TAB_IDS.reduce(
		(total, tabId) => total + IR_TUTORIAL_CONTENT_BY_LANG[lang][tabId].length,
		0,
	);
}

describe("IR tutorial locales", () => {
	it("keeps the same tab structure across languages", () => {
		for (const lang of [
			"zh-CN",
			"zh-TW",
			"en-US",
			"ja-JP",
			"ko-KR",
			"ru-RU",
		] as const) {
			expect(Object.keys(IR_TUTORIAL_CONTENT_BY_LANG[lang]).sort()).toEqual(
				[...IR_TUTORIAL_TAB_IDS].sort(),
			);
			expect(IR_TUTORIAL_TABS_BY_LANG[lang]).toHaveLength(
				IR_TUTORIAL_TAB_IDS.length,
			);
		}
	});

	it("ships authored bodies for every supported language", () => {
		expect(zhCNTutorial.basics[0]?.title).toContain("插件");
		expect(zhTWTutorial.basics[0]?.title).toContain("外掛");
		expect(enUSTutorial.basics[0]?.title).toMatch(/What this plugin/i);
		expect(jaJPTutorial.basics[0]?.title).toMatch(/プラグイン/);
		expect(koKRTutorial.basics[0]?.title).toMatch(/플러그인/);
		expect(ruRUTutorial.basics[0]?.title).toMatch(/плагин/i);
		expect(IR_TUTORIAL_CONTENT_BY_LANG["zh-TW"]).not.toBe(
			IR_TUTORIAL_CONTENT_BY_LANG["zh-CN"],
		);
		expect(IR_TUTORIAL_CONTENT_BY_LANG["ja-JP"]).not.toBe(
			IR_TUTORIAL_CONTENT_BY_LANG["en-US"],
		);
		expect(IR_TUTORIAL_CONTENT_BY_LANG["ko-KR"]).not.toBe(
			IR_TUTORIAL_CONTENT_BY_LANG["en-US"],
		);
		expect(IR_TUTORIAL_CONTENT_BY_LANG["ru-RU"]).not.toBe(
			IR_TUTORIAL_CONTENT_BY_LANG["en-US"],
		);
	});

	it("aligns localized section counts with English", () => {
		const englishCount = sectionCount("en-US");
		expect(sectionCount("zh-CN")).toBe(englishCount);
		for (const lang of LOCALIZED_LANGS) {
			expect(sectionCount(lang)).toBe(englishCount);
		}
	});

	it("keeps localized tab labels for non-English locales", () => {
		expect(IR_TUTORIAL_TABS_BY_LANG["zh-CN"][0]?.label).toBe("入门概览");
		expect(IR_TUTORIAL_TABS_BY_LANG["zh-TW"][0]?.label).toBe("入門概覽");
		expect(IR_TUTORIAL_TABS_BY_LANG["ja-JP"][0]?.label).toBe("概要");
		expect(IR_TUTORIAL_TABS_BY_LANG["ko-KR"][0]?.label).toMatch(
			/[\uac00-\ud7af]/,
		);
		expect(IR_TUTORIAL_TABS_BY_LANG["ru-RU"][0]?.label).toMatch(
			/[\u0400-\u04FF]/,
		);
	});

	it("preserves data-path code blocks across authored locales", () => {
		const englishCode = enUSTutorial.data.find((section) => section.code)?.code;
		expect(englishCode).toContain("points/");
		for (const lang of [
			"zh-CN",
			"zh-TW",
			"ja-JP",
			"ko-KR",
			"ru-RU",
		] as const) {
			const localizedCode = IR_TUTORIAL_CONTENT_BY_LANG[lang].data.find(
				(section) => section.code,
			)?.code;
			expect(localizedCode).toBe(englishCode);
		}
	});
});
