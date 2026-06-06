/**
 * 增量阅读队列生成器 v4.0
 *
 * 回退于统一计划生成器之后，负责在给定时间预算内生成一条
 * 兼顾组公平性、成本估计和轻度交错倾向的学习队列。
 */

import type { IRBlockV4 } from "../../types/ir-types";
import { logger } from "../../utils/logger";
import { calculateSelectionScore, estimateBlockCost } from "./IRCoreAlgorithmsV4";

export interface QueueItemV4 {
	block: IRBlockV4;
	groupId: string;
	estimatedCost: number;
	score: number;
}

interface GroupState {
	groupId: string;
	deficit: number;
	items: QueueItemV4[];
	weight: number;
}

export interface QueueGenerationResultV4 {
	queue: IRBlockV4[];
	totalEstimatedMinutes: number;
	stats: {
		candidateCount: number;
		scheduledCount: number;
		groupDistribution: Record<string, number>;
		overBudget: boolean;
		overBudgetRatio: number;
	};
}

export interface GroupWeights {
	[groupId: string]: number;
}

export class IRQueueGeneratorV4 {
	private defaultTimeBudget = 40;
	private tailThreshold = 0.8;
	private agingStrength: "low" | "medium" | "high" = "low";
	private interleaveMode = true;
	private maxConsecutiveSameTopic = 3;

	constructor(timeBudget?: number, agingStrength?: "low" | "medium" | "high") {
		if (timeBudget) {
			this.defaultTimeBudget = timeBudget;
		}
		if (agingStrength) {
			this.agingStrength = agingStrength;
		}
	}

	setTimeBudget(minutes: number): void {
		this.defaultTimeBudget = minutes;
	}

	setAgingStrength(strength: "low" | "medium" | "high"): void {
		this.agingStrength = strength;
	}

	setInterleavePreferences(enabled: boolean, maxConsecutiveSameTopic: number): void {
		this.interleaveMode = enabled;
		this.maxConsecutiveSameTopic = Math.max(1, Math.floor(maxConsecutiveSameTopic || 3));
	}

	generateQueue(
		candidatePool: IRBlockV4[],
		groupMapping: Record<string, string>,
		groupWeights?: GroupWeights,
		timeBudget: number = this.defaultTimeBudget,
		currentSourcePath: string | null = null
	): QueueGenerationResultV4 {
		const scheduled = candidatePool.filter((block) => block.status === "scheduled");

		if (scheduled.length === 0) {
			return this.emptyResult();
		}

		const items = this.buildQueueItems(scheduled, groupMapping, currentSourcePath);
		const groups = this.groupByTagGroup(items, groupWeights, timeBudget);
		const { queue, totalMinutes } = this.deficitRoundRobin(groups, timeBudget);

		const groupDistribution: Record<string, number> = {};
		for (const block of queue) {
			const groupId = groupMapping[block.id] || "default";
			groupDistribution[groupId] = (groupDistribution[groupId] || 0) + 1;
		}

		const overBudgetRatio = timeBudget > 0 ? totalMinutes / timeBudget : 0;

		logger.info(
			`[IRQueueGeneratorV4] 队列生成完成: 候选=${scheduled.length}, 入队=${queue.length}, 预估时间=${totalMinutes.toFixed(1)}min/${timeBudget}min`
		);

		return {
			queue,
			totalEstimatedMinutes: totalMinutes,
			stats: {
				candidateCount: scheduled.length,
				scheduledCount: queue.length,
				groupDistribution,
				overBudget: totalMinutes > timeBudget,
				overBudgetRatio,
			},
		};
	}

	private buildQueueItems(
		blocks: IRBlockV4[],
		groupMapping: Record<string, string>,
		currentSourcePath: string | null
	): QueueItemV4[] {
		return blocks.map((block) => {
			const groupId = groupMapping[block.id] || "default";
			const estimatedCost = estimateBlockCost(block);
			const score = calculateSelectionScore(block, currentSourcePath, 0.5, this.agingStrength);

			return {
				block,
				groupId,
				estimatedCost,
				score,
			};
		});
	}

	private groupByTagGroup(
		items: QueueItemV4[],
		groupWeights: GroupWeights | undefined,
		timeBudget: number
	): Map<string, GroupState> {
		const groups = new Map<string, GroupState>();
		const groupIds = new Set(items.map((item) => item.groupId));
		const defaultWeight = groupIds.size > 0 ? 1 / groupIds.size : 1;

		for (const groupId of groupIds) {
			const weight = groupWeights?.[groupId] ?? defaultWeight;
			groups.set(groupId, {
				groupId,
				deficit: timeBudget * weight,
				items: [],
				weight,
			});
		}

		for (const item of items) {
			const group = groups.get(item.groupId);
			if (group) {
				group.items.push(item);
			}
		}

		for (const group of groups.values()) {
			group.items.sort((a, b) => b.score - a.score);
		}

		return groups;
	}

	private deficitRoundRobin(
		groups: Map<string, GroupState>,
		timeBudget: number
	): { queue: IRBlockV4[]; totalMinutes: number } {
		const queue: IRBlockV4[] = [];
		let totalMinutes = 0;
		let lastGroupId: string | null = null;
		let consecutiveCount = 0;
		const groupList = Array.from(groups.values()).filter((group) => group.items.length > 0);

		if (groupList.length === 0) {
			return { queue: [], totalMinutes: 0 };
		}

		while (totalMinutes < timeBudget && this.hasAvailableItems(groupList)) {
			const selectedGroup = this.selectNextGroup(groupList, lastGroupId, consecutiveCount);
			if (!selectedGroup || selectedGroup.items.length === 0) {
				break;
			}

			const item = selectedGroup.items[0];
			const cost = item.estimatedCost;

			if (totalMinutes + cost > timeBudget) {
				if (totalMinutes === 0) {
					queue.push(item.block);
					totalMinutes += cost;
					selectedGroup.items.shift();
					selectedGroup.deficit -= cost;
					({ lastGroupId, consecutiveCount } = this.updateRunState(
						lastGroupId,
						consecutiveCount,
						selectedGroup.groupId
					));
					continue;
				}

				if (timeBudget > 0 && totalMinutes / timeBudget >= this.tailThreshold) {
					queue.push(item.block);
					totalMinutes += cost;
					selectedGroup.items.shift();
					selectedGroup.deficit -= cost;
					({ lastGroupId, consecutiveCount } = this.updateRunState(
						lastGroupId,
						consecutiveCount,
						selectedGroup.groupId
					));
					logger.debug(
						`[IRQueueGeneratorV4] 尾部碎片：允许轻微超出, block=${item.block.id}, cost=${cost.toFixed(1)}min`
					);
				} else {
					const smallerItem = this.findSmallerItem(selectedGroup, timeBudget - totalMinutes);
					if (smallerItem) {
						queue.push(smallerItem.block);
						totalMinutes += smallerItem.estimatedCost;
						const index = selectedGroup.items.indexOf(smallerItem);
						if (index >= 0) {
							selectedGroup.items.splice(index, 1);
						}
						selectedGroup.deficit -= smallerItem.estimatedCost;
						({ lastGroupId, consecutiveCount } = this.updateRunState(
							lastGroupId,
							consecutiveCount,
							selectedGroup.groupId
						));
					} else {
						selectedGroup.items.shift();
					}
				}
				continue;
			}

			queue.push(item.block);
			totalMinutes += cost;
			selectedGroup.items.shift();
			selectedGroup.deficit -= cost;
			({ lastGroupId, consecutiveCount } = this.updateRunState(
				lastGroupId,
				consecutiveCount,
				selectedGroup.groupId
			));
		}

		logger.debug(
			`[IRQueueGeneratorV4] DRR 完成: ${queue.length} 块, 总时间=${totalMinutes.toFixed(1)}min`
		);

		return { queue, totalMinutes };
	}

	private hasAvailableItems(groups: GroupState[]): boolean {
		return groups.some((group) => group.items.length > 0);
	}

	private selectNextGroup(
		groups: GroupState[],
		lastGroupId: string | null,
		consecutiveCount: number
	): GroupState | null {
		let maxGroup: GroupState | null = null;
		let maxDeficit = -Infinity;
		const alternativesRemain = this.hasAlternativeGroup(groups, lastGroupId);

		for (const group of groups) {
			if (group.items.length === 0) {
				continue;
			}

			const adjustedDeficit =
				group.deficit +
				this.getInterleaveBias(group.groupId, lastGroupId, consecutiveCount, alternativesRemain);

			if (adjustedDeficit > maxDeficit) {
				maxDeficit = adjustedDeficit;
				maxGroup = group;
			}
		}

		return maxGroup;
	}

	private getInterleaveBias(
		groupId: string,
		lastGroupId: string | null,
		consecutiveCount: number,
		alternativesRemain: boolean
	): number {
		if (!this.interleaveMode || !lastGroupId || !alternativesRemain) {
			return 0;
		}

		const overflow = consecutiveCount + 1 - this.maxConsecutiveSameTopic;
		if (overflow <= 0) {
			return 0;
		}

		const bias = Math.min(2.4, overflow * 0.9);
		return groupId === lastGroupId ? -bias : bias;
	}

	private hasAlternativeGroup(groups: GroupState[], lastGroupId: string | null): boolean {
		if (!lastGroupId) {
			return false;
		}

		return groups.some((group) => group.groupId !== lastGroupId && group.items.length > 0);
	}

	private updateRunState(
		lastGroupId: string | null,
		consecutiveCount: number,
		selectedGroupId: string
	): { lastGroupId: string; consecutiveCount: number } {
		if (selectedGroupId === lastGroupId) {
			return {
				lastGroupId: selectedGroupId,
				consecutiveCount: consecutiveCount + 1,
			};
		}

		return {
			lastGroupId: selectedGroupId,
			consecutiveCount: 1,
		};
	}

	private findSmallerItem(group: GroupState, maxCost: number): QueueItemV4 | null {
		for (const item of group.items) {
			if (item.estimatedCost <= maxCost) {
				return item;
			}
		}
		return null;
	}

	private emptyResult(): QueueGenerationResultV4 {
		return {
			queue: [],
			totalEstimatedMinutes: 0,
			stats: {
				candidateCount: 0,
				scheduledCount: 0,
				groupDistribution: {},
				overBudget: false,
				overBudgetRatio: 0,
			},
		};
	}

	previewQueue(
		candidatePool: IRBlockV4[],
		groupMapping: Record<string, string>,
		timeBudget: number = this.defaultTimeBudget
	): { blocks: IRBlockV4[]; totalMinutes: number } {
		const result = this.generateQueue(candidatePool, groupMapping, undefined, timeBudget);
		return {
			blocks: result.queue,
			totalMinutes: result.totalEstimatedMinutes,
		};
	}

	getOverloadStats(
		candidatePool: IRBlockV4[],
		groupMapping: Record<string, string>,
		timeBudget: number = this.defaultTimeBudget
	): {
		isOverloaded: boolean;
		totalCandidateCost: number;
		budgetMinutes: number;
		overloadRatio: number;
		groupOverload: Record<string, { count: number; cost: number; ratio: number }>;
	} {
		const scheduled = candidatePool.filter((block) => block.status === "scheduled");
		let totalCost = 0;
		const groupCosts: Record<string, { count: number; cost: number }> = {};

		for (const block of scheduled) {
			const cost = estimateBlockCost(block);
			totalCost += cost;

			const groupId = groupMapping[block.id] || "default";
			if (!groupCosts[groupId]) {
				groupCosts[groupId] = { count: 0, cost: 0 };
			}
			groupCosts[groupId].count++;
			groupCosts[groupId].cost += cost;
		}

		const overloadRatio = timeBudget > 0 ? totalCost / timeBudget : 0;
		const isOverloaded = overloadRatio > 1.5;
		const groupCount = Object.keys(groupCosts).length || 1;
		const fairShare = groupCount > 0 ? timeBudget / groupCount : timeBudget;

		const groupOverload: Record<string, { count: number; cost: number; ratio: number }> = {};
		for (const [groupId, data] of Object.entries(groupCosts)) {
			groupOverload[groupId] = {
				count: data.count,
				cost: data.cost,
				ratio: fairShare > 0 ? data.cost / fairShare : 0,
			};
		}

		return {
			isOverloaded,
			totalCandidateCost: totalCost,
			budgetMinutes: timeBudget,
			overloadRatio,
			groupOverload,
		};
	}
}

export function createQueueGenerator(timeBudget?: number): IRQueueGeneratorV4 {
	return new IRQueueGeneratorV4(timeBudget);
}
