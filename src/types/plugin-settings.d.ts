/**
 * Standalone incremental-reading plugin settings types.
 *
 * @module types/plugin-settings
 */

// ============================================================================
// 增量阅读设置类型
// ============================================================================

/**
 * Incremental reading global sidebar settings.
 */
export type IRParagraphWorkbenchSurfaceStyle = "spotlight" | "blend" | "dashed";
export type IRParagraphWorkbenchTransitionStyle =
	| "steady"
	| "fade"
	| "settle"
	| "slide";

export interface IRParagraphWorkbenchDisplaySettings {
	fontScale?: number;
	surfaceStyle?: IRParagraphWorkbenchSurfaceStyle;
	transitionStyle?: IRParagraphWorkbenchTransitionStyle;
}

export interface IRCalendarSidebarSettings {
	continuousReadingEnabled?: boolean;
	autoStartNextTimerEnabled?: boolean;
	showSchedulingPreview?: boolean;
	calendarViewMode?: "full" | "two-row" | "one-row";
	showMaterialTimers?: boolean;
	showReadingPointTypeLabels?: boolean;
	/** When true, calendar material list shows a warning icon for vault sources that cannot be found. Default: true. */
	showMissingSourceIndicators?: boolean;
	/** When true, hide reading points already completed today from today's material list. Default: false. */
	hideTodayCompletedReadingPoints?: boolean;
	backgroundWall?: {
		imagePath?: string;
		fadePercent?: number;
	};
}

/**
 * 增量阅读全局设置
 */
export type IncrementalReadingFolderSubscriptionInitialScheduleMode =
	| "today"
	| "scheduled";

export interface IncrementalReadingFolderSubscriptionRule {
	id?: string;
	enabled?: boolean;
	folderPath?: string;
	deckId?: string;
}

export interface IncrementalReadingFolderSubscriptionSettings {
	rules?: IncrementalReadingFolderSubscriptionRule[];
	enabled?: boolean;
	folderPath?: string;
	deckId?: string;
	initialScheduleMode?: IncrementalReadingFolderSubscriptionInitialScheduleMode;
	importConfirmThreshold?: number;
}

/**
 * Global tag source policy for reading points.
 * Tag-group matching always consumes resolved reading-point tags;
 * this policy only controls where Markdown (and future adapters) sync from/to.
 */
export interface IRTagSourcePolicy {
	/**
	 * YAML frontmatter property used for Markdown reading-point tags.
	 * Default: legacy `weave_tags` (safe for existing installs). Prefer
	 * Obsidian-native `tags` when you want graph/search interoperability.
	 * Legacy `weave_tags` is still read when a non-legacy primary key is empty.
	 */
	markdownYamlKey: string;
}

export interface IncrementalReadingSettings {
	/**
	 * 默认间隔因子
	 * 范围: 1.0-3.0, 默认: 1.5
	 */
	defaultIntervalFactor?: number;

	/**
	 * 每日新块上限
	 * 范围: 0-50, 默认: 20
	 */
	dailyNewLimit?: number;

	/**
	 * 每日复习上限
	 * 范围: 0-200, 默认: 50
	 */
	dailyReviewLimit?: number;

	/**
	 * 默认拆分标题级别
	 * 范围: 1-6, 默认: 2 (##)
	 */
	defaultSplitLevel?: number;

	/**
	 * 是否启用交错学习模式
	 * 默认: true
	 */
	interleaveMode?: boolean;

	/**
	 * 交错学习最大连续同主题块数
	 * 范围: 1-10, 默认: 3
	 */
	maxConsecutiveSameTopic?: number;

	/**
	 * 进入复习状态的最小间隔（天）
	 * 范围: 3-14, 默认: 7
	 */
	reviewThreshold?: number;

	/**
	 * 最大间隔天数
	 * 范围: 30-365, 默认: 365
	 */
	maxInterval?: number;

	/**
	 * Compatibility: 旧材料导入 / 非 Markdown 源文件复制用的兼容目录。
	 * 已合并进插件数据文件夹（weaveParentFolder）；运行时由 resolveIRImportFolder 推导为 `{dataRoot}/IR`。
	 * @default ''
	 */
	importFolder?: string;

	selectionQuickCreateDeleteSource?: boolean;

	/**
	 * 正文 Markdown 上一次手动选择的目录
	 * 为空时回退 Obsidian 默认新建笔记位置，再回退库根目录
	 */
	selectionQuickCreateLastFolder?: string;

	selectionQuickCreateBacklinkPosition?: "start" | "end";

	selectionQuickCreateSourceDocumentBacklinkPosition?: "start" | "end";

	appendSourceDocumentBacklinkOnSplitImport?: boolean;

	/** 添加入口默认「收件箱」专题 ID */
	readingTargetInboxDeckId?: string;

	/** 添加入口上次选择的专题 ID */
	readingTargetLastDeckId?: string;

	/** 块引用轻量添加时，是否在源笔记末尾追加标记 */
	readingTargetAppendSourceBacklink?: boolean;

	/** Vault 链接是否默认创建阅读笔记（网页始终创建） */
	readingTargetDefaultNoteBacked?: boolean;

	/**
	 * Global sidebar settings.
	 */
	calendarSidebar?: IRCalendarSidebarSettings;

	/** 段落阅读工作台显示偏好（字号、表面样式、切换动画） */
	paragraphWorkbench?: IRParagraphWorkbenchDisplaySettings;

	// ============================================
	// v3.0 调度系统新增设置
	// ============================================

	/**
	 * 调度策略
	 * - 'processing': 加工流（同日可多次回访）
	 * - 'reading-list': 阅读清单（每天最多1次）
	 * @default 'processing'
	 */
	scheduleStrategy?: "processing" | "reading-list";

	/**
	 * 每日时间预算（分钟）
	 * 范围: 10-120, 默认: 40
	 */
	dailyTimeBudgetMinutes?: number;

	/**
	 * 心流 stretch 百分比：超出合理负载后仍保留在今天的比例上限
	 * C = dailyTimeBudgetMinutes × (1 + flowStretchPercent / 100)
	 * 范围: 0-40, 默认: 15
	 */
	flowStretchPercent?: number;

	/**
	 * 是否启用基于负载的自动顺延（超出 stretch 上限的低优先级项推到次日）
	 * @default true
	 */
	enableLoadBasedDefer?: boolean;

	/**
	 * 单条阅读点计入日负载的时长上限（分钟）
	 * 范围: 5-30, 默认: 18
	 */
	maxEstimatedMinutesPerItem?: number;

	/**
	 * 每日阅读点上限（条数）
	 * 范围: 5-40, 默认: 15
	 */
	dailyReadingPointCap?: number;

	/**
	 * 每日阅读点 stretch 上限（条数）
	 * 默认: 17
	 */
	dailyReadingPointStretchCap?: number;

	/**
	 * 跨日平滑窗口（天）
	 * 范围: 5-14, 默认: 7
	 */
	horizonSpreadDays?: number;

	/**
	 * 是否启用跨日平滑分配
	 * @default true
	 */
	enableHorizonSmoothing?: boolean;

	/**
	 * 交错阅读配置
	 * @default 'related-soft'
	 */
	interleaveProfile?: "off" | "soft" | "related-soft";

	/**
	 * 单主题当日时间占比上限（%）
	 * @default 60
	 */
	maxTopicSharePercent?: number;

	/**
	 * 同一内容块每日最大出现次数
	 * 范围: 1-5, 默认: 2
	 */
	maxAppearancesPerDay?: number;

	/**
	 * 是否启用标签组先验（自动调整间隔因子）
	 * @default true
	 */
	enableTagGroupPrior?: boolean;

	/**
	 * 防沉底强度（aging机制）
	 * @default 'low'
	 */
	agingStrength?: "low" | "medium" | "high";

	/**
	 * 过载自动后推策略
	 * @default 'gentle'
	 */
	autoPostponeStrategy?: "off" | "gentle" | "aggressive";

	/**
	 * 优先级EWMA半衰期（天）
	 * 范围: 3-30, 默认: 7
	 */
	priorityHalfLifeDays?: number;

	/**
	 * 标签组自动跟随模式
	 * 当文档标签变化导致匹配到不同标签组时的行为
	 * - 'off': 不检测，导入时确定后不再变化
	 * - 'ask': 检测到漂移时弹出通知提醒用户选择
	 * - 'auto': 静默自动切换标签组
	 * @default 'ask'
	 */
	tagGroupFollowMode?: "off" | "ask" | "auto";

	/**
	 * Where reading-point tags are synced from for each material class.
	 * Matching always uses resolved `userData.tags` (or task tags).
	 */
	tagSource?: IRTagSourcePolicy;

	/**
	 * 待读天数（统一用于统计和提前阅读范围）
	 * 用于统计N天内到期的内容块，显示为"待读"，同时限制提前阅读范围
	 * 范围: 1-14, 默认: 3
	 */
	learnAheadDays?: number;

	folderSubscription?: IncrementalReadingFolderSubscriptionSettings;
}

/**
 * 增量阅读默认设置（使用统一的 PATHS 配置）
 */
export const DEFAULT_IR_SETTINGS: IncrementalReadingSettings = {
	defaultIntervalFactor: 1.5,
	dailyNewLimit: 20,
	dailyReviewLimit: 50,
	defaultSplitLevel: 2,
	interleaveMode: true,
	maxConsecutiveSameTopic: 3,
	reviewThreshold: 7,
	maxInterval: 365,
	importFolder: "",
	selectionQuickCreateDeleteSource: false,
	selectionQuickCreateLastFolder: "",
	selectionQuickCreateBacklinkPosition: "start",
	selectionQuickCreateSourceDocumentBacklinkPosition: "start",
	appendSourceDocumentBacklinkOnSplitImport: false,
	readingTargetInboxDeckId: "",
	readingTargetLastDeckId: "",
	readingTargetAppendSourceBacklink: false,
	readingTargetDefaultNoteBacked: false,
	scheduleStrategy: "processing",
	dailyTimeBudgetMinutes: 40,
	flowStretchPercent: 15,
	enableLoadBasedDefer: true,
	maxEstimatedMinutesPerItem: 18,
	dailyReadingPointCap: 15,
	dailyReadingPointStretchCap: 17,
	horizonSpreadDays: 7,
	enableHorizonSmoothing: true,
	interleaveProfile: "related-soft",
	maxTopicSharePercent: 60,
	maxAppearancesPerDay: 2,
	enableTagGroupPrior: true,
	agingStrength: "low",
	autoPostponeStrategy: "gentle",
	priorityHalfLifeDays: 7,
	learnAheadDays: 3,
	tagGroupFollowMode: "ask",
	tagSource: {
		markdownYamlKey: "weave_tags",
	},
	folderSubscription: {
		rules: [],
		initialScheduleMode: "today",
		importConfirmThreshold: 20,
	},
	calendarSidebar: {
		continuousReadingEnabled: false,
		autoStartNextTimerEnabled: false,
		showSchedulingPreview: false,
		calendarViewMode: "full",
		showMaterialTimers: true,
		showReadingPointTypeLabels: false,
		showMissingSourceIndicators: true,
		hideTodayCompletedReadingPoints: false,
		backgroundWall: {
			imagePath: "",
			fadePercent: 72,
		},
	},
};
