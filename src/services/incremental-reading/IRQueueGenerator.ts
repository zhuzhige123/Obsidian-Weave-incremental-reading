/**
 * 增量阅读队列生成器 v3.0
 *
 * 职责：
 * - Deficit Round Robin 公平分配（避免某组霸屏）
 * - 预算控制（时间/数量）
 * - Aging 防沉底机制
 * - 过载治理（自动后推）
 *
 * 设计原则：
 * - 稳定性优先：所有参数有界
 * - 公平性：按组轮转，避免某类材料霸占队列
 * - 可解释性：每个选择都有明确理由
 *
 * @module services/incremental-reading/IRQueueGenerator
 * @version 3.0.0
 */

import type { IRAdvancedScheduleSettings, IRBlock, IRScheduleStrategy } from "../../types/ir-types";
import { DEFAULT_ADVANCED_SCHEDULE_SETTINGS, PROCESSING_STRATEGY } from "../../types/ir-types";
import { logger } from "../../utils/logger";
import { estimateReadingTime, hasReachedDailyLimit } from "./IRSchedulerV3";

// ============================================
// 类型定义
// ============================================

/**
 * 队列项（带元数据）
 */
export interface QueueItem {
	block: IRBlock;
	groupId: string;
	estimatedMinutes: number;
	overdueDays: number;
	agingBonus: number;
	score: number;
}

/**
 * 队列生成结果
 */
export interface QueueGenerationResult {
	queue: IRBlock[];
	stats: {
		totalDue: number;
		scheduled: number;
		postponed: number;
		reachedDailyLimit: number;
		totalEstimatedMinutes: number;
		groupDistribution: Record<string, number>;
	};
}

/**
 * 后推结果
 */
export interface PostponeResult {
	postponedCount: number;
	postponedBlocks: IRBlock[];
}

/**
 * 组状态（用于 Deficit Round Robin）
 */
interface GroupState {
	groupId: string;
	deficit: number;
	items: QueueItem[];
	quantum: number;
}

// ============================================
// 常量
// ============================================

/** Aging 强度配置 */
const AGING_STRENGTH_CONFIG = {
	low: { maxBonus: 0.5, halfLifeDays: 14 },
	medium: { maxBonus: 1.0, halfLifeDays: 7 },
	high: { maxBonus: 2.0, halfLifeDays: 3 },
};

/** 自动后推配置 */
const AUTO_POSTPONE_CONFIG = {
	gentle: { priorityThreshold: 3, postponeDays: 1 },
	aggressive: { priorityThreshold: 5, postponeDays: 3 },
};

// ============================================
// 核心算法函数
// ============================================

/**
 * 计算 aging 加分
 * 长期未展示的到期项获得额外排序权重
 *
 * @param overdueDays 过期天数
 * @param strength aging 强度
 * @returns aging 加分 (0 ~ maxBonus)
 */
export function calculateAgingBonus(
	overdueDays: number,
	strength: "low" | "medium" | "high" = "low"
): number {
	const config = AGING_STRENGTH_CONFIG[strength];

	// 使用 sigmoid 函数，使加分平滑增长
	// bonus = maxBonus * (1 - exp(-overdueDays / halfLife))
	const bonus = config.maxBonus * (1 - Math.exp(-overdueDays / config.halfLifeDays));

	return Math.max(0, Math.min(config.maxBonus, bonus));
}

/**
 * 计算队列项的综合得分
 *
 * @param item 队列项
 * @returns 综合得分（越高越优先）
 */
export function calculateItemScore(item: QueueItem): number {
	const block = item.block;

	// 1. 有效优先级 (0-10)，归一化到 0-1
	const priorityScore = (block.priorityEff ?? 5) / 10;

	// 2. 过期天数贡献（归一化，最大 30 天）
	const overdueScore = Math.min(item.overdueDays / 30, 1);

	// 3. Aging 加分
	const agingScore = item.agingBonus;

	// 4. 状态权重
	const stateWeights: Record<string, number> = {
		learning: 0.3,
		review: 0.2,
		new: 0.1,
		suspended: 0,
	};
	const stateScore = stateWeights[block.state] ?? 0;

	// 综合得分 = 加权求和
	// 优先级权重最高，过期天数次之，状态和 aging 作为微调
	const score = priorityScore * 0.4 + overdueScore * 0.3 + stateScore * 0.2 + agingScore * 0.1;

	return score;
}

/**
 * 计算过期天数
 */
export function calculateOverdueDays(block: IRBlock): number {
	if (!block.nextReview) return 0;

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const reviewDate = new Date(block.nextReview);
	reviewDate.setHours(0, 0, 0, 0);

	const diffTime = today.getTime() - reviewDate.getTime();
	return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

// ============================================
// IRQueueGenerator 类
// ============================================

export class IRQueueGenerator {
	private strategy: IRScheduleStrategy;
	private advancedSettings: IRAdvancedScheduleSettings;

	constructor(strategy?: IRScheduleStrategy, advancedSettings?: IRAdvancedScheduleSettings) {
		this.strategy = strategy ?? PROCESSING_STRATEGY;
		this.advancedSettings = advancedSettings ?? DEFAULT_ADVANCED_SCHEDULE_SETTINGS;
	}

	/**
	 * 更新策略
	 */
	setStrategy(strategy: IRScheduleStrategy): void {
		this.strategy = strategy;
	}

	/**
	 * 更新高级设置
	 */
	setAdvancedSettings(settings: IRAdvancedScheduleSettings): void {
		this.advancedSettings = settings;
	}

	/**
	 * 生成学习队列（主入口）
	 *
	 * @param blocks 所有内容块
	 * @param groupMapping 文档到组的映射 (filePath -> groupId)
	 * @returns 队列生成结果
	 */
	generateQueue(blocks: IRBlock[], groupMapping: Record<string, string>): QueueGenerationResult {
		const today = new Date().toISOString().split("T")[0];

		// 1. 过滤到期内容块
		const { dueItems, stats } = this.filterDueBlocks(blocks, groupMapping, today);

		logger.debug(`[IRQueueGenerator] 过滤后到期块: ${dueItems.length}`);

		// 2. 按组分桶
		const groupStates = this.groupByTagGroup(dueItems);

		// 3. Deficit Round Robin 公平分配
		let queue: IRBlock[];
		if (this.advancedSettings.enableFairAllocation && groupStates.size > 1) {
			queue = this.deficitRoundRobin(groupStates, stats);
		} else {
			// 不启用公平分配，直接按得分排序
			queue = dueItems
				.sort((a, b) => b.score - a.score)
				.slice(0, this.strategy.dailyReviewLimit)
				.map((item) => item.block);
		}

		// 4. 应用预算控制
		const { finalQueue, totalMinutes } = this.applyBudgetControl(queue);

		// 5. 统计组分布
		const groupDistribution: Record<string, number> = {};
		for (const block of finalQueue) {
			const groupId = groupMapping[block.filePath] ?? "default";
			groupDistribution[groupId] = (groupDistribution[groupId] ?? 0) + 1;
		}

		logger.info(
			`[IRQueueGenerator] 队列生成完成: 到期=${stats.totalDue}, 队列=${
				finalQueue.length
			}, 预估时间=${totalMinutes.toFixed(1)}min`
		);

		return {
			queue: finalQueue,
			stats: {
				totalDue: stats.totalDue,
				scheduled: finalQueue.length,
				postponed: stats.postponed,
				reachedDailyLimit: stats.reachedDailyLimit,
				totalEstimatedMinutes: totalMinutes,
				groupDistribution,
			},
		};
	}

	/**
	 * 过滤到期内容块
	 */
	private filterDueBlocks(
		blocks: IRBlock[],
		groupMapping: Record<string, string>,
		today: string
	): {
		dueItems: QueueItem[];
		stats: { totalDue: number; postponed: number; reachedDailyLimit: number };
	} {
		const dueItems: QueueItem[] = [];
		let totalDue = 0;
		let reachedDailyLimit = 0;
		let suspendedCount = 0;
		let notDueCount = 0;

		// 优先使用 advancedSettings 中的设置，否则回退到策略默认值
		const maxAppearances =
			this.advancedSettings.maxAppearancesPerDay ?? this.strategy.maxAppearancesPerBlockPerDay;
		logger.debug(
			`[IRQueueGenerator] filterDueBlocks 开始: 输入块数=${blocks.length}, today=${today}, maxAppearances=${maxAppearances}`
		);

		for (const block of blocks) {
			// 排除 suspended
			if (block.state === "suspended") {
				suspendedCount++;
				continue;
			}

			// 检查是否到期
			const isDue =
				block.state === "new" || !block.nextReview || block.nextReview.split("T")[0] <= today;

			if (!isDue) {
				notDueCount++;
				continue;
			}

			totalDue++;

			// 检查每日上限
			if (hasReachedDailyLimit(block, maxAppearances)) {
				reachedDailyLimit++;
				continue;
			}

			// 构建队列项
			const groupId = groupMapping[block.filePath] ?? "default";
			const overdueDays = calculateOverdueDays(block);
			const agingBonus = calculateAgingBonus(overdueDays, this.advancedSettings.agingStrength);

			const item: QueueItem = {
				block,
				groupId,
				estimatedMinutes: estimateReadingTime(block),
				overdueDays,
				agingBonus,
				score: 0,
			};
			item.score = calculateItemScore(item);

			dueItems.push(item);
		}

		logger.info(
			`[IRQueueGenerator] filterDueBlocks 结果: suspended=${suspendedCount}, notDue=${notDueCount}, totalDue=${totalDue}, reachedLimit=${reachedDailyLimit}, passed=${dueItems.length}`
		);

		return {
			dueItems,
			stats: { totalDue, postponed: 0, reachedDailyLimit },
		};
	}

	/**
	 * 按标签组分桶
	 */
	private groupByTagGroup(items: QueueItem[]): Map<string, GroupState> {
		const groups = new Map<string, GroupState>();

		for (const item of items) {
			if (!groups.has(item.groupId)) {
				groups.set(item.groupId, {
					groupId: item.groupId,
					deficit: 0,
					items: [],
					quantum: 1, // 默认量子为 1
				});
			}
			groups.get(item.groupId)?.items.push(item);
		}

		// 按得分排序每组内的项
		for (const group of groups.values()) {
			group.items.sort((a, b) => b.score - a.score);
		}

		return groups;
	}

	/**
	 * Deficit Round Robin 公平分配
	 *
	 * 原理：
	 * - 每轮给每个组增加 quantum（默认 1）
	 * - 从 deficit 最大的组取下一项
	 * - 取走后 deficit 减去该项成本
	 */
	private deficitRoundRobin(
		groupStates: Map<string, GroupState>,
		_stats: { totalDue: number; postponed: number; reachedDailyLimit: number }
	): IRBlock[] {
		const queue: IRBlock[] = [];
		const limit = this.strategy.dailyReviewLimit;

		// 转为数组便于操作
		const groups = Array.from(groupStates.values()).filter((g) => g.items.length > 0);

		if (groups.length === 0) return [];

		// 初始化 deficit
		for (const group of groups) {
			group.deficit = 0;
		}

		while (queue.length < limit) {
			// 给每个组增加 quantum
			for (const group of groups) {
				if (group.items.length > 0) {
					group.deficit += group.quantum;
				}
			}

			// 找 deficit 最大的组
			let maxDeficitGroup: GroupState | null = null;
			let maxDeficit = -Infinity;

			for (const group of groups) {
				if (group.items.length > 0 && group.deficit > maxDeficit) {
					maxDeficit = group.deficit;
					maxDeficitGroup = group;
				}
			}

			if (!maxDeficitGroup || maxDeficitGroup.items.length === 0) {
				break; // 所有组都空了
			}

			// 取出该组的最高分项
			const item = maxDeficitGroup.items.shift()!;
			queue.push(item.block);

			// deficit 减去成本（使用 1 作为统一成本，或可使用 estimatedMinutes）
			maxDeficitGroup.deficit -= 1;
		}

		logger.debug(`[IRQueueGenerator] DRR 分配完成: ${queue.length} 块, ` + `组数=${groups.length}`);

		return queue;
	}

	/**
	 * 应用预算控制
	 */
	private applyBudgetControl(queue: IRBlock[]): {
		finalQueue: IRBlock[];
		totalMinutes: number;
	} {
		const finalQueue: IRBlock[] = [];
		let totalMinutes = 0;
		// 优先使用 advancedSettings 中的设置，否则回退到策略默认值
		const dailyTimeBudget =
			this.advancedSettings.dailyTimeBudgetMinutes ?? this.strategy.dailyTimeBudgetMinutes;

		for (const block of queue) {
			const minutes = estimateReadingTime(block);

			// 检查时间预算
			if (totalMinutes + minutes > dailyTimeBudget) {
				// 允许至少一个
				if (finalQueue.length === 0) {
					finalQueue.push(block);
					totalMinutes += minutes;
				}
				break;
			}

			finalQueue.push(block);
			totalMinutes += minutes;
		}

		return { finalQueue, totalMinutes };
	}

	/**
	 * 自动后推低优先级到期项
	 *
	 * @param blocks 到期内容块
	 * @returns 后推结果和更新后的块
	 */
	autoPostpone(blocks: IRBlock[]): PostponeResult {
		if (this.advancedSettings.autoPostponeStrategy === "off") {
			return { postponedCount: 0, postponedBlocks: [] };
		}

		const config = AUTO_POSTPONE_CONFIG[this.advancedSettings.autoPostponeStrategy];
		const postponedBlocks: IRBlock[] = [];
		const now = new Date();

		for (const block of blocks) {
			// 只后推低优先级的到期项
			const priorityEff = block.priorityEff ?? 5;
			if (priorityEff <= config.priorityThreshold) {
				// 计算新的 nextReview
				const newNextReview = new Date(now);
				newNextReview.setDate(newNextReview.getDate() + config.postponeDays);

				const postponedBlock: IRBlock = {
					...block,
					nextReview: newNextReview.toISOString(),
					updatedAt: now.toISOString(),
				};

				postponedBlocks.push(postponedBlock);
			}
		}

		logger.info(
			`[IRQueueGenerator] 自动后推: ${postponedBlocks.length} 块, ` +
				`策略=${this.advancedSettings.autoPostponeStrategy}`
		);

		return {
			postponedCount: postponedBlocks.length,
			postponedBlocks,
		};
	}

	/**
	 * 手动批量后推
	 *
	 * @param blocks 要后推的内容块
	 * @param days 后推天数
	 * @returns 更新后的块
	 */
	manualPostpone(blocks: IRBlock[], days: number): IRBlock[] {
		const now = new Date();
		const newNextReview = new Date(now);
		newNextReview.setDate(newNextReview.getDate() + days);
		const nextReviewStr = newNextReview.toISOString();

		return blocks.map((_block) => ({
			..._block,
			nextReview: nextReviewStr,
			updatedAt: now.toISOString(),
		}));
	}

	/**
	 * 按组后推
	 *
	 * @param blocks 所有到期块
	 * @param groupId 要后推的组 ID
	 * @param groupMapping 文档到组的映射
	 * @param days 后推天数
	 * @returns 更新后的块
	 */
	postponeByGroup(
		blocks: IRBlock[],
		groupId: string,
		groupMapping: Record<string, string>,
		days: number
	): IRBlock[] {
		const blocksToPostpone = blocks.filter(
			(b) => (groupMapping[b.filePath] ?? "default") === groupId
		);
		return this.manualPostpone(blocksToPostpone, days);
	}

	/**
	 * 按优先级阈值后推
	 *
	 * @param blocks 所有到期块
	 * @param maxPriority 最大优先级阈值（低于等于此值的后推）
	 * @param days 后推天数
	 * @returns 更新后的块
	 */
	postponeByPriority(blocks: IRBlock[], maxPriority: number, days: number): IRBlock[] {
		const blocksToPostpone = blocks.filter((b) => (b.priorityEff ?? 5) <= maxPriority);
		return this.manualPostpone(blocksToPostpone, days);
	}

	/**
	 * 获取过载统计
	 */
	getOverloadStats(
		blocks: IRBlock[],
		groupMapping: Record<string, string>
	): {
		isOverloaded: boolean;
		dueCount: number;
		budgetCount: number;
		overloadRatio: number;
		groupOverload: Record<string, { due: number; ratio: number }>;
	} {
		const today = new Date().toISOString().split("T")[0];

		// 统计到期数
		let dueCount = 0;
		const groupDueCounts: Record<string, number> = {};

		for (const block of blocks) {
			if (block.state === "suspended") continue;

			const isDue =
				block.state === "new" || !block.nextReview || block.nextReview.split("T")[0] <= today;

			if (isDue) {
				dueCount++;
				const groupId = groupMapping[block.filePath] ?? "default";
				groupDueCounts[groupId] = (groupDueCounts[groupId] ?? 0) + 1;
			}
		}

		const budgetCount = this.strategy.dailyReviewLimit;
		const overloadRatio = dueCount / budgetCount;
		const isOverloaded = overloadRatio > 1.5; // 超过 1.5 倍视为过载

		// 计算各组过载情况
		const groupCount = Object.keys(groupDueCounts).length || 1;
		const fairShare = budgetCount / groupCount;

		const groupOverload: Record<string, { due: number; ratio: number }> = {};
		for (const [groupId, due] of Object.entries(groupDueCounts)) {
			groupOverload[groupId] = {
				due,
				ratio: due / fairShare,
			};
		}

		return {
			isOverloaded,
			dueCount,
			budgetCount,
			overloadRatio,
			groupOverload,
		};
	}
}
