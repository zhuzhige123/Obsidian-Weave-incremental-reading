import { getLanguage } from "obsidian";
import { derived, get, writable } from "svelte/store";
import { logger } from "../utils/logger";
import { vaultStorage } from "../utils/vault-local-storage";
import { applyFlatOverlay } from "./i18n/hydrate-locale";
import {
	type PluginUiLanguagePreference,
	SUPPORTED_LANGUAGES,
	getLocaleFallback,
	normalizePluginUiLanguagePreference,
	resolveHostLanguage,
} from "./i18n/locale-registry";
import jaJpFlat from "./i18n/locales/ja-JP.json";
import koKrFlat from "./i18n/locales/ko-KR.json";
import ruRuFlat from "./i18n/locales/ru-RU.json";
import zhTwFlat from "./i18n/locales/zh-TW.json";
import { translationOverrides, translations } from "./i18n/resources";
import type {
	I18nConfig,
	SupportedLanguage,
	TranslationKey,
} from "./i18n/types";
import { isRecord } from "./unknown-record";

export type {
	I18nConfig,
	SupportedLanguage,
	TranslationKey,
} from "./i18n/types";
export type { PluginUiLanguagePreference } from "./i18n/plugin-ui-language";
export {
	LANGUAGE_OPTION_LABEL_KEYS,
	normalizePluginUiLanguagePreference,
	PLUGIN_UI_LANGUAGE_OPTIONS,
	SUPPORTED_LANGUAGES,
} from "./i18n/plugin-ui-language";

function isTranslationBranch(
	value: string | TranslationKey | undefined,
): value is TranslationKey {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeTranslationTrees(
	base: TranslationKey,
	override?: TranslationKey,
): TranslationKey {
	if (!override) {
		return { ...base };
	}

	const merged: TranslationKey = { ...base };

	for (const [key, overrideValue] of Object.entries(override)) {
		const baseValue = merged[key];

		if (isTranslationBranch(baseValue) && isTranslationBranch(overrideValue)) {
			merged[key] = mergeTranslationTrees(baseValue, overrideValue);
			continue;
		}

		merged[key] = overrideValue;
	}

	return merged;
}

const zhCnMerged = mergeTranslationTrees(
	translations["zh-CN"],
	translationOverrides["zh-CN"],
);
const enUsMerged = mergeTranslationTrees(
	translations["en-US"],
	translationOverrides["en-US"],
);

export const translationCatalog: Record<SupportedLanguage, TranslationKey> = {
	"zh-CN": zhCnMerged,
	"en-US": enUsMerged,
	"ja-JP": applyFlatOverlay(enUsMerged, jaJpFlat as Record<string, string>),
	"ko-KR": applyFlatOverlay(enUsMerged, koKrFlat as Record<string, string>),
	"ru-RU": applyFlatOverlay(enUsMerged, ruRuFlat as Record<string, string>),
	"zh-TW": applyFlatOverlay(zhCnMerged, zhTwFlat as Record<string, string>),
};

export function flattenTranslationLeafKeys(
	tree: TranslationKey,
	prefix = "",
): string[] {
	return Object.entries(tree).flatMap(([key, value]) => {
		const nextKey = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "string") {
			return [nextKey];
		}
		return flattenTranslationLeafKeys(value, nextKey);
	});
}

const defaultConfig: I18nConfig = {
	defaultLanguage: "zh-CN",
	fallbackLanguage: "zh-CN",
	supportedLanguages: [...SUPPORTED_LANGUAGES],
};

const translationKeyAliases: Record<string, string> = {};

const translationAliasSuffixes = [
	["Label", "label"],
	["Desc", "description"],
	["Description", "description"],
	["Placeholder", "placeholder"],
	["Title", "title"],
	["Button", "button"],
	["Help", "help"],
	["Error", "error"],
	["Success", "success"],
	["Warning", "warning"],
	["Info", "info"],
] as const;

function getTranslationAliasCandidates(key: string): string[] {
	const candidates = new Set<string>();
	const directAlias = translationKeyAliases[key];

	if (directAlias) {
		candidates.add(directAlias);
	}

	const parts = key.split(".");
	const lastSegment = parts.at(-1) ?? "";

	for (const [suffix, targetSegment] of translationAliasSuffixes) {
		if (!lastSegment.endsWith(suffix) || lastSegment.length <= suffix.length) {
			continue;
		}

		const baseSegment = lastSegment.slice(0, -suffix.length);
		const normalizedBase = `${baseSegment
			.charAt(0)
			.toLowerCase()}${baseSegment.slice(1)}`;
		candidates.add(
			[...parts.slice(0, -1), normalizedBase, targetSegment].join("."),
		);
		candidates.add([...parts.slice(0, -1), normalizedBase].join("."));

		if (targetSegment === "description") {
			candidates.add([...parts.slice(0, -1), normalizedBase, "desc"].join("."));
		}
	}

	if (
		lastSegment === "connected" ||
		lastSegment === "disconnected" ||
		lastSegment === "testing"
	) {
		candidates.add(
			[...parts.slice(0, -1), "statusLabel", lastSegment].join("."),
		);
		candidates.add([...parts.slice(0, -1), "status", lastSegment].join("."));
	}

	if (key.includes(".endpoint")) {
		candidates.add(key.replace(".endpoint", ".address"));
	}

	return [...candidates];
}

/**
 * 检测 Obsidian 宿主语言并映射到插件支持的语言。
 */
function detectObsidianLanguage(): SupportedLanguage {
	try {
		let obsidianLang: string | null = null;
		try {
			const hostLanguage = getLanguage();
			obsidianLang = hostLanguage ? String(hostLanguage).trim() : null;
		} catch {
			// 非 Obsidian 宿主（测试 / 构建工具）时回退到 vaultStorage。
		}

		if (!obsidianLang) {
			obsidianLang = vaultStorage.getItem("language");
		}

		const fromHost = resolveHostLanguage(obsidianLang);
		if (fromHost) {
			return fromHost;
		}

		const momentLocale = window.moment?.locale?.() as string | undefined;
		const fromMoment = resolveHostLanguage(momentLocale);
		if (fromMoment) {
			return fromMoment;
		}

		const fromDocument = resolveHostLanguage(
			window?.document?.documentElement?.lang,
		);
		if (fromDocument) {
			return fromDocument;
		}

		const fromBrowser = resolveHostLanguage(window?.navigator?.language);
		if (fromBrowser) {
			return fromBrowser;
		}

		return defaultConfig.defaultLanguage;
	} catch {
		return defaultConfig.defaultLanguage;
	}
}

export const currentLanguage = writable<SupportedLanguage>(
	defaultConfig.defaultLanguage,
);
let pluginUiLanguagePreference: PluginUiLanguagePreference = "auto";
let lastDetectedLanguage: SupportedLanguage | null = null;
let stableDetectionCount = 0;
const REQUIRED_STABLE_DETECTIONS = 2;

export function getPluginUiLanguagePreference(): PluginUiLanguagePreference {
	return pluginUiLanguagePreference;
}

export function shouldFollowObsidianUiLanguage(): boolean {
	return pluginUiLanguagePreference === "auto";
}

export function applyPluginUiLanguagePreference(
	preference: unknown,
): SupportedLanguage {
	pluginUiLanguagePreference = normalizePluginUiLanguagePreference(preference);
	const resolvedLanguage =
		pluginUiLanguagePreference === "auto"
			? detectObsidianLanguage()
			: pluginUiLanguagePreference;
	currentLanguage.set(resolvedLanguage);
	lastDetectedLanguage = resolvedLanguage;
	stableDetectionCount = REQUIRED_STABLE_DETECTIONS;
	return resolvedLanguage;
}

export function syncI18nWithObsidianLanguage(): SupportedLanguage {
	if (!shouldFollowObsidianUiLanguage()) {
		return get(currentLanguage);
	}

	const detectedLang = detectObsidianLanguage();
	if (lastDetectedLanguage === detectedLang) {
		stableDetectionCount += 1;
	} else {
		lastDetectedLanguage = detectedLang;
		stableDetectionCount = 1;
	}

	if (
		stableDetectionCount >= REQUIRED_STABLE_DETECTIONS &&
		get(currentLanguage) !== detectedLang
	) {
		currentLanguage.set(detectedLang);
	}
	return detectedLang;
}

/**
 * 初始化国际化系统 - 检测Obsidian语言并设置
 * 应在插件onload时调用
 */
export function initI18n(): void {
	syncI18nWithObsidianLanguage();
}
export const i18nConfig = writable<I18nConfig>(defaultConfig);

export class I18nService {
	private static instance: I18nService;
	private currentLang: SupportedLanguage = defaultConfig.defaultLanguage;
	private config: I18nConfig = defaultConfig;
	private readonly missingKeyWarnings = new Set<string>();

	private constructor() {
		currentLanguage.subscribe((_lang) => {
			this.currentLang = _lang;
		});

		i18nConfig.subscribe((_config) => {
			this.config = _config;
		});
	}

	static getInstance(): I18nService {
		if (!I18nService.instance) {
			I18nService.instance = new I18nService();
		}
		return I18nService.instance;
	}

	t(key: string, params?: Record<string, string | number>): string {
		const translation = this.resolveTranslation(key, this.currentLang);

		if (!translation) {
			const fallbackLang = getLocaleFallback(this.currentLang);
			const fallbackTranslation = fallbackLang
				? this.resolveTranslation(key, fallbackLang)
				: null;
			if (fallbackTranslation) {
				return this.interpolate(fallbackTranslation, params);
			}

			if (!this.missingKeyWarnings.has(key)) {
				this.missingKeyWarnings.add(key);
				logger.warn(
					`Translation not found for key: ${key} (lang: ${this.currentLang}, fallback: ${fallbackLang ?? "none"})`,
				);
			}

			return key;
		}

		return this.interpolate(translation, params);
	}

	hasTranslation(key: string): boolean {
		if (this.resolveTranslation(key, this.currentLang)) {
			return true;
		}
		const fallbackLang = getLocaleFallback(this.currentLang);
		return Boolean(
			fallbackLang && this.resolveTranslation(key, fallbackLang),
		);
	}

	private resolveTranslation(
		key: string,
		language: SupportedLanguage,
	): string | null {
		const directTranslation = this.getDirectTranslation(key, language);
		if (directTranslation) {
			return directTranslation;
		}

		for (const aliasKey of getTranslationAliasCandidates(key)) {
			const aliasTranslation = this.getDirectTranslation(aliasKey, language);
			if (aliasTranslation) {
				return aliasTranslation;
			}
		}

		return null;
	}

	private getDirectTranslation(
		key: string,
		language: SupportedLanguage,
	): string | null {
		const keys = key.split(".");
		let current: unknown = translationCatalog[language];

		for (const k of keys) {
			if (isRecord(current) && k in current) {
				current = current[k];
			} else {
				return null;
			}
		}

		return typeof current === "string" ? current : null;
	}

	private interpolate(
		text: string,
		params?: Record<string, string | number>,
	): string {
		if (!params) return text;

		return text.replace(/\{(\w+)\}/g, (match, key: string) => {
			if (!(key in params)) {
				return match;
			}
			const value = params[key];
			return value !== undefined ? String(value) : match;
		});
	}

	setLanguage(language: SupportedLanguage): void {
		if (this.config.supportedLanguages.includes(language)) {
			currentLanguage.set(language);
		} else {
			logger.warn(`Unsupported language: ${language}`);
		}
	}

	getCurrentLanguage(): SupportedLanguage {
		return this.currentLang;
	}

	getSupportedLanguages(): SupportedLanguage[] {
		return this.config.supportedLanguages;
	}

	isLanguageSupported(language: string): language is SupportedLanguage {
		return this.config.supportedLanguages.includes(
			language as SupportedLanguage,
		);
	}
}

export const i18n = I18nService.getInstance();

export const t = (key: string, params?: Record<string, string | number>) =>
	i18n.t(key, params);

export const tr = derived(
	currentLanguage,
	(_$currentLanguage) =>
		(key: string, params?: Record<string, string | number>) =>
			i18n.t(key, params),
);

export const trArray = derived(currentLanguage, (_$currentLanguage) =>
	(key: string): string[] => {
		if (!i18n.hasTranslation(key)) return [];
		const text = i18n.t(key);
		if (!text) return [];
		return text
			.split("\n")
			.map((item) => item.trim())
			.filter(Boolean);
	});
