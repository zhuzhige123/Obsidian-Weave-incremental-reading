/**
 * 统一的卡片题型定义系统
 * 替代分散在各处的题型定义，提供统一的标准
 */

/**
 * 统一的卡片题型枚举
 */
export enum UnifiedCardType {
	/** 基础问答题 - 上方问题，下方答案 */
	BASIC_QA = "basic-qa",

	/** 单选题 - 问题+选项，只有一个正确答案 */
	SINGLE_CHOICE = "single-choice",

	/** 多选题 - 问题+选项，有多个正确答案 */
	MULTIPLE_CHOICE = "multiple-choice",

	/** 挖空题 - 原位显示隐藏内容 */
	CLOZE_DELETION = "cloze-deletion",

	/** 填空题 - 输入框填写答案 */
	FILL_IN_BLANK = "fill-in-blank",

	/** 顺序题 - 按顺序显示内容 */
	SEQUENCE = "sequence",

	/** 可扩展题型 - 支持插件扩展 */
	EXTENSIBLE = "extensible",
}

/**
 * 题型显示模式
 */
export enum DisplayMode {
	/** 上下分离 - 问题在上，答案在下 */
	VERTICAL_SPLIT = "vertical-split",

	/** 原位显示 - 答案在原文位置显示 */
	INLINE = "inline",

	/** 交互式 - 需要用户交互才显示答案 */
	INTERACTIVE = "interactive",

	/** 渐进式 - 逐步显示内容 */
	PROGRESSIVE = "progressive",
}

/**
 * 交互模式
 */
export enum InteractionMode {
	/** 点击显示 - 点击后显示答案 */
	CLICK_REVEAL = "click-reveal",

	/** 选择模式 - 选择选项 */
	SELECT = "select",

	/** 输入模式 - 输入答案 */
	INPUT = "input",

	/** 拖拽模式 - 拖拽排序 */
	DRAG = "drag",

	/** 自动模式 - 自动显示 */
	AUTO = "auto",
}

/**
 * 渲染提示
 */
export interface RenderingHints {
	/** 问题位置 */
	questionPosition: "top" | "inline" | "overlay";

	/** 答案显示方式 */
	answerReveal: "click" | "auto" | "manual" | "progressive";

	/** 交互模式 */
	interactionMode: InteractionMode;

	/** 显示进度 */
	showProgress: boolean;

	/** 启用动画 */
	enableAnimations: boolean;

	/** 支持键盘导航 */
	keyboardNavigation: boolean;

	/** 自动聚焦 */
	autoFocus: boolean;
}

/**
 * 题型元数据
 */
export interface CardTypeMetadata {
	/** 题型ID */
	id: UnifiedCardType;

	/** 题型名称 */
	name: string;

	/** 题型描述 */
	description: string;

	/** 显示模式 */
	displayMode: DisplayMode;

	/** 渲染提示 */
	renderingHints: RenderingHints;

	/** 支持的字段 */
	supportedFields: string[];

	/** 是否支持多媒体 */
	supportsMedia: boolean;

	/** 是否支持数学公式 */
	supportsMath: boolean;

	/** 是否支持代码高亮 */
	supportsCode: boolean;
}

/**
 * 题型检测结果
 */
export interface CardTypeDetectionResult {
	/** 检测到的题型 */
	cardType: UnifiedCardType;

	/** 置信度 (0-1) */
	confidence: number;

	/** 检测到的特征 */
	features: string[];

	/** 检测器ID */
	detectorId: string;

	/** 额外元数据 */
	metadata?: Record<string, unknown>;
}

/**
 * 题型转换映射
 */
export interface CardTypeMapping {
	/** 旧题型标识 */
	from: string;

	/** 新题型标识 */
	to: UnifiedCardType;

	/** 转换置信度 */
	confidence: number;

	/** 是否需要手动确认 */
	requiresConfirmation: boolean;
}

/**
 * 预定义的题型元数据
 */
export const CARD_TYPE_METADATA: Record<UnifiedCardType, CardTypeMetadata> = {
	[UnifiedCardType.BASIC_QA]: {
		id: UnifiedCardType.BASIC_QA,
		name: "问答题",
		description: "基础问答卡片，上方显示问题，下方显示答案",
		displayMode: DisplayMode.VERTICAL_SPLIT,
		renderingHints: {
			questionPosition: "top",
			answerReveal: "click",
			interactionMode: InteractionMode.CLICK_REVEAL,
			showProgress: false,
			enableAnimations: true,
			keyboardNavigation: true,
			autoFocus: false,
		},
		supportedFields: ["question", "answer", "hint", "explanation"],
		supportsMedia: true,
		supportsMath: true,
		supportsCode: true,
	},

	[UnifiedCardType.SINGLE_CHOICE]: {
		id: UnifiedCardType.SINGLE_CHOICE,
		name: "单选题",
		description: "单选题卡片，显示问题和选项，只有一个正确答案",
		displayMode: DisplayMode.INTERACTIVE,
		renderingHints: {
			questionPosition: "top",
			answerReveal: "auto",
			interactionMode: InteractionMode.SELECT,
			showProgress: true,
			enableAnimations: true,
			keyboardNavigation: true,
			autoFocus: true,
		},
		supportedFields: ["question", "options", "correct_answer", "explanation"],
		supportsMedia: true,
		supportsMath: true,
		supportsCode: false,
	},

	[UnifiedCardType.MULTIPLE_CHOICE]: {
		id: UnifiedCardType.MULTIPLE_CHOICE,
		name: "多选题",
		description: "多选题卡片，显示问题和选项，有多个正确答案",
		displayMode: DisplayMode.INTERACTIVE,
		renderingHints: {
			questionPosition: "top",
			answerReveal: "auto",
			interactionMode: InteractionMode.SELECT,
			showProgress: true,
			enableAnimations: true,
			keyboardNavigation: true,
			autoFocus: true,
		},
		supportedFields: ["question", "options", "correct_answers", "explanation"],
		supportsMedia: true,
		supportsMath: true,
		supportsCode: false,
	},

	[UnifiedCardType.CLOZE_DELETION]: {
		id: UnifiedCardType.CLOZE_DELETION,
		name: "挖空题",
		description: "挖空卡片，在原文位置隐藏部分内容，点击显示答案",
		displayMode: DisplayMode.INLINE,
		renderingHints: {
			questionPosition: "inline",
			answerReveal: "click",
			interactionMode: InteractionMode.CLICK_REVEAL,
			showProgress: true,
			enableAnimations: true,
			keyboardNavigation: true,
			autoFocus: false,
		},
		supportedFields: ["content", "cloze", "hint"],
		supportsMedia: true,
		supportsMath: true,
		supportsCode: true,
	},

	[UnifiedCardType.FILL_IN_BLANK]: {
		id: UnifiedCardType.FILL_IN_BLANK,
		name: "填空题",
		description: "填空卡片，提供输入框让用户填写答案",
		displayMode: DisplayMode.INTERACTIVE,
		renderingHints: {
			questionPosition: "top",
			answerReveal: "manual",
			interactionMode: InteractionMode.INPUT,
			showProgress: true,
			enableAnimations: true,
			keyboardNavigation: true,
			autoFocus: true,
		},
		supportedFields: ["question", "blanks", "answers", "hint"],
		supportsMedia: true,
		supportsMath: true,
		supportsCode: false,
	},

	[UnifiedCardType.SEQUENCE]: {
		id: UnifiedCardType.SEQUENCE,
		name: "顺序题",
		description: "顺序卡片，按顺序逐步显示内容",
		displayMode: DisplayMode.PROGRESSIVE,
		renderingHints: {
			questionPosition: "top",
			answerReveal: "progressive",
			interactionMode: InteractionMode.CLICK_REVEAL,
			showProgress: true,
			enableAnimations: true,
			keyboardNavigation: true,
			autoFocus: false,
		},
		supportedFields: ["title", "steps", "conclusion"],
		supportsMedia: true,
		supportsMath: true,
		supportsCode: true,
	},

	[UnifiedCardType.EXTENSIBLE]: {
		id: UnifiedCardType.EXTENSIBLE,
		name: "扩展题型",
		description: "可扩展的自定义题型",
		displayMode: DisplayMode.INTERACTIVE,
		renderingHints: {
			questionPosition: "top",
			answerReveal: "manual",
			interactionMode: InteractionMode.AUTO,
			showProgress: false,
			enableAnimations: true,
			keyboardNavigation: true,
			autoFocus: false,
		},
		supportedFields: ["content"],
		supportsMedia: true,
		supportsMath: true,
		supportsCode: true,
	},
};

/**
 * 题型转换映射表
 */
export const CARD_TYPE_MAPPINGS: CardTypeMapping[] = [
	// 旧系统映射
	{ from: "basic", to: UnifiedCardType.BASIC_QA, confidence: 1.0, requiresConfirmation: false },
	{ from: "qa", to: UnifiedCardType.BASIC_QA, confidence: 1.0, requiresConfirmation: false },
	{
		from: "cloze",
		to: UnifiedCardType.CLOZE_DELETION,
		confidence: 1.0,
		requiresConfirmation: false,
	},
	{
		from: "multiple",
		to: UnifiedCardType.MULTIPLE_CHOICE,
		confidence: 1.0,
		requiresConfirmation: false,
	},
	{
		from: "mcq",
		to: UnifiedCardType.MULTIPLE_CHOICE,
		confidence: 1.0,
		requiresConfirmation: false,
	},
	{
		from: "single",
		to: UnifiedCardType.SINGLE_CHOICE,
		confidence: 1.0,
		requiresConfirmation: false,
	},
	{
		from: "choice",
		to: UnifiedCardType.SINGLE_CHOICE,
		confidence: 0.9,
		requiresConfirmation: false,
	},
	{ from: "code", to: UnifiedCardType.BASIC_QA, confidence: 0.8, requiresConfirmation: true },

	// ContentPreviewEngine映射
	{ from: "basic-qa", to: UnifiedCardType.BASIC_QA, confidence: 1.0, requiresConfirmation: false },
	{
		from: "single-choice",
		to: UnifiedCardType.SINGLE_CHOICE,
		confidence: 1.0,
		requiresConfirmation: false,
	},
	{
		from: "multiple-choice",
		to: UnifiedCardType.MULTIPLE_CHOICE,
		confidence: 1.0,
		requiresConfirmation: false,
	},
	{
		from: "cloze-deletion",
		to: UnifiedCardType.CLOZE_DELETION,
		confidence: 1.0,
		requiresConfirmation: false,
	},
	{
		from: "extensible",
		to: UnifiedCardType.EXTENSIBLE,
		confidence: 1.0,
		requiresConfirmation: false,
	},
];

/**
 * 获取题型元数据
 */
export function getCardTypeMetadata(cardType: UnifiedCardType): CardTypeMetadata {
	return CARD_TYPE_METADATA[cardType];
}

/**
 * 获取题型名称
 */
export function getCardTypeName(cardType: UnifiedCardType): string {
	return CARD_TYPE_METADATA[cardType]?.name || "未知题型";
}

/**
 * 获取题型图标
 */
export function getCardTypeIcon(cardType: UnifiedCardType): string {
	switch (cardType) {
		case UnifiedCardType.BASIC_QA:
			return "💬";
		case UnifiedCardType.SINGLE_CHOICE:
			return "📝";
		case UnifiedCardType.MULTIPLE_CHOICE:
			return "☑️";
		case UnifiedCardType.CLOZE_DELETION:
			return "✏️";
		case UnifiedCardType.FILL_IN_BLANK:
			return "✍️";
		case UnifiedCardType.SEQUENCE:
			return "📋";
		case UnifiedCardType.EXTENSIBLE:
			return "🔧";
		default:
			return "❓";
	}
}

/**
 * 转换旧题型到新题型
 */
export function convertCardType(oldType: string): UnifiedCardType {
	const mapping = CARD_TYPE_MAPPINGS.find((m) => m.from === oldType);
	return mapping?.to || UnifiedCardType.BASIC_QA;
}

/**
 * 检查题型是否支持特定功能
 */
export function supportsFeature(
	cardType: UnifiedCardType,
	feature: "media" | "math" | "code"
): boolean {
	const metadata = CARD_TYPE_METADATA[cardType];
	if (!metadata) return false;

	switch (feature) {
		case "media":
			return metadata.supportsMedia;
		case "math":
			return metadata.supportsMath;
		case "code":
			return metadata.supportsCode;
		default:
			return false;
	}
}
