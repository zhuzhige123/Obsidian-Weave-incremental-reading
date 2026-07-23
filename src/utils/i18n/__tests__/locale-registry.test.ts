import { describe, expect, it } from "vitest";

import {
	getLocaleFallback,
	isSupportedLanguage,
	normalizePluginUiLanguagePreference,
	resolveHostLanguage,
	SUPPORTED_LANGUAGES,
} from "../locale-registry";

describe("locale-registry", () => {
	it("lists all supported languages including additive locales", () => {
		expect(SUPPORTED_LANGUAGES).toEqual([
			"zh-CN",
			"zh-TW",
			"en-US",
			"ja-JP",
			"ko-KR",
			"ru-RU",
		]);
	});

	it("maps host language tags to supported locales", () => {
		expect(resolveHostLanguage("zh-TW")).toBe("zh-TW");
		expect(resolveHostLanguage("zh-HK")).toBe("zh-TW");
		expect(resolveHostLanguage("zh-Hant")).toBe("zh-TW");
		expect(resolveHostLanguage("zh-CN")).toBe("zh-CN");
		expect(resolveHostLanguage("zh")).toBe("zh-CN");
		expect(resolveHostLanguage("ja")).toBe("ja-JP");
		expect(resolveHostLanguage("ja-JP")).toBe("ja-JP");
		expect(resolveHostLanguage("ko")).toBe("ko-KR");
		expect(resolveHostLanguage("ko-KR")).toBe("ko-KR");
		expect(resolveHostLanguage("ru")).toBe("ru-RU");
		expect(resolveHostLanguage("ru-RU")).toBe("ru-RU");
		expect(resolveHostLanguage("en")).toBe("en-US");
		expect(resolveHostLanguage("fr")).toBe("en-US");
		expect(resolveHostLanguage(null)).toBeNull();
	});

	it("uses per-locale fallback chains", () => {
		expect(getLocaleFallback("zh-CN")).toBeNull();
		expect(getLocaleFallback("zh-TW")).toBe("zh-CN");
		expect(getLocaleFallback("ja-JP")).toBe("en-US");
		expect(getLocaleFallback("ko-KR")).toBe("en-US");
		expect(getLocaleFallback("ru-RU")).toBe("en-US");
		expect(getLocaleFallback("en-US")).toBe("zh-CN");
	});

	it("normalizes plugin UI language preferences", () => {
		expect(normalizePluginUiLanguagePreference("ja-JP")).toBe("ja-JP");
		expect(normalizePluginUiLanguagePreference("zh-TW")).toBe("zh-TW");
		expect(normalizePluginUiLanguagePreference("nope")).toBe("auto");
		expect(isSupportedLanguage("ru-RU")).toBe(true);
		expect(isSupportedLanguage("pt-BR")).toBe(false);
	});
});
