export type IRTutorialTabId =
	| "basics"
	| "add"
	| "import"
	| "trace"
	| "data"
	| "family";

export interface IRTutorialTab {
	id: IRTutorialTabId;
	label: string;
}

export interface IRTutorialListGroup {
	heading?: string;
	items: string[];
}

export interface IRTutorialButtonItem {
	icon: string;
	label: string;
	description: string;
}

export interface IRTutorialLinkItem {
	label: string;
	url: string;
}

export interface IRTutorialSection {
	title: string;
	paragraphs?: string[];
	listGroups?: IRTutorialListGroup[];
	code?: string;
	buttons?: IRTutorialButtonItem[];
	links?: IRTutorialLinkItem[];
}

import type { SupportedLanguage } from "../../../utils/i18n";
import zhCNTutorial from "./tutorial-locales/zh-CN.json";
import zhTWTutorial from "./tutorial-locales/zh-TW.json";
import enUSTutorial from "./tutorial-locales/en-US.json";
import jaJPTutorial from "./tutorial-locales/ja-JP.json";
import koKRTutorial from "./tutorial-locales/ko-KR.json";
import ruRUTutorial from "./tutorial-locales/ru-RU.json";

export type IRTutorialLanguage = SupportedLanguage;

export type IRTutorialContentByTab = Record<IRTutorialTabId, IRTutorialSection[]>;

export const IR_TUTORIAL_TAB_IDS: readonly IRTutorialTabId[] = [
	"basics",
	"add",
	"import",
	"trace",
	"data",
	"family",
] as const;

/** First-open default: the path users most often misunderstand. */
export const IR_TUTORIAL_DEFAULT_TAB: IRTutorialTabId = "add";

export function resolveIRTutorialLanguage(
	language: SupportedLanguage,
): IRTutorialLanguage {
	return language;
}

export const IR_TUTORIAL_TABS_BY_LANG: Record<IRTutorialLanguage, IRTutorialTab[]> =
	{
		"zh-CN": [
			{ id: "basics", label: "入门概览" },
			{ id: "add", label: "添加阅读点" },
			{ id: "import", label: "材料导入" },
			{ id: "trace", label: "来源与溯源" },
			{ id: "data", label: "数据与路径" },
			{ id: "family", label: "Weave 系列" },
		],
		"zh-TW": [
			{ id: "basics", label: "入門概覽" },
			{ id: "add", label: "新增閱讀點" },
			{ id: "import", label: "材料匯入" },
			{ id: "trace", label: "來源與溯源" },
			{ id: "data", label: "資料與路徑" },
			{ id: "family", label: "Weave 系列" },
		],
		"en-US": [
			{ id: "basics", label: "Overview" },
			{ id: "add", label: "Add points" },
			{ id: "import", label: "Import" },
			{ id: "trace", label: "Sources" },
			{ id: "data", label: "Data" },
			{ id: "family", label: "Weave family" },
		],
		"ja-JP": [
			{ id: "basics", label: "概要" },
			{ id: "add", label: "追加" },
			{ id: "import", label: "インポート" },
			{ id: "trace", label: "ソース" },
			{ id: "data", label: "データ" },
			{ id: "family", label: "Weave シリーズ" },
		],
		"ko-KR": [
			{ id: "basics", label: "개요" },
			{ id: "add", label: "추가" },
			{ id: "import", label: "가져오기" },
			{ id: "trace", label: "출처" },
			{ id: "data", label: "데이터" },
			{ id: "family", label: "Weave 시리즈" },
		],
		"ru-RU": [
			{ id: "basics", label: "Обзор" },
			{ id: "add", label: "Добавление" },
			{ id: "import", label: "Импорт" },
			{ id: "trace", label: "Источники" },
			{ id: "data", label: "Данные" },
			{ id: "family", label: "Серия Weave" },
		],
	};

/** Authored tutorial bodies for every supported UI language. */
export const IR_TUTORIAL_CONTENT_BY_LANG: Record<
	IRTutorialLanguage,
	IRTutorialContentByTab
> = {
	"zh-CN": zhCNTutorial as IRTutorialContentByTab,
	"zh-TW": zhTWTutorial as IRTutorialContentByTab,
	"en-US": enUSTutorial as IRTutorialContentByTab,
	"ja-JP": jaJPTutorial as IRTutorialContentByTab,
	"ko-KR": koKRTutorial as IRTutorialContentByTab,
	"ru-RU": ruRUTutorial as IRTutorialContentByTab,
};
