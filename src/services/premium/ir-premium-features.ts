/**
 * 独立增量阅读插件使用的高级功能定义（不含主插件记忆卡/题库能力）。
 */
export const IR_PREMIUM_FEATURES = {
	INCREMENTAL_READING: "incremental-reading",
	IMPORT_EXTERNAL_READING_POINTS: "import-external-reading-points",
	ASSOCIATED_NOTES: "associated-notes",
	TAG_GROUPS: "tag-groups",
	SCHEDULING_STRATEGY_SETTINGS: "scheduling-strategy-settings",
	INTERLEAVE_LEARNING_SETTINGS: "interleave-learning-settings",
	ANALYTICS_VIEW: "analytics-view",
	FOLDER_SUBSCRIPTION: "folder-subscription",
	READING_TIMER: "reading-timer",
	CALENDAR_BACKGROUND_WALL: "calendar-background-wall",
} as const;

export type IRPremiumFeatureId = (typeof IR_PREMIUM_FEATURES)[keyof typeof IR_PREMIUM_FEATURES];

export const IR_FEATURE_METADATA: Record<
	IRPremiumFeatureId,
	{ name: string; description: string; icon?: string }
> = {
	[IR_PREMIUM_FEATURES.INCREMENTAL_READING]: {
		name: "渐进性阅读",
		description: "支持增量阅读工作流",
		icon: "book-reader",
	},
	[IR_PREMIUM_FEATURES.IMPORT_EXTERNAL_READING_POINTS]: {
		name: "导入 PDF/EPUB 阅读点",
		description: "从 PDF 与 EPUB 导入章节阅读点",
		icon: "file-plus-2",
	},
	[IR_PREMIUM_FEATURES.ASSOCIATED_NOTES]: {
		name: "关联笔记",
		description: "为阅读点关联、创建并管理笔记",
		icon: "link",
	},
	[IR_PREMIUM_FEATURES.TAG_GROUPS]: {
		name: "标签组",
		description: "启用标签组策略与标签组管理能力",
		icon: "tags",
	},
	[IR_PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS]: {
		name: "调度策略设置",
		description: "配置加工流/阅读清单与调度策略参数",
		icon: "calendar-cog",
	},
	[IR_PREMIUM_FEATURES.INTERLEAVE_LEARNING_SETTINGS]: {
		name: "交错学习",
		description: "配置交错学习与同主题连续上限",
		icon: "shuffle",
	},
	[IR_PREMIUM_FEATURES.ANALYTICS_VIEW]: {
		name: "统计分析视图",
		description: "查看增量阅读分析统计数据",
		icon: "bar-chart-2",
	},
	[IR_PREMIUM_FEATURES.FOLDER_SUBSCRIPTION]: {
		name: "订阅文件夹",
		description: "自动扫描并同步订阅文件夹中的 Markdown",
		icon: "folder-sync",
	},
	[IR_PREMIUM_FEATURES.READING_TIMER]: {
		name: "阅读计时器",
		description: "使用阅读计时与会话累计时长",
		icon: "timer",
	},
	[IR_PREMIUM_FEATURES.CALENDAR_BACKGROUND_WALL]: {
		name: "日历背景墙",
		description: "自定义日历背景墙图片与淡化参数",
		icon: "image",
	},
};

export const IR_PREMIUM_ONLY_FEATURE_IDS = new Set<string>([
	IR_PREMIUM_FEATURES.IMPORT_EXTERNAL_READING_POINTS,
	IR_PREMIUM_FEATURES.ASSOCIATED_NOTES,
	IR_PREMIUM_FEATURES.TAG_GROUPS,
	IR_PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS,
	IR_PREMIUM_FEATURES.INTERLEAVE_LEARNING_SETTINGS,
	IR_PREMIUM_FEATURES.ANALYTICS_VIEW,
	IR_PREMIUM_FEATURES.FOLDER_SUBSCRIPTION,
	IR_PREMIUM_FEATURES.READING_TIMER,
	IR_PREMIUM_FEATURES.CALENDAR_BACKGROUND_WALL,
]);

export const IR_PREMIUM_BENEFIT_FEATURE_ORDER = [
	IR_PREMIUM_FEATURES.IMPORT_EXTERNAL_READING_POINTS,
	IR_PREMIUM_FEATURES.SCHEDULING_STRATEGY_SETTINGS,
	IR_PREMIUM_FEATURES.INTERLEAVE_LEARNING_SETTINGS,
	IR_PREMIUM_FEATURES.FOLDER_SUBSCRIPTION,
	IR_PREMIUM_FEATURES.TAG_GROUPS,
	IR_PREMIUM_FEATURES.ANALYTICS_VIEW,
	IR_PREMIUM_FEATURES.READING_TIMER,
	IR_PREMIUM_FEATURES.CALENDAR_BACKGROUND_WALL,
	IR_PREMIUM_FEATURES.ASSOCIATED_NOTES,
] as const;
