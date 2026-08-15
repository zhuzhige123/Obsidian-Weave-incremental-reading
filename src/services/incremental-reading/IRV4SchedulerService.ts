/**
 * 增量阅读 V4 调度服务
 *
 * 整合 IRStateMachineV4 + IRChunkScheduleAdapter + IRTagGroupService
 * 提供完整的 V4 调度能力，替代 V3 IRSchedulingFacade
 *
 * @module services/incremental-reading/IRV4SchedulerService
 * @version 4.0.0
 */

import { App, Notice, TFile } from "obsidian";
import { getPluginPaths } from "../../config/paths";
import type {
	IRAdvancedScheduleSettings,
	IRBlock,
	IRBlockStatus,
	IRBlockV4,
	IRChunkFileData,
	IRSession,
	IRSourceFileMeta,
} from "../../types/ir-types";
import { migrateToIRBlockV4 } from "../../types/ir-types";
import { i18n } from "../../utils/i18n";
import {
	readAdvancedScheduleSettingsSnapshot,
	readTagGroupFollowMode,
} from "../../utils/ir-plugin-host-access";
import { logger } from "../../utils/logger";
import { generateCardUUID } from "../identifier/WeaveIDGenerator";
import { IRChunkScheduleAdapter } from "./IRChunkScheduleAdapter";
import { IRCognitiveProfileService } from "./IRCognitiveProfileService";
import {
	M_BASE,
	calculateNextInterval,
	calculateNextRepDate,
	calculatePriorityEWMA,
} from "./IRCoreAlgorithmsV4";
import {
	IREpubBookmarkTaskService,
	isEpubBookmarkTaskId,
} from "./IREpubBookmarkTaskService";
import { admitPendingFolderSubscriptionChunks, isFolderSubscriptionPendingAdmission } from "./IRFolderSubscriptionAdmissionService";
import { applyLoadDeferralsFromPlan } from "./IRLoadDeferService";
import {
	IRPdfBookmarkTaskService,
	isPdfBookmarkTaskId,
} from "./IRPdfBookmarkTaskService";
import { IRPlanGeneratorService } from "./IRPlanGeneratorService";
import { persistBlockScheduleState } from "./IRPointScheduleMutator";
import { IRPointWriteService } from "./IRPointWriteService";
import { IRQueueGeneratorV4 } from "./IRQueueGeneratorV4";
import { getSharedIRScheduleKernel } from "./IRScheduleKernel";
import {
	type IRPlannedDay,
	type IRPlannedScheduleItem,
	type IRScheduleExplanation,
	readSequenceMeta,
} from "./IRScheduleKernel";
import { recordScheduleMenuActionInteraction } from "./IRScheduleModeMutationService";
import { computeScheduleModeAdjustedBlock } from "./IRScheduleModePreviewService";
import { calculateLoadSignal } from "./IRSchedulerV3";
import { IRStateMachineV4 } from "./IRStateMachineV4";
import { IRStorageAdapterV4 } from "./IRStorageAdapterV4";
import { IRStorageService } from "./IRStorageService";
import {
	IRTagGroupService,
	computeTagGroupPriorityBias,
} from "./IRTagGroupService";

/**
 * 阅读完成数据
 */
export interface ReadingCompletionDataV4 {
	rating: number; // 理解度评分 1-4
	readingTimeSeconds: number;
	priorityUi: number;
	createdCardCount: number;
	createdExtractCount: number;
	createdNoteCount: number;
}

/**
 * 完成块结果
 */
export interface CompleteBlockResultV4 {
	block: IRBlockV4;
	nextRepDate: number;
	intervalDays: number;
	futurePlanPreview?: IRFuturePlanPreview;
}

export interface IRPriorityUpdateResultV4 {
	block: IRBlockV4;
	futurePlanPreview?: IRFuturePlanPreview;
}

export interface IRBlockMutationPreviewResultV4 {
	block: IRBlockV4;
	futurePlanPreview?: IRFuturePlanPreview;
}

export interface IRManualRescheduleOptionsV4 {
	nextRepDate: number;
	intervalDays?: number;
	scheduleStatus?: IRBlockStatus;
}

export type IRScheduleModeV4 = "intensive" | "normal" | "slow";

export interface IRFuturePlanChangeSummary {
	changedItemCount: number;
	movedItems: Array<{
		itemId: string;
		title: string;
		fromDateKey?: string;
		toDateKey?: string;
		changeType: "moved" | "entered" | "removed";
	}>;
	impactedDays: Array<{
		dateKey: string;
		beforeMinutes: number;
		afterMinutes: number;
	}>;
}

export interface IRFuturePlanPreview {
	generatedAt: number;
	days: IRPlannedDay[];
	changeSummary?: IRFuturePlanChangeSummary;
}

/**
 * V4 调度服务
 */
export class IRV4SchedulerService {
	private app: App;
	private stateMachine: IRStateMachineV4;
	private chunkAdapter: IRChunkScheduleAdapter;
	private tagGroupService: IRTagGroupService;
	private storageService: IRStorageService;
	private storageAdapterV4: IRStorageAdapterV4;
	private queueGenerator: IRQueueGeneratorV4;
	private profileService: IRCognitiveProfileService;
	private planGenerator: IRPlanGeneratorService;
	private _pdfBookmarkTaskService: IRPdfBookmarkTaskService;
	private _epubBookmarkTaskService: IREpubBookmarkTaskService;
	private initialized = false;

	constructor(app: App) {
		this.app = app;
		this.stateMachine = new IRStateMachineV4();
		this.storageService = new IRStorageService(app);
		this.chunkAdapter = new IRChunkScheduleAdapter(app, this.storageService);
		this.tagGroupService = new IRTagGroupService(app);
		this.storageAdapterV4 = new IRStorageAdapterV4(app);
		this.queueGenerator = new IRQueueGeneratorV4();
		this.profileService = new IRCognitiveProfileService();
		this.planGenerator = new IRPlanGeneratorService(this.profileService);
		this._pdfBookmarkTaskService = new IRPdfBookmarkTaskService(app);
		this._epubBookmarkTaskService = new IREpubBookmarkTaskService(app);
	}

	get pdfBookmarkTaskService(): IRPdfBookmarkTaskService {
		return this._pdfBookmarkTaskService;
	}

	get epubBookmarkTaskService(): IREpubBookmarkTaskService {
		return this._epubBookmarkTaskService;
	}

	/**
	 * 初始化服务
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		await this.storageService.initialize();
		await this.tagGroupService.initialize();
		await this._pdfBookmarkTaskService.initialize();
		await this._epubBookmarkTaskService.initialize();

		try {
			this.autoBackfillTagGroupsOnce().catch((error) => {
				logger.warn(
					"[IRV4SchedulerService] autoBackfillTagGroupsOnce 失败:",
					error,
				);
			});
			/*
			logger.warn("[IRV4SchedulerService] autoBackfillTagGroupsOnce 失败:", error);
			*/
		} catch { /* ignored */ }
		this.initialized = true;

		logger.info("[IRV4SchedulerService] 初始化完成");
	}

	private toNormalizedDeckIdentifiers(values: string[]): string[] {
		return Array.from(
			new Set(
				(Array.isArray(values) ? values : [])
					.map((value) => String(value || "").trim())
					.filter(Boolean),
			),
		);
	}

	private async resolveDeckIdentifiers(deckPath: string): Promise<string[]> {
		const deck = await this.storageAdapterV4.getDeckById(deckPath);
		return this.toNormalizedDeckIdentifiers([
			deckPath,
			deck?.id || "",
			deck?.path || "",
		]);
	}

	private async resolveCanonicalDeckId(deckPath: string): Promise<string> {
		const normalizedDeckPath = String(deckPath || "").trim();
		if (!normalizedDeckPath) {
			return "";
		}

		const deck = await this.storageAdapterV4.getDeckById(normalizedDeckPath);
		return deck?.id || deck?.path || normalizedDeckPath;
	}

	private async collectBookmarkTaskBlocks(
		deckPath: string,
	): Promise<{ pdfTaskBlocks: IRBlockV4[]; epubTaskBlocks: IRBlockV4[] }> {
		const deckIdentifiers = await this.resolveDeckIdentifiers(deckPath);

		const pdfTaskMap = new Map<string, IRBlockV4>();
		for (const identifier of deckIdentifiers) {
			const tasks =
				await this._pdfBookmarkTaskService.getTasksByDeck(identifier);
			for (const task of tasks) {
				const block = this._pdfBookmarkTaskService.toBlockV4(task);
				if (!pdfTaskMap.has(block.id)) {
					pdfTaskMap.set(block.id, block);
				}
			}
		}

		const epubTaskMap = new Map<string, IRBlockV4>();
		for (const identifier of deckIdentifiers) {
			const tasks =
				await this._epubBookmarkTaskService.getTasksByDeck(identifier);
			for (const task of tasks) {
				const block = this._epubBookmarkTaskService.toBlockV4(task);
				if (!epubTaskMap.has(block.id)) {
					epubTaskMap.set(block.id, block);
				}
			}
		}

		return {
			pdfTaskBlocks: Array.from(pdfTaskMap.values()),
			epubTaskBlocks: Array.from(epubTaskMap.values()),
		};
	}

	private async autoBackfillTagGroupsOnce(): Promise<void> {
		const adapter = this.app.vault.adapter;
		const migrationRoot = getPluginPaths(this.app).migration.root;
		const markerPath = `${migrationRoot}/ir-taggroup-backfill-v1.json`;

		try {
			if (await adapter.exists(markerPath)) {
				return;
			}
		} catch { /* ignored */ }

		let sources: Record<
			string,
			import("../../types/ir-types").IRSourceFileMeta
		> = {};
		let chunks: Record<string, import("../../types/ir-types").IRChunkFileData> =
			{};

		try {
			sources = await this.storageService.getAllSources();
			chunks = await this.storageService.getAllChunkData();
		} catch (error) {
			logger.warn(
				"[IRV4SchedulerService] 读取 sources/chunks 失败，跳过 tagGroup 回填:",
				error,
			);
			return;
		}

		const updatedSources: IRSourceFileMeta[] = [];
		const updatedChunks: IRChunkFileData[] = [];

		let updatedSourceCount = 0;
		let updatedChunkCount = 0;

		for (const source of Object.values(sources)) {
			const currentGroup = source.tagGroup;
			if (currentGroup && currentGroup !== "default") {
				continue;
			}

			const originalPath = source.originalPath;
			if (typeof originalPath !== "string" || !originalPath.trim()) {
				continue;
			}

			let matched = "default";
			try {
				matched = await this.tagGroupService.matchGroupForDocument(
					originalPath,
					true,
				);
			} catch {
				matched = "default";
			}

			if (matched !== currentGroup) {
				updatedSources.push({
					...source,
					tagGroup: matched,
					updatedAt: Date.now(),
				});
				updatedSourceCount++;
			}

			const chunkIds = source.chunkIds;
			if (Array.isArray(chunkIds)) {
				for (const chunkId of chunkIds) {
					const chunk = chunks[chunkId];
					if (!chunk) continue;
					const currentChunkGroup = chunk.meta?.tagGroup;
					if (!currentChunkGroup || currentChunkGroup === "default") {
						updatedChunks.push({
							...chunk,
							meta: {
								...chunk.meta,
								tagGroup: matched,
							},
							updatedAt: Date.now(),
						});
						updatedChunkCount++;
					}
				}
			}
		}

		try {
			if (updatedSources.length > 0) {
				await this.storageService.saveSourceBatch(updatedSources);
			}
			if (updatedChunks.length > 0) {
				await this.storageService.saveChunkDataBatch(updatedChunks);
			}
		} catch (error) {
			logger.warn("[IRV4SchedulerService] 写回 tagGroup 回填失败:", error);
			return;
		}

		try {
			if (!(await adapter.exists(migrationRoot))) {
				await adapter.mkdir(migrationRoot);
			}
			await adapter.write(
				markerPath,
				JSON.stringify(
					{
						version: 1,
						completedAt: new Date().toISOString(),
						updatedSourceCount,
						updatedChunkCount,
					},
					null,
					2,
				),
			);
		} catch { /* ignored */ }

		if (updatedSourceCount > 0 || updatedChunkCount > 0) {
			logger.info(
				`[IRV4SchedulerService] tagGroup 回填完成: sources=${updatedSourceCount}, chunks=${updatedChunkCount}`,
			);
		}
	}

	private getAdvancedSettingsSnapshot(): IRAdvancedScheduleSettings {
		return readAdvancedScheduleSettingsSnapshot(this.app);
	}

	/**
	 * 获取标签组跟随模式设置
	 */
	private getTagGroupFollowMode(): "off" | "ask" | "auto" {
		return readTagGroupFollowMode(this.app);
	}

	async getStudyQueueV4(
		deckPath: string,
		options?: {
			timeBudgetMinutes?: number;
			currentSourcePath?: string | null;
			markActive?: boolean;
			preloadedBlocks?: IRBlockV4[];
		},
	): Promise<{
		queue: IRBlockV4[];
		totalEstimatedMinutes: number;
		stats: {
			candidateCount: number;
			scheduledCount: number;
			groupDistribution: Record<string, number>;
			overBudget: boolean;
			overBudgetRatio: number;
			persistedTransitions: number;
			activeBlockId: string | null;
		};
	}> {
		await this.initialize();

		const advSettings = this.getAdvancedSettingsSnapshot();
		try {
			const todayStart = new Date();
			todayStart.setHours(0, 0, 0, 0);
			const todayDateKey = `${todayStart.getFullYear()}-${String(
				todayStart.getMonth() + 1,
			).padStart(2, "0")}-${String(todayStart.getDate()).padStart(2, "0")}`;
			await admitPendingFolderSubscriptionChunks({
				app: this.app,
				todayStartMs: todayStart.getTime(),
				todayDateKey,
				dailyReadingPointCap: advSettings.dailyReadingPointCap,
				dailyTimeBudgetMinutes: advSettings.dailyTimeBudgetMinutes,
				maxEstimatedMinutesPerItem: advSettings.maxEstimatedMinutesPerItem,
				deckIds: deckPath ? [deckPath] : undefined,
			});
		} catch (error) {
			logger.warn(
				"[IRV4SchedulerService] 订阅文件夹每日准入失败，继续构建队列:",
				error,
			);
		}
		const markActive = options?.markActive ?? true;
		const timeBudgetMinutes =
			options?.timeBudgetMinutes ?? advSettings.dailyTimeBudgetMinutes ?? 40;
		const currentSourcePath = options?.currentSourcePath ?? null;

		// 同步 agingStrength 到队列生成器
		this.queueGenerator.setAgingStrength(advSettings.agingStrength);
		this.queueGenerator.setInterleavePreferences(
			advSettings.interleaveMode !== false,
			advSettings.maxConsecutiveSameTopic ?? 3,
		);

		const endOfToday = new Date();
		endOfToday.setHours(23, 59, 59, 999);
		const dueCutoffMs = endOfToday.getTime();

		const preloadedBlocks =
			Array.isArray(options?.preloadedBlocks) &&
			options.preloadedBlocks.length > 0
				? options.preloadedBlocks
				: null;
		const chunkBlocksRaw = preloadedBlocks
			? preloadedBlocks
			: await this.storageAdapterV4.getBlocksByDeckV4(deckPath);
		const chunkBlocks = chunkBlocksRaw.filter(
			(block) => !isFolderSubscriptionPendingAdmission(block.meta),
		);

		let pdfTaskBlocks: IRBlockV4[] = [];
		let epubTaskBlocks: IRBlockV4[] = [];
		try {
			const bookmarkBlocks = await this.collectBookmarkTaskBlocks(deckPath);
			pdfTaskBlocks = bookmarkBlocks.pdfTaskBlocks;
			epubTaskBlocks = bookmarkBlocks.epubTaskBlocks;
		} catch (error) {
			logger.warn(
				"[IRV4SchedulerService] 读取 PDF/EPUB 阅读点兼容视图失败（将继续仅使用 chunk 阅读点队列）",
				error,
			);
		}
		const allBlocks: IRBlockV4[] = [
			...chunkBlocks,
			...pdfTaskBlocks,
			...epubTaskBlocks,
		];

		// maxAppearancesPerDay 过滤：跳过今日已达上限的块
		const maxPerDay = advSettings.maxAppearancesPerDay ?? 2;
		const todayStr = new Date().toISOString().slice(0, 10);
		const blocks = allBlocks.filter((_b) => {
			if (
				_b.status === "done" ||
				_b.status === "suspended" ||
				_b.status === "removed"
			)
				return false;
			const count =
				_b.stats.todayShownDate === todayStr
					? _b.stats.todayShownCount || 0
					: 0;
			return count < maxPerDay;
		});
		if (blocks.length === 0) {
			return {
				queue: [],
				totalEstimatedMinutes: 0,
				stats: {
					candidateCount: 0,
					scheduledCount: 0,
					groupDistribution: {},
					overBudget: false,
					overBudgetRatio: 0,
					persistedTransitions: 0,
					activeBlockId: null,
				},
			};
		}

		const originalById = new Map<string, IRBlockV4>();
		for (const b of blocks) originalById.set(b.id, b);

		const transitioned: IRBlockV4[] = [];
		for (const block of blocks) {
			let next = block;

			if (next.status === "scheduled" && next.nextRepDate > dueCutoffMs) {
				next = {
					...next,
					status: "queued",
					updatedAt: Date.now(),
				};
			}

			if (next.status === "new") {
				next = this.stateMachine.transitionToQueued(next, 1);
			}

			if (
				next.status === "queued" &&
				(next.nextRepDate === 0 || next.nextRepDate <= dueCutoffMs)
			) {
				next = {
					...next,
					status: "scheduled",
					updatedAt: Date.now(),
				};
			}

			transitioned.push(next);
		}

		let persistedTransitions = 0;
		const pendingChunkUpdates: Array<{
			chunkId: string;
			data: {
				scheduleStatus: IRBlockStatus;
				intervalDays: number;
				nextRepDate: number;
			};
		}> = [];

		for (const updated of transitioned) {
			const original = originalById.get(updated.id);
			if (!original) continue;

			const changed =
				original.status !== updated.status ||
				original.intervalDays !== updated.intervalDays ||
				original.nextRepDate !== updated.nextRepDate;

			if (!changed) continue;

			if (isPdfBookmarkTaskId(updated.id)) {
				await this._pdfBookmarkTaskService.updateTaskFromBlock(updated);
				persistedTransitions++;
				continue;
			}
			if (isEpubBookmarkTaskId(updated.id)) {
				await this._epubBookmarkTaskService.updateTaskFromBlock(updated);
				persistedTransitions++;
				continue;
			}

			pendingChunkUpdates.push({
				chunkId: updated.id,
				data: {
					scheduleStatus: updated.status,
					intervalDays: updated.intervalDays,
					nextRepDate: updated.nextRepDate,
				},
			});
			persistedTransitions++;
		}

		if (pendingChunkUpdates.length > 0) {
			await this.chunkAdapter.batchUpdateChunkSchedules(pendingChunkUpdates);
		}

		const activeBlock = this.stateMachine.getActiveBlock(transitioned);

		const groupMapping: Record<string, string> = {};
		for (const b of transitioned) {
			groupMapping[b.id] = b.meta?.tagGroup || "default";
		}

		let candidates = this.stateMachine.getCandidatePool(transitioned);

		// 自动后推：过载时将低优先级 scheduled 块推迟
		// 当启用负载顺延（IRDailyLoadAllocator）时，由计划生成器统一处理，跳过旧 1.5× 阈值逻辑。
		const postponeStrategy = advSettings.autoPostponeStrategy;
		const loadDeferEnabled =
			advSettings.enableLoadBasedDefer !== false ||
			advSettings.enableHorizonSmoothing !== false;
		if (
			!loadDeferEnabled &&
			postponeStrategy !== "off" &&
			candidates.length > 0
		) {
			const AUTO_POSTPONE_CFG: Record<
				string,
				{ priorityThreshold: number; postponeDays: number }
			> = {
				gentle: { priorityThreshold: 3, postponeDays: 1 },
				aggressive: { priorityThreshold: 5, postponeDays: 3 },
			};
			const totalCost = candidates.reduce((sum, b) => {
				const cost =
					b.stats.impressions > 0 && b.stats.effectiveReadingTimeSec > 0
						? b.stats.effectiveReadingTimeSec / b.stats.impressions / 60
						: 2;
				return sum + cost;
			}, 0);
			const isOverloaded = totalCost > timeBudgetMinutes * 1.5;

			if (isOverloaded) {
				const cfg = AUTO_POSTPONE_CFG[postponeStrategy];
				if (cfg) {
					const postponeUpdates: Array<{
						chunkId: string;
						data: { scheduleStatus: IRBlockStatus; nextRepDate: number };
					}> = [];
					const remaining: IRBlockV4[] = [];
					for (const block of candidates) {
						if (block.priorityEff <= cfg.priorityThreshold) {
							const newDate =
								Date.now() + cfg.postponeDays * 24 * 60 * 60 * 1000;
							postponeUpdates.push({
								chunkId: block.id,
								data: { scheduleStatus: "queued", nextRepDate: newDate },
							});
						} else {
							remaining.push(block);
						}
					}
					if (postponeUpdates.length > 0) {
						await this.chunkAdapter.batchUpdateChunkSchedules(postponeUpdates);
						candidates = remaining;
						logger.info(
							`[IRV4SchedulerService] 自动后推 ${postponeUpdates.length} 个低优先级块 (策略=${postponeStrategy})`,
						);
					}
				}
			}
		}

		const generatedQueue = await this.generateUnifiedQueue(
			candidates,
			timeBudgetMinutes,
			currentSourcePath,
		);

		let queue: IRBlockV4[];
		let activeBlockId: string | null = null;

		if (activeBlock) {
			activeBlockId = activeBlock.id;
			queue = [
				activeBlock,
				...generatedQueue.queue.filter((b) => b.id !== activeBlock.id),
			];
		} else {
			queue = [...generatedQueue.queue];
		}

		if (!activeBlock && markActive && queue.length > 0) {
			const first = queue[0];
			if (first.status === "scheduled") {
				const updatedFirst = this.stateMachine.transitionToActive(first);
				queue[0] = updatedFirst;
				activeBlockId = updatedFirst.id;

				if (isPdfBookmarkTaskId(updatedFirst.id)) {
					await this._pdfBookmarkTaskService.updateTaskFromBlock(updatedFirst);
					await this._pdfBookmarkTaskService.recordTaskInteraction(
						updatedFirst.id,
						0,
						{},
					);
					persistedTransitions++;
				} else if (isEpubBookmarkTaskId(updatedFirst.id)) {
					await this._epubBookmarkTaskService.updateTaskFromBlock(updatedFirst);
					await this._epubBookmarkTaskService.recordTaskInteraction(
						updatedFirst.id,
						0,
						{},
					);
					persistedTransitions++;
				} else {
					await this.chunkAdapter.updateChunkSchedule(updatedFirst.id, {
						scheduleStatus: updatedFirst.status,
					});
					await this.chunkAdapter.recordChunkInteraction(
						updatedFirst.id,
						0,
						{},
					);
					persistedTransitions++;
				}
			}
		}

		return {
			queue,
			totalEstimatedMinutes: generatedQueue.totalEstimatedMinutes,
			stats: {
				...generatedQueue.stats,
				persistedTransitions,
				activeBlockId,
			},
		};
	}

	private async generateUnifiedQueue(
		candidates: IRBlockV4[],
		timeBudgetMinutes: number,
		currentSourcePath: string | null,
	): Promise<{
		queue: IRBlockV4[];
		totalEstimatedMinutes: number;
		stats: {
			candidateCount: number;
			scheduledCount: number;
			groupDistribution: Record<string, number>;
			overBudget: boolean;
			overBudgetRatio: number;
		};
	}> {
		const plannedItems = candidates.map((block) =>
			this.toPlannedItem(block, currentSourcePath),
		);
		const advSettings = this.getAdvancedSettingsSnapshot();
		await this.applyTagGroupPriorityBiases(plannedItems, advSettings);
		const plan = this.planGenerator.generatePlan(plannedItems, {
			horizonDays: advSettings.horizonSpreadDays ?? 7,
			dailyBudgetMinutes: timeBudgetMinutes,
			enableInterleaving: advSettings.interleaveMode !== false,
			maxConsecutiveSameTopic: advSettings.maxConsecutiveSameTopic ?? 3,
			flowStretchPercent: advSettings.flowStretchPercent,
			enableLoadBasedDefer: advSettings.enableLoadBasedDefer,
			maxEstimatedMinutesPerItem: advSettings.maxEstimatedMinutesPerItem,
			dailyReadingPointCap: advSettings.dailyReadingPointCap,
			dailyReadingPointStretchCap: advSettings.dailyReadingPointStretchCap,
			enableHorizonSmoothing: advSettings.enableHorizonSmoothing,
			interleaveProfile: advSettings.interleaveProfile,
			maxTopicSharePercent: advSettings.maxTopicSharePercent,
		});

		if (
			advSettings.enableLoadBasedDefer !== false &&
			plan.loadDeferrals.length > 0
		) {
			await applyLoadDeferralsFromPlan(this.app, plan.loadDeferrals, {
				reason: "ui_refresh",
				persistDeferrals: false,
			});
		}

		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const todayKey = `${today.getFullYear()}-${String(
			today.getMonth() + 1,
		).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
		const todayItems = plan.itemsByDate.get(todayKey) || [];
		const byId = new Map(candidates.map((block) => [block.id, block]));
		const queue = todayItems
			.map((item) => byId.get(item.id))
			.filter(Boolean) as IRBlockV4[];
		const totalEstimatedMinutes = todayItems.reduce(
			(sum, item) => sum + item.estimatedMinutes,
			0,
		);
		const groupDistribution: Record<string, number> = {};

		for (const block of queue) {
			const groupId = block.meta?.tagGroup || "default";
			groupDistribution[groupId] = (groupDistribution[groupId] || 0) + 1;
		}

		if (queue.length > 0) {
			logger.info(
				`[IRV4SchedulerService] 统一计划生成器产出今日队列: candidate=${
					candidates.length
				}, queue=${queue.length}, est=${totalEstimatedMinutes.toFixed(
					1,
				)}min/${timeBudgetMinutes}min`,
			);
			return {
				queue,
				totalEstimatedMinutes,
				stats: {
					candidateCount: candidates.length,
					scheduledCount: queue.length,
					groupDistribution,
					overBudget: totalEstimatedMinutes > timeBudgetMinutes,
					overBudgetRatio:
						timeBudgetMinutes > 0
							? totalEstimatedMinutes / timeBudgetMinutes
							: 0,
				},
			};
		}

		logger.info(
			"[IRV4SchedulerService] 统一计划生成器未产出今日队列，回退到 DRR 生成器",
		);
		return this.queueGenerator.generateQueue(
			candidates,
			Object.fromEntries(
				candidates.map((block) => [block.id, this.resolveTopicKey(block)]),
			),
			undefined,
			timeBudgetMinutes,
			currentSourcePath,
		);
	}

	private resolveTopicKey(block: IRBlockV4): string {
		const tagGroup = String(block.meta?.tagGroup || "").trim();
		if (tagGroup && tagGroup !== "default") {
			return `tag:${tagGroup}`;
		}
		return `source:${block.sourcePath}`;
	}

	private async applyTagGroupPriorityBiases(
		items: IRPlannedScheduleItem[],
		advSettings: ReturnType<
			IRV4SchedulerService["getAdvancedSettingsSnapshot"]
		>,
	): Promise<void> {
		if (advSettings.enableTagGroupPrior === false || items.length === 0) {
			for (const item of items) {
				item.tagGroupPriorityBias = 0;
			}
			return;
		}

		const uniqueGroupIds = Array.from(
			new Set(
				items
					.map((item) => String(item.tagGroupId || "default").trim())
					.filter((groupId) => groupId && groupId !== "default"),
			),
		);
		const biasByGroup = new Map<string, number>();
		await Promise.all(
			uniqueGroupIds.map(async (groupId) => {
				const profile = await this.tagGroupService.getProfile(groupId);
				biasByGroup.set(
					groupId,
					computeTagGroupPriorityBias(profile, {
						groupId,
						defaultIntervalFactor: advSettings.defaultIntervalFactor,
					}),
				);
			}),
		);

		for (const item of items) {
			const groupId = String(item.tagGroupId || "default").trim() || "default";
			const bias = biasByGroup.get(groupId) ?? 0;
			item.tagGroupPriorityBias = bias;
			item.explanation.secondaryReasons =
				item.explanation.secondaryReasons.filter(
					(reason) => !reason.startsWith("标签组倾向 "),
				);
			if (Math.abs(bias) >= 0.05) {
				item.explanation.secondaryReasons.push(
					`标签组倾向 ${bias > 0 ? "+" : ""}${bias.toFixed(2)}`,
				);
			}
		}
	}

	private toPlannedItem(
		block: IRBlockV4,
		currentSourcePath: string | null,
	): IRPlannedScheduleItem {
		const estimatedMinutes =
			block.stats.impressions > 0 && block.stats.effectiveReadingTimeSec > 0
				? block.stats.effectiveReadingTimeSec / block.stats.impressions / 60
				: 2;
		const nextReviewDate =
			block.nextRepDate > 0 ? new Date(block.nextRepDate) : null;
		const sourceType = isPdfBookmarkTaskId(block.id)
			? "pdf"
			: isEpubBookmarkTaskId(block.id)
			? "epub"
			: "chunk";
		const sequenceMeta = readSequenceMeta(
			(block.meta || {}) as unknown as Record<string, unknown>,
		);

		return {
			id: block.id,
			title: block.blockId || block.id,
			sourceFile: block.sourcePath,
			topicKey: this.resolveTopicKey(block),
			tagGroupId: String(block.meta?.tagGroup || "default").trim() || "default",
			priority: block.priorityUi ?? block.priorityEff ?? 5,
			intervalDays: block.intervalDays ?? 1,
			scheduleStatus: block.status,
			nextRepDate: block.nextRepDate,
			nextReviewDate,
			createdAt:
				typeof block.createdAt === "number" && block.createdAt > 0
					? block.createdAt
					: undefined,
			updatedAt:
				typeof block.updatedAt === "number" && block.updatedAt > 0
					? block.updatedAt
					: undefined,
			estimatedMinutes,
			sourceType,
			...sequenceMeta,
			explanation: this.buildQueueExplanation(
				block,
				estimatedMinutes,
				currentSourcePath,
			),
		};
	}

	private buildQueueExplanation(
		block: IRBlockV4,
		estimatedMinutes: number,
		currentSourcePath: string | null,
	): IRScheduleExplanation {
		const scoreBreakdown = this.profileService.computeProfile({
			scheduleStatus: block.status,
			nextRepDate: block.nextRepDate,
			manualPriority: block.priorityUi,
			effectivePriority: block.priorityEff,
			intervalDays: block.intervalDays,
			estimatedMinutes,
			stats: block.stats,
			nowMs: Date.now(),
			continuityHint:
				currentSourcePath && currentSourcePath === block.sourcePath ? 3 : 0,
		});

		return {
			primaryReason: "由统一今日计划生成器选入会话队列",
			secondaryReasons: [
				`重要性 ${scoreBreakdown.importanceScore.toFixed(1)}`,
				`紧迫性 ${scoreBreakdown.urgencyScore.toFixed(1)}`,
				`连续性 ${scoreBreakdown.continuityScore.toFixed(1)}`,
			],
			manualPriority: block.priorityUi,
			effectivePriority: block.priorityEff,
			isOverdue: block.nextRepDate > 0 && block.nextRepDate < Date.now(),
			overdueDays:
				block.nextRepDate > 0 && block.nextRepDate < Date.now()
					? Math.max(
							1,
							Math.floor(
								(Date.now() - block.nextRepDate) / (24 * 60 * 60 * 1000),
							),
					  )
					: 0,
			hasManualSchedule: Boolean(block.meta?.manualSchedulePinnedDateKey),
			estimatedMinutes,
			scoreBreakdown,
			compositeScore: scoreBreakdown.compositeScore,
		};
	}

	/**
	 * 完成内容块（V4 版本）
	 *
	 * @param blockV4 V4 格式内容块
	 * @param data 完成数据
	 * @param deckPath 牌组路径（用于会话记录）
	 * @returns 更新后的块和调度信息
	 */
	async completeBlockV4(
		blockV4: IRBlockV4,
		data: ReadingCompletionDataV4,
		deckPath = "",
	): Promise<CompleteBlockResultV4> {
		await this.initialize();

		const now = Date.now();

		// 1. 获取标签组参数
		const advancedSettings = this.getAdvancedSettingsSnapshot();
		const tagGroup = blockV4.meta?.tagGroup || "default";
		const profile = await this.tagGroupService.getProfile(tagGroup);
		const mGroup = advancedSettings.enableTagGroupPrior
			? profile.intervalFactorBase || 1.0
			: 1.0;

		// 2. 更新统计数据
		let updatedBlock = this.stateMachine.updateStats(
			blockV4,
			data.readingTimeSeconds,
			Math.min(data.readingTimeSeconds, 600), // 有效时长最多10分钟
			data.createdExtractCount,
			data.createdCardCount,
			data.createdNoteCount,
		);

		// 3. 根据评分计算优先级调整
		// rating: 1=完全不懂, 2=有点困难, 3=基本理解, 4=完全掌握
		const ratingPriorityAdjust: Record<number, number> = {
			1: 2, // 不懂 → 优先级+2
			2: 1, // 困难 → 优先级+1
			3: 0, // 基本理解 → 不变
			4: -1, // 掌握 → 优先级-1
		};
		const priorityDelta = ratingPriorityAdjust[data.rating] || 0;
		const newPriorityUi = Math.max(
			0,
			Math.min(10, data.priorityUi + priorityDelta),
		);

		// 更新优先级（使用时间感知 EWMA，读取 halfLifeDays 设置）
		const halfLifeDays = advancedSettings.priorityHalfLifeDays;
		const lastInteractionMs = updatedBlock.stats.lastInteraction || 0;
		const newPriorityEff = calculatePriorityEWMA(
			newPriorityUi,
			updatedBlock.priorityEff,
			halfLifeDays,
			lastInteractionMs > 0 ? lastInteractionMs : undefined,
		);

		updatedBlock = {
			...updatedBlock,
			priorityUi: newPriorityUi,
			priorityEff: newPriorityEff,
		};

		// 4. 状态迁移: active → queued（重新入队）
		// 读取用户配置的间隔因子和最大间隔
		const mBase = advancedSettings.defaultIntervalFactor ?? M_BASE;
		const maxInterval = advancedSettings.maxIntervalDays ?? 365;

		if (updatedBlock.status === "active") {
			updatedBlock = this.stateMachine.transitionBackToQueued(
				updatedBlock,
				mBase,
				mGroup,
				maxInterval,
			);
		} else if (updatedBlock.status === "scheduled") {
			updatedBlock = this.stateMachine.transitionToActive(updatedBlock);
			updatedBlock = this.stateMachine.transitionBackToQueued(
				updatedBlock,
				mBase,
				mGroup,
				maxInterval,
			);
		} else {
			const newInterval = calculateNextInterval(
				updatedBlock.intervalDays || 1,
				mBase,
				mGroup,
				updatedBlock.priorityEff,
				maxInterval,
			);
			const newNextRepDate = calculateNextRepDate(newInterval);
			updatedBlock = {
				...updatedBlock,
				intervalDays: newInterval,
				nextRepDate: newNextRepDate,
				status: "queued" as IRBlockStatus,
				updatedAt: now,
			};
		}

		// 5. 持久化调度（L0 mutator 单写者）
		await persistBlockScheduleState(this.app, blockV4, updatedBlock);

		if (isPdfBookmarkTaskId(updatedBlock.id)) {
			await this._pdfBookmarkTaskService.recordTaskInteraction(
				updatedBlock.id,
				data.readingTimeSeconds,
				{
					extracts: data.createdExtractCount,
					cardsCreated: data.createdCardCount,
					notesWritten: data.createdNoteCount,
				},
			);
		} else if (isEpubBookmarkTaskId(updatedBlock.id)) {
			await this._epubBookmarkTaskService.recordTaskInteraction(
				updatedBlock.id,
				data.readingTimeSeconds,
				{
					extracts: data.createdExtractCount,
					cardsCreated: data.createdCardCount,
					notesWritten: data.createdNoteCount,
				},
			);
		} else {
			await this.chunkAdapter.recordChunkInteraction(
				updatedBlock.id,
				data.readingTimeSeconds,
				{
					extracts: data.createdExtractCount,
					cardsCreated: data.createdCardCount,
					notesWritten: data.createdNoteCount,
				},
				{ skipScheduleCacheInvalidate: true },
			);
		}

		// 7. 记录会话历史
		await this.recordSession(updatedBlock, data, deckPath, "completed");

		// 8. 更新标签组参数（学习信号）- 使用已有的 updateGroupProfile 方法
		if (advancedSettings.tagGroupLearningSpeed !== "off") {
			const loadSignal = calculateLoadSignal(
				data.readingTimeSeconds,
				data.createdCardCount,
				data.createdExtractCount,
				data.createdNoteCount,
			);

			const priorityEff = updatedBlock.priorityEff ?? 5;
			const priorityWeight = Math.max(
				advancedSettings.priorityWeightClamp[0],
				Math.min(
					advancedSettings.priorityWeightClamp[1],
					0.5 + priorityEff / 10,
				),
			);

			await this.tagGroupService.updateGroupProfile(
				tagGroup,
				loadSignal,
				priorityWeight,
				advancedSettings,
			);
		}

		// 9. 标签漂移检测：检查源文档标签是否变化导致匹配到不同标签组
		if (
			!isPdfBookmarkTaskId(updatedBlock.id) &&
			!isEpubBookmarkTaskId(updatedBlock.id) &&
			advancedSettings.enableTagGroupPrior
		) {
			try {
				const followMode = this.getTagGroupFollowMode();
				if (followMode !== "off") {
					// 通过 sourceId 获取源文档的真实原始路径（而非 chunk 文件路径）
					const chunkData = await this.storageService.getChunkData(
						updatedBlock.id,
					);
					const sourceId = chunkData?.sourceId;
					const source = sourceId
						? await this.storageService.getSource(sourceId)
						: null;
					const originalPath = source?.originalPath || updatedBlock.sourcePath;

					if (originalPath) {
						// 检查源文件是否存在，不存在则跳过漂移检测
						const sourceFile =
							this.app.vault.getAbstractFileByPath(originalPath);
						if (sourceFile) {
							const drift = await this.tagGroupService.detectTagGroupDrift(
								originalPath,
								tagGroup,
							);
							if (drift) {
								const storageAdapter = {
									getChunkData: (id: string) =>
										this.storageService.getChunkData(id),
									saveChunkData: (data: IRChunkFileData) =>
										this.storageService.saveChunkData(data),
									getSource: (id: string) => this.storageService.getSource(id),
									saveSource: (data: IRSourceFileMeta) =>
										this.storageService.saveSource(data),
									getAllChunkData: () => this.storageService.getAllChunkData(),
								};

								if (followMode === "auto") {
									// 静默自动切换（批量更新同源所有 chunk）
									await this.tagGroupService.applyTagGroupSwitch(
										updatedBlock.id,
										sourceId,
										drift.newGroupId,
										storageAdapter,
									);
									updatedBlock = {
										...updatedBlock,
										meta: { ...updatedBlock.meta, tagGroup: drift.newGroupId },
									};
									logger.info(
										`[IRV4SchedulerService] 标签组自动切换: ${updatedBlock.id}, ` +
											`${drift.oldGroupName} -> ${drift.newGroupName}`,
									);
								} else {
									// ask 模式：弹出通知提醒用户
									const blockId = updatedBlock.id;
									const capturedSourceId = sourceId;
									const newGroupId = drift.newGroupId;

									const fragment = activeDocument.createDocumentFragment();
									const msgEl = fragment.createEl("div");
									msgEl.createEl("div", {
										text: i18n.t("irServiceNotices.scheduler.tagDriftTitle", {
											fileName: originalPath.split("/").pop() || originalPath,
										}),
									});
									msgEl.createEl("div", {
										text: i18n.t(
											"irServiceNotices.scheduler.tagDriftDescription",
											{
												newName: drift.newGroupName,
												oldName: drift.oldGroupName,
											},
										),
										cls: "weave-ir-tag-drift-description",
									});
									const btnRow = msgEl.createEl("div", {
										cls: "weave-ir-tag-drift-actions",
									});
									const switchBtn = btnRow.createEl("button", {
										text: i18n.t("irServiceNotices.scheduler.switchBtn"),
									});
									switchBtn.addClass("weave-ir-tag-drift-button");
									const keepBtn = btnRow.createEl("button", {
										text: i18n.t("irServiceNotices.scheduler.keepBtn"),
									});
									keepBtn.addClass("weave-ir-tag-drift-button");

									const notice = new Notice(fragment, 15000);

									switchBtn.addEventListener("click", () => {
										void (async () => {
											try {
												await this.tagGroupService.applyTagGroupSwitch(
													blockId,
													capturedSourceId,
													newGroupId,
													storageAdapter,
												);
												new Notice(
													i18n.t(
														"irServiceNotices.scheduler.switchedTagGroup",
														{
															groupName: drift.newGroupName,
														},
													),
												);
											} catch (e) {
												logger.error(
													"[IRV4SchedulerService] 标签组切换失败:",
													e,
												);
											}
											notice.hide();
										})();
									});
									keepBtn.addEventListener("click", () => {
										notice.hide();
									});
								}
							}
						}
					}
				}
			} catch (driftError) {
				logger.debug(
					"[IRV4SchedulerService] 标签漂移检测失败（不影响主流程）:",
					driftError,
				);
			}
		}

		logger.info(
			`[IRV4SchedulerService] completeBlockV4: ${updatedBlock.id}, ` +
				`rating=${data.rating}, interval=${updatedBlock.intervalDays.toFixed(
					1,
				)}d, ` +
				`nextRep=${new Date(updatedBlock.nextRepDate).toLocaleDateString()}`,
		);

		const futurePlanPreview = deckPath
			? await this.previewFuturePlanForBlockMutation(
					deckPath,
					blockV4,
					updatedBlock,
			  )
			: undefined;

		return {
			block: updatedBlock,
			nextRepDate: updatedBlock.nextRepDate,
			intervalDays: updatedBlock.intervalDays,
			futurePlanPreview,
		};
	}

	/**
	 * 跳过内容块（不更新调度间隔，仅记录）
	 *
	 * @param blockV4 V4 格式内容块
	 * @param deckPath 牌组路径
	 */
	async skipBlockV4(blockV4: IRBlockV4, deckPath = ""): Promise<void> {
		await this.initialize();

		// 记录会话（跳过）
		await this.recordSession(
			blockV4,
			{
				rating: 0,
				readingTimeSeconds: 0,
				priorityUi: blockV4.priorityUi,
				createdCardCount: 0,
				createdExtractCount: 0,
				createdNoteCount: 0,
			},
			deckPath,
			"skipped",
		);

		logger.debug(`[IRV4SchedulerService] skipBlockV4: ${blockV4.id}`);
	}

	/**
	 * 更新优先级（带强制理由）
	 *
	 * @param blockV4 V4 格式内容块
	 * @param newPriorityUi 新优先级 (0-10)
	 * @param reason 变更理由
	 * @returns 更新后的块
	 */
	async updatePriorityV4(
		blockV4: IRBlockV4,
		newPriorityUi: number,
		reason: string,
	): Promise<IRBlockV4> {
		await this.initialize();

		const updatedBlock = this.createPriorityUpdatedBlock(
			blockV4,
			newPriorityUi,
			reason,
		);

		// 持久化
		if (isPdfBookmarkTaskId(updatedBlock.id)) {
			await this._pdfBookmarkTaskService.updateTaskFromBlock(updatedBlock);
		} else if (isEpubBookmarkTaskId(updatedBlock.id)) {
			await this._epubBookmarkTaskService.updateTaskFromBlock(updatedBlock);
		} else {
			await this.chunkAdapter.updateChunkSchedule(updatedBlock.id, {
				priorityUi: updatedBlock.priorityUi,
				priorityEff: updatedBlock.priorityEff,
			});
		}

		logger.info(
			`[IRV4SchedulerService] updatePriorityV4: ${updatedBlock.id}, ` +
				`UI=${
					blockV4.priorityUi
				}→${newPriorityUi}, Eff=${updatedBlock.priorityEff.toFixed(2)}`,
		);

		return updatedBlock;
	}

	async previewPriorityUpdateV4(
		blockV4: IRBlockV4,
		newPriorityUi: number,
		reason: string,
		_deckPath: string,
	): Promise<IRPriorityUpdateResultV4> {
		await this.initialize();
		const updatedBlock = this.createPriorityUpdatedBlock(
			blockV4,
			newPriorityUi,
			reason,
		);

		return {
			block: updatedBlock,
			futurePlanPreview: undefined,
		};
	}

	async updatePriorityWithPreviewV4(
		blockV4: IRBlockV4,
		newPriorityUi: number,
		reason: string,
		_deckPath: string,
	): Promise<IRPriorityUpdateResultV4> {
		const updatedBlock = await this.updatePriorityV4(
			blockV4,
			newPriorityUi,
			reason,
		);

		return {
			block: updatedBlock,
			futurePlanPreview: undefined,
		};
	}

	/**
	 * 搁置内容块（暂停调度，可恢复）
	 */
	async suspendBlockV4(blockV4: IRBlockV4): Promise<IRBlockV4> {
		await this.initialize();

		const updatedBlock = this.stateMachine.transitionToSuspended(blockV4);

		// 持久化
		if (isPdfBookmarkTaskId(updatedBlock.id)) {
			await this._pdfBookmarkTaskService.updateTaskFromBlock(updatedBlock);
		} else if (isEpubBookmarkTaskId(updatedBlock.id)) {
			await this._epubBookmarkTaskService.updateTaskFromBlock(updatedBlock);
		} else {
			await this.chunkAdapter.updateChunkSchedule(updatedBlock.id, {
				scheduleStatus: "suspended",
			});
		}

		logger.info(`[IRV4SchedulerService] suspendBlockV4: ${updatedBlock.id}`);

		return updatedBlock;
	}

	async suspendBlockWithPreviewV4(
		blockV4: IRBlockV4,
		deckPath: string,
	): Promise<IRBlockMutationPreviewResultV4> {
		const updatedBlock = await this.suspendBlockV4(blockV4);
		const futurePlanPreview = deckPath
			? await this.previewFuturePlanForBlockMutation(
					deckPath,
					blockV4,
					updatedBlock,
			  )
			: undefined;

		return {
			block: updatedBlock,
			futurePlanPreview,
		};
	}

	/**
	 * 恢复内容块
	 */
	async resumeBlockV4(blockV4: IRBlockV4): Promise<IRBlockV4> {
		await this.initialize();

		let updatedBlock: IRBlockV4;

		if (blockV4.status === "suspended") {
			updatedBlock = this.stateMachine.resumeFromSuspended(blockV4);
		} else {
			// 非 suspended 状态，设置为 queued 并立即到期
			updatedBlock = {
				...blockV4,
				status: "queued" as IRBlockStatus,
				nextRepDate: Date.now(),
				updatedAt: Date.now(),
			};
		}

		// 持久化
		if (isPdfBookmarkTaskId(updatedBlock.id)) {
			await this._pdfBookmarkTaskService.updateTaskFromBlock(updatedBlock);
		} else if (isEpubBookmarkTaskId(updatedBlock.id)) {
			await this._epubBookmarkTaskService.updateTaskFromBlock(updatedBlock);
		} else {
			await this.chunkAdapter.updateChunkSchedule(updatedBlock.id, {
				scheduleStatus: updatedBlock.status,
				nextRepDate: updatedBlock.nextRepDate,
			});
		}

		logger.info(`[IRV4SchedulerService] resumeBlockV4: ${updatedBlock.id}`);

		return updatedBlock;
	}

	async resumeBlockWithPreviewV4(
		blockV4: IRBlockV4,
		deckPath: string,
	): Promise<IRBlockMutationPreviewResultV4> {
		const updatedBlock = await this.resumeBlockV4(blockV4);
		const futurePlanPreview = deckPath
			? await this.previewFuturePlanForBlockMutation(
					deckPath,
					blockV4,
					updatedBlock,
			  )
			: undefined;

		return {
			block: updatedBlock,
			futurePlanPreview,
		};
	}

	/**
	 * 归档内容块（用户已完全理解，正面完成）
	 */
	async archiveBlockV4(blockV4: IRBlockV4): Promise<IRBlockV4> {
		await this.initialize();

		let updatedBlock: IRBlockV4;

		if (blockV4.status === "active") {
			updatedBlock = this.stateMachine.transitionToDone(blockV4, "archived");
		} else {
			const now = Date.now();
			updatedBlock = {
				...blockV4,
				status: "done" as IRBlockStatus,
				doneReason: "archived",
				doneAt: now,
				updatedAt: now,
			};
		}

		// 持久化
		if (isPdfBookmarkTaskId(updatedBlock.id)) {
			await this._pdfBookmarkTaskService.updateTaskFromBlock(updatedBlock);
		} else if (isEpubBookmarkTaskId(updatedBlock.id)) {
			await this._epubBookmarkTaskService.updateTaskFromBlock(updatedBlock);
		} else {
			await this.chunkAdapter.updateChunkSchedule(updatedBlock.id, {
				scheduleStatus: "done",
				doneReason: "archived",
				doneAt: updatedBlock.doneAt,
			});
		}

		await this.storageService.markMarkdownSourceArchived(updatedBlock.sourcePath);

		// 记录会话（归档）
		await this.recordSession(
			updatedBlock,
			{
				rating: 0,
				readingTimeSeconds: 0,
				priorityUi: updatedBlock.priorityUi,
				createdCardCount: 0,
				createdExtractCount: 0,
				createdNoteCount: 0,
			},
			"",
			"completed",
		);

		logger.info(`[IRV4SchedulerService] archiveBlockV4: ${updatedBlock.id}`);

		return updatedBlock;
	}

	/**
	 * Compatibility note: 使用 archiveBlockV4 代替
	 */
	async markBlockDoneV4(blockV4: IRBlockV4): Promise<IRBlockV4> {
		return this.archiveBlockV4(blockV4);
	}

	/**
	 * 移除内容块（从队列永久移除，保留历史记录）
	 */
	async removeBlockV4(blockV4: IRBlockV4): Promise<IRBlockV4> {
		await this.initialize();

		let updatedBlock: IRBlockV4;

		if (
			blockV4.status === "active" ||
			blockV4.status === "queued" ||
			blockV4.status === "scheduled"
		) {
			updatedBlock = this.stateMachine.transitionToRemoved(blockV4);
		} else {
			const now = Date.now();
			updatedBlock = {
				...blockV4,
				status: "removed" as IRBlockStatus,
				doneReason: "removed",
				doneAt: now,
				updatedAt: now,
			};
		}

		// 持久化
		if (isPdfBookmarkTaskId(updatedBlock.id)) {
			await this._pdfBookmarkTaskService.updateTaskFromBlock(updatedBlock);
		} else if (isEpubBookmarkTaskId(updatedBlock.id)) {
			await this._epubBookmarkTaskService.updateTaskFromBlock(updatedBlock);
		} else {
			await this.chunkAdapter.updateChunkSchedule(updatedBlock.id, {
				scheduleStatus: "removed",
				doneReason: "removed",
				doneAt: updatedBlock.doneAt,
			});
		}

		logger.info(`[IRV4SchedulerService] removeBlockV4: ${updatedBlock.id}`);

		return updatedBlock;
	}

	async archiveBlockWithPreviewV4(
		blockV4: IRBlockV4,
		deckPath: string,
	): Promise<IRBlockMutationPreviewResultV4> {
		const updatedBlock = await this.archiveBlockV4(blockV4);
		const futurePlanPreview = deckPath
			? await this.previewFuturePlanForBlockMutation(
					deckPath,
					blockV4,
					updatedBlock,
			  )
			: undefined;

		return {
			block: updatedBlock,
			futurePlanPreview,
		};
	}

	async removeBlockWithPreviewV4(
		blockV4: IRBlockV4,
		deckPath: string,
	): Promise<IRBlockMutationPreviewResultV4> {
		const updatedBlock = await this.removeBlockV4(blockV4);
		const futurePlanPreview = deckPath
			? await this.previewFuturePlanForBlockMutation(
					deckPath,
					blockV4,
					updatedBlock,
			  )
			: undefined;

		return {
			block: updatedBlock,
			futurePlanPreview,
		};
	}

	async manualRescheduleBlockWithPreviewV4(
		blockV4: IRBlockV4,
		options: IRManualRescheduleOptionsV4,
		deckPath: string,
	): Promise<IRBlockMutationPreviewResultV4> {
		await this.initialize();

		const updatedBlock = this.createManualRescheduledBlock(blockV4, options);

		await persistBlockScheduleState(this.app, blockV4, updatedBlock);
		await recordScheduleMenuActionInteraction(this.app, updatedBlock.id);

		const futurePlanPreview = deckPath
			? await this.previewFuturePlanForBlockMutation(
					deckPath,
					blockV4,
					updatedBlock,
			  )
			: undefined;

		logger.info(
			`[IRV4SchedulerService] manualRescheduleBlockWithPreviewV4: ${updatedBlock.id}, ` +
				`nextRep=${
					updatedBlock.nextRepDate > 0
						? new Date(updatedBlock.nextRepDate).toLocaleDateString()
						: "unset"
				}`,
		);

		return {
			block: updatedBlock,
			futurePlanPreview,
		};
	}

	async previewManualRescheduleBlockV4(
		blockV4: IRBlockV4,
		options: IRManualRescheduleOptionsV4,
		deckPath: string,
		previewOptions?: { includeImpactPreview?: boolean },
	): Promise<IRBlockMutationPreviewResultV4> {
		await this.initialize();

		const updatedBlock = this.createManualRescheduledBlock(blockV4, options);
		const includeImpactPreview = previewOptions?.includeImpactPreview === true;
		const futurePlanPreview =
			includeImpactPreview && deckPath
				? await this.previewFuturePlanForBlockMutation(
						deckPath,
						blockV4,
						updatedBlock,
				  )
				: undefined;

		return {
			block: updatedBlock,
			futurePlanPreview,
		};
	}

	async postponeBlockWithPreviewV4(
		blockV4: IRBlockV4,
		days: number,
		deckPath: string,
	): Promise<IRBlockMutationPreviewResultV4> {
		const base =
			blockV4.nextRepDate > 0 ? new Date(blockV4.nextRepDate) : new Date();
		base.setHours(0, 0, 0, 0);
		base.setDate(base.getDate() + Math.max(1, Math.round(days)));

		return this.manualRescheduleBlockWithPreviewV4(
			blockV4,
			{
				nextRepDate: base.getTime(),
				scheduleStatus: "queued",
			},
			deckPath,
		);
	}

	async previewPostponeBlockV4(
		blockV4: IRBlockV4,
		days: number,
		deckPath: string,
	): Promise<IRBlockMutationPreviewResultV4> {
		const base =
			blockV4.nextRepDate > 0 ? new Date(blockV4.nextRepDate) : new Date();
		base.setHours(0, 0, 0, 0);
		base.setDate(base.getDate() + Math.max(1, Math.round(days)));

		return this.previewManualRescheduleBlockV4(
			blockV4,
			{
				nextRepDate: base.getTime(),
				scheduleStatus: "queued",
			},
			deckPath,
		);
	}

	async applyScheduleModeWithPreviewV4(
		blockV4: IRBlockV4,
		mode: IRScheduleModeV4,
		deckPath: string,
	): Promise<IRBlockMutationPreviewResultV4> {
		await this.initialize();
		const updatedBlock = await this.createScheduleModeAdjustedBlock(
			blockV4,
			mode,
		);

		return this.manualRescheduleBlockWithPreviewV4(
			blockV4,
			{
				nextRepDate: updatedBlock.nextRepDate,
				intervalDays: updatedBlock.intervalDays,
				scheduleStatus: updatedBlock.status,
			},
			deckPath,
		);
	}

	async previewScheduleModeBlockV4(
		blockV4: IRBlockV4,
		mode: IRScheduleModeV4,
		deckPath: string,
	): Promise<IRBlockMutationPreviewResultV4> {
		await this.initialize();
		const updatedBlock = await this.createScheduleModeAdjustedBlock(
			blockV4,
			mode,
		);

		return this.previewManualRescheduleBlockV4(
			blockV4,
			{
				nextRepDate: updatedBlock.nextRepDate,
				intervalDays: updatedBlock.intervalDays,
				scheduleStatus: updatedBlock.status,
			},
			deckPath,
		);
	}

	private createManualRescheduledBlock(
		blockV4: IRBlockV4,
		options: IRManualRescheduleOptionsV4,
	): IRBlockV4 {
		const meta = { ...(blockV4.meta || {}) };
		if (options.nextRepDate > 0) {
			meta.manualSchedulePinnedDateKey = this.formatScheduleDateKey(
				options.nextRepDate,
			);
		} else {
			meta.manualSchedulePinnedDateKey = undefined;
		}
		return {
			...blockV4,
			nextRepDate: options.nextRepDate,
			intervalDays: options.intervalDays ?? blockV4.intervalDays,
			status: options.scheduleStatus ?? blockV4.status,
			updatedAt: Date.now(),
			meta,
		};
	}

	private formatScheduleDateKey(timestamp: number): string {
		const date = new Date(timestamp);
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
			2,
			"0",
		)}-${String(date.getDate()).padStart(2, "0")}`;
	}

	private createPriorityUpdatedBlock(
		blockV4: IRBlockV4,
		newPriorityUi: number,
		reason: string,
	): IRBlockV4 {
		return this.stateMachine.updatePriority(blockV4, newPriorityUi, reason);
	}

	private async createScheduleModeAdjustedBlock(
		blockV4: IRBlockV4,
		mode: IRScheduleModeV4,
	): Promise<IRBlockV4> {
		const advancedSettings = this.getAdvancedSettingsSnapshot();
		const tagGroup = blockV4.meta?.tagGroup || "default";
		const profile = await this.tagGroupService.getProfile(tagGroup);
		const mGroup = advancedSettings.enableTagGroupPrior
			? profile.intervalFactorBase || 1.0
			: 1.0;

		return computeScheduleModeAdjustedBlock(blockV4, mode, {
			block: blockV4,
			advancedSettings,
			tagGroupIntervalFactor: mGroup,
		});
	}

	/**
	 * 删除内容块（彻底清除调度记录，可选删除 chunk 文件，不删除源文档）
	 */
	async deleteBlockV4(
		blockV4: IRBlockV4,
		deleteChunkFile = true,
	): Promise<void> {
		await this.initialize();

		if (isPdfBookmarkTaskId(blockV4.id)) {
			await new IRPointWriteService(this.app).deletePoint({ id: blockV4.id });
		} else if (isEpubBookmarkTaskId(blockV4.id)) {
			await new IRPointWriteService(this.app).deletePoint({ id: blockV4.id });
		} else {
			// 1. 删除 chunk 阅读点调度记录（旧 chunks 文件存在时会同步维护兼容层）
			await this.storageService.deleteChunkData(blockV4.id);

			// 2. 可选删除 chunk 文件（IR 导入时创建的拆分文件）
			if (deleteChunkFile && blockV4.sourcePath) {
				try {
					const file = this.app.vault.getAbstractFileByPath(blockV4.sourcePath);
					if (file instanceof TFile) {
						await this.app.fileManager.trashFile(file);
						logger.debug(
							`[IRV4SchedulerService] 已删除 chunk 文件: ${blockV4.sourcePath}`,
						);
					}
				} catch (error) {
					logger.warn(
						`[IRV4SchedulerService] 删除 chunk 文件失败: ${blockV4.sourcePath}`,
						error,
					);
				}
			}

			// 3. 同步维护 source 的 chunkIds 兼容投影视图
			try {
				const sources = await this.storageService.getAllSources();
				for (const source of Object.values(sources)) {
					if (source.chunkIds?.includes(blockV4.id)) {
						source.chunkIds = source.chunkIds.filter(
							(_id) => _id !== blockV4.id,
						);
						source.updatedAt = Date.now();
						await this.storageService.saveSource(source);
					}
				}
			} catch (error) {
				logger.warn("[IRV4SchedulerService] 更新 source chunkIds 失败:", error);
			}
		}

		logger.info(
			`[IRV4SchedulerService] deleteBlockV4: ${blockV4.id}, deleteFile=${deleteChunkFile}`,
		);
	}

	/**
	 * Batch-delete content blocks with one coalesced point-storage write pass.
	 * Single-item calls keep deleteBlockV4 for full legacy cleanup.
	 */
	async deleteBlocksV4(
		blocks: IRBlockV4[],
		deleteChunkFile = true,
	): Promise<void> {
		const uniqueBlocks: IRBlockV4[] = [];
		const seen = new Set<string>();
		for (const block of Array.isArray(blocks) ? blocks : []) {
			const blockId = String(block?.id || "").trim();
			if (!blockId || seen.has(blockId)) {
				continue;
			}
			seen.add(blockId);
			uniqueBlocks.push(block);
		}
		if (uniqueBlocks.length === 0) {
			return;
		}
		if (uniqueBlocks.length === 1) {
			await this.deleteBlockV4(uniqueBlocks[0], deleteChunkFile);
			return;
		}

		await this.initialize();

		const pointIds = uniqueBlocks.map((block) => block.id);
		await new IRPointWriteService(this.app).deletePoints(
			pointIds.map((id) => ({ id })),
		);

		const deletedIdSet = new Set(pointIds);
		const chunkBlocks = uniqueBlocks.filter(
			(block) =>
				!isPdfBookmarkTaskId(block.id) && !isEpubBookmarkTaskId(block.id),
		);

		if (deleteChunkFile) {
			for (const block of chunkBlocks) {
				if (!block.sourcePath) {
					continue;
				}
				try {
					const file = this.app.vault.getAbstractFileByPath(block.sourcePath);
					if (file instanceof TFile) {
						await this.app.fileManager.trashFile(file);
						logger.debug(
							`[IRV4SchedulerService] 已删除 chunk 文件: ${block.sourcePath}`,
						);
					}
				} catch (error) {
					logger.warn(
						`[IRV4SchedulerService] 删除 chunk 文件失败: ${block.sourcePath}`,
						error,
					);
				}
			}
		}

		if (chunkBlocks.length > 0) {
			try {
				const sources = await this.storageService.getAllSources();
				for (const source of Object.values(sources)) {
					const currentIds = Array.isArray(source.chunkIds)
						? source.chunkIds
						: [];
					if (!currentIds.some((id) => deletedIdSet.has(id))) {
						continue;
					}
					source.chunkIds = currentIds.filter((id) => !deletedIdSet.has(id));
					source.updatedAt = Date.now();
					await this.storageService.saveSource(source);
				}
			} catch (error) {
				logger.warn(
					"[IRV4SchedulerService] 批量更新 source chunkIds 失败:",
					error,
				);
			}
		}

		logger.info(
			`[IRV4SchedulerService] deleteBlocksV4: ${uniqueBlocks.length} blocks, deleteFile=${deleteChunkFile}`,
		);
	}

	/**
	 * 强制恢复内容块（从 done/removed 状态重新激活）
	 */
	async forceReactivateBlockV4(blockV4: IRBlockV4): Promise<IRBlockV4> {
		await this.initialize();

		const updatedBlock = this.stateMachine.forceReactivate(blockV4);

		// 持久化
		if (isPdfBookmarkTaskId(updatedBlock.id)) {
			await this._pdfBookmarkTaskService.updateTaskFromBlock(updatedBlock);
		} else if (isEpubBookmarkTaskId(updatedBlock.id)) {
			await this._epubBookmarkTaskService.updateTaskFromBlock(updatedBlock);
		} else {
			await this.chunkAdapter.updateChunkSchedule(updatedBlock.id, {
				scheduleStatus: updatedBlock.status,
				nextRepDate: updatedBlock.nextRepDate,
			});
		}

		logger.info(
			`[IRV4SchedulerService] forceReactivateBlockV4: ${updatedBlock.id}`,
		);

		return updatedBlock;
	}

	async forceReactivateBlockWithPreviewV4(
		blockV4: IRBlockV4,
		deckPath: string,
	): Promise<IRBlockMutationPreviewResultV4> {
		const updatedBlock = await this.forceReactivateBlockV4(blockV4);
		const futurePlanPreview = deckPath
			? await this.previewFuturePlanForBlockMutation(
					deckPath,
					blockV4,
					updatedBlock,
			  )
			: undefined;

		return {
			block: updatedBlock,
			futurePlanPreview,
		};
	}

	/**
	 * 记录会话历史
	 */
	private async recordSession(
		block: IRBlockV4,
		data: ReadingCompletionDataV4,
		deckPath: string,
		action: "completed" | "skipped",
	): Promise<void> {
		const now = new Date();
		const canonicalDeckId = await this.resolveCanonicalDeckId(deckPath);

		const session: IRSession = {
			id: generateCardUUID(),
			blockId: block.id,
			deckId: canonicalDeckId,
			startTime: new Date(
				now.getTime() - data.readingTimeSeconds * 1000,
			).toISOString(),
			endTime: now.toISOString(),
			duration: data.readingTimeSeconds,
			action,
			rating: data.rating || undefined,
		};

		await this.storageService.addSession(session);
	}

	private async recordZeroSignalInteraction(blockId: string): Promise<void> {
		await recordScheduleMenuActionInteraction(this.app, blockId);
	}

	/**
	 * V3 兼容：将 IRBlock 转换为 IRBlockV4 并完成
	 */
	async completeBlockFromV3(
		blockV3: IRBlock,
		data: ReadingCompletionDataV4,
		deckPath = "",
	): Promise<{ block: IRBlock; nextRepDate: number; intervalDays: number }> {
		// 转换为 V4
		const blockV4 = migrateToIRBlockV4(blockV3);

		// 调用 V4 完成逻辑
		const result = await this.completeBlockV4(blockV4, data, deckPath);

		// 转换回 V3
		const updatedV3 = this.storageAdapterV4.v4ToV3Public(result.block);

		return {
			block: updatedV3,
			nextRepDate: result.nextRepDate,
			intervalDays: result.intervalDays,
		};
	}

	/**
	 * V3 兼容：将 IRBlock 转换为 IRBlockV4 并跳过
	 */
	async skipBlockFromV3(blockV3: IRBlock, deckPath = ""): Promise<void> {
		const blockV4 = migrateToIRBlockV4(blockV3);
		await this.skipBlockV4(blockV4, deckPath);
	}

	/**
	 * 获取存储适配器（供外部使用）
	 */
	getStorageAdapter(): IRStorageAdapterV4 {
		return this.storageAdapterV4;
	}

	/**
	 * 获取标签组服务（供外部使用）
	 */
	getTagGroupService(): IRTagGroupService {
		return this.tagGroupService;
	}

	async previewFuturePlanForBlockMutation(
		deckPath: string,
		originalBlock: IRBlockV4,
		updatedBlock: IRBlockV4,
	): Promise<IRFuturePlanPreview | undefined> {
		try {
			const kernel = getSharedIRScheduleKernel(this.app);
			const impact = await kernel.previewScheduleImpact(
				{
					itemId: originalBlock.id,
					manualPriority: updatedBlock.priorityUi,
					effectivePriority: updatedBlock.priorityEff,
					nextRepDate: updatedBlock.nextRepDate,
					intervalDays: updatedBlock.intervalDays,
					scheduleStatus: updatedBlock.status,
				},
				{
					deckIds: [deckPath],
				},
			);
			const changeSummary = this.summarizeFuturePlanChanges(
				impact.before.days,
				impact.after.days,
			);

			return {
				generatedAt: impact.after.generatedAt,
				days: impact.after.days,
				changeSummary,
			};
		} catch (error) {
			logger.warn("[IRV4SchedulerService] 生成 futurePlanPreview 失败:", {
				deckPath,
				error,
			});
			return undefined;
		}
	}

	private summarizeFuturePlanChanges(
		beforeDays: IRPlannedDay[],
		afterDays: IRPlannedDay[],
	): IRFuturePlanChangeSummary {
		const beforeByItem = new Map<string, { dateKey: string; title: string }>();
		const afterByItem = new Map<string, { dateKey: string; title: string }>();

		for (const day of beforeDays) {
			for (const item of day.items) {
				beforeByItem.set(item.id, { dateKey: day.dateKey, title: item.title });
			}
		}
		for (const day of afterDays) {
			for (const item of day.items) {
				afterByItem.set(item.id, { dateKey: day.dateKey, title: item.title });
			}
		}

		const allItemIds = new Set<string>([
			...beforeByItem.keys(),
			...afterByItem.keys(),
		]);
		const movedItems: Array<{
			itemId: string;
			title: string;
			fromDateKey?: string;
			toDateKey?: string;
			changeType: "moved" | "entered" | "removed";
		}> = [];

		for (const itemId of allItemIds) {
			const before = beforeByItem.get(itemId);
			const after = afterByItem.get(itemId);
			if (before && after && before.dateKey !== after.dateKey) {
				movedItems.push({
					itemId,
					title: after.title || before.title,
					fromDateKey: before.dateKey,
					toDateKey: after.dateKey,
					changeType: "moved",
				});
			} else if (!before && after) {
				movedItems.push({
					itemId,
					title: after.title,
					toDateKey: after.dateKey,
					changeType: "entered",
				});
			} else if (before && !after) {
				movedItems.push({
					itemId,
					title: before.title,
					fromDateKey: before.dateKey,
					changeType: "removed",
				});
			}
		}

		const beforeByDay = new Map(
			beforeDays.map((day) => [day.dateKey, day.totalEstimatedMinutes]),
		);
		const afterByDay = new Map(
			afterDays.map((day) => [day.dateKey, day.totalEstimatedMinutes]),
		);
		const allDayKeys = new Set<string>([
			...beforeByDay.keys(),
			...afterByDay.keys(),
		]);
		const impactedDays = Array.from(allDayKeys)
			.map((dateKey) => ({
				dateKey,
				beforeMinutes: beforeByDay.get(dateKey) ?? 0,
				afterMinutes: afterByDay.get(dateKey) ?? 0,
			}))
			.filter((day) => Math.abs(day.afterMinutes - day.beforeMinutes) >= 0.1)
			.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

		movedItems.sort((a, b) => {
			const left = `${a.fromDateKey || ""}-${a.toDateKey || ""}-${a.itemId}`;
			const right = `${b.fromDateKey || ""}-${b.toDateKey || ""}-${b.itemId}`;
			return left.localeCompare(right);
		});

		return {
			changedItemCount: movedItems.length,
			movedItems: movedItems.slice(0, 12),
			impactedDays,
		};
	}
}
