import type { App } from "obsidian";
import type { IRBlockStatus, IRBlockV4 } from "../../types/ir-types";
import { logger } from "../../utils/logger";
import { getSharedIRCalendarQueryService } from "./IRCalendarQueryService";
import { IRChunkScheduleAdapter } from "./IRChunkScheduleAdapter";
import { getSharedIRDueDateIndexService } from "./IRDueDateIndexService";
import {
	IREpubBookmarkTaskService,
	isEpubBookmarkTaskId,
} from "./IREpubBookmarkTaskService";
import {
	IRPdfBookmarkTaskService,
	isPdfBookmarkTaskId,
} from "./IRPdfBookmarkTaskService";
import { getSharedIRProjectionRuntime } from "./IRProjectionRuntime";
import { getSharedIRScheduleIndexService } from "./IRScheduleIndexService";
import { IRStorageAdapterV4 } from "./IRStorageAdapterV4";
import { IRStorageService } from "./IRStorageService";

export interface PointScheduleMutation {
	nextRepDate?: number;
	intervalDays?: number;
	scheduleStatus?: IRBlockStatus;
	priorityUi?: number;
	priorityEff?: number;
	manualSchedulePinnedDateKey?: string | null;
	/** 设为 0 / null 表示清零手动推迟次数。 */
	manualPostponeCount?: number | null;
}

export interface PointScheduleMutateOptions {
	/** 显式指定变更前的 nextRepDate（用于 due 倒排索引）。 */
	previousNextRepDate?: number;
	/** 写盘后跳过统一 invalidate（调用方自行失效）。 */
	skipInvalidate?: boolean;
}

export interface PointScheduleMutateResult {
	pointId: string;
	previousNextRepDate?: number;
	nextRepDate?: number;
	scheduleFingerprint?: string;
}

/**
 * 将调度 mutation 合成完整 block：顶层只保留 block 字段，meta 字段只进 meta。
 * PDF/EPUB/legacy 共用，避免把 manualPostponeCount 等摊到顶层。
 */
export function applyScheduleMutationToBlock(
	block: IRBlockV4,
	changes: PointScheduleMutation,
): IRBlockV4 {
	const nextMeta = { ...(block.meta || {}) };

	if (changes.manualSchedulePinnedDateKey !== undefined) {
		const pinned = String(changes.manualSchedulePinnedDateKey || "").trim();
		if (pinned) {
			nextMeta.manualSchedulePinnedDateKey = pinned;
		} else {
			delete nextMeta.manualSchedulePinnedDateKey;
		}
	}

	if (changes.manualPostponeCount !== undefined) {
		const count = Math.max(
			0,
			Math.round(Number(changes.manualPostponeCount || 0)) || 0,
		);
		if (count > 0) {
			nextMeta.manualPostponeCount = count;
		} else {
			delete nextMeta.manualPostponeCount;
		}
	}

	const nextBlock: IRBlockV4 = {
		...block,
		meta: nextMeta,
	};

	if (changes.nextRepDate !== undefined) {
		nextBlock.nextRepDate = changes.nextRepDate;
	}
	if (changes.intervalDays !== undefined) {
		nextBlock.intervalDays = changes.intervalDays;
	}
	if (changes.scheduleStatus !== undefined) {
		nextBlock.status = changes.scheduleStatus;
	}
	if (changes.priorityUi !== undefined) {
		nextBlock.priorityUi = changes.priorityUi;
	}
	if (changes.priorityEff !== undefined) {
		nextBlock.priorityEff = changes.priorityEff;
	}

	return nextBlock;
}

/**
 * L0：单点调度写入（chunk / pdf / epub / 未迁移 legacy-block）。
 * 唯一负责：point 调度字段写入、due 倒排增量、受控缓存失效。
 */
export class IRPointScheduleMutator {
	private storage: IRStorageService;
	private chunkAdapter: IRChunkScheduleAdapter;
	private storageAdapterV4: IRStorageAdapterV4;
	private pdfService: IRPdfBookmarkTaskService;
	private epubService: IREpubBookmarkTaskService;

	constructor(private readonly app: App) {
		this.storage = new IRStorageService(app);
		this.chunkAdapter = new IRChunkScheduleAdapter(app, this.storage);
		this.storageAdapterV4 = new IRStorageAdapterV4(app, this.storage);
		this.pdfService = new IRPdfBookmarkTaskService(app);
		this.epubService = new IREpubBookmarkTaskService(app);
	}

	async mutateFromBlock(
		block: IRBlockV4,
		changes: PointScheduleMutation,
		options?: PointScheduleMutateOptions,
	): Promise<PointScheduleMutateResult> {
		await Promise.all([
			this.storage.initialize(),
			this.pdfService.initialize(),
			this.epubService.initialize(),
		]);

		const pointId = String(block.id || "").trim();
		const previousNextRepDate =
			options?.previousNextRepDate !== undefined
				? options.previousNextRepDate
				: Number(block.nextRepDate || 0) || undefined;

		if (isPdfBookmarkTaskId(pointId)) {
			await this.pdfService.updateTaskFromBlock(
				applyScheduleMutationToBlock(block, changes),
			);
		} else if (isEpubBookmarkTaskId(pointId)) {
			await this.epubService.updateTaskFromBlock(
				applyScheduleMutationToBlock(block, changes),
			);
		} else {
			await this.mutateMarkdownPointSchedule(pointId, block, changes);
		}

		const nextRepDate =
			changes.nextRepDate !== undefined
				? changes.nextRepDate
				: previousNextRepDate;

		if (changes.nextRepDate !== undefined) {
			await getSharedIRDueDateIndexService(this.app).updatePointDueDate(
				pointId,
				previousNextRepDate,
				nextRepDate,
			);
			await getSharedIRDueDateIndexService(this.app).flushPendingWrites();
		}

		let scheduleFingerprint: string | undefined;
		if (!options?.skipInvalidate) {
			scheduleFingerprint = await this.invalidateAfterScheduleMutation();
		}

		return {
			pointId,
			previousNextRepDate,
			nextRepDate,
			scheduleFingerprint,
		};
	}

	private async invalidateAfterScheduleMutation(): Promise<string> {
		getSharedIRScheduleIndexService(this.app).invalidate();
		getSharedIRCalendarQueryService(this.app).invalidate();
		getSharedIRProjectionRuntime(this.app).markStale();
		const sources = await getSharedIRScheduleIndexService(
			this.app,
		).getScheduleSources();
		return sources.scheduleFingerprint;
	}

	private async mutateMarkdownPointSchedule(
		pointId: string,
		block: IRBlockV4,
		changes: PointScheduleMutation,
	): Promise<void> {
		const scheduleUpdates = {
			nextRepDate: changes.nextRepDate,
			intervalDays: changes.intervalDays,
			scheduleStatus: changes.scheduleStatus,
			priorityUi: changes.priorityUi,
			priorityEff: changes.priorityEff,
			...(changes.manualSchedulePinnedDateKey !== undefined
				? { manualSchedulePinnedDateKey: changes.manualSchedulePinnedDateKey }
				: {}),
			...(changes.manualPostponeCount !== undefined
				? { manualPostponeCount: changes.manualPostponeCount }
				: {}),
		};

		const chunk = await this.storage.getChunkData(pointId);
		if (chunk) {
			await this.chunkAdapter.updateChunkSchedule(pointId, scheduleUpdates, {
				skipScheduleCacheInvalidate: true,
			});
			return;
		}

		const legacyBlock = await this.storage.getBlock(pointId);
		if (legacyBlock) {
			await this.storageAdapterV4.saveBlockV4(
				applyScheduleMutationToBlock(block, changes),
			);
			this.storage.invalidateScheduleRuntimeCaches({ skipScheduleIndex: true });
			return;
		}

		throw new Error(
			`[IRPointScheduleMutator] 无法持久化调度：阅读点 ${pointId} 在 points/chunk/block 存储中不存在`,
		);
	}
}

const mutatorByApp = new WeakMap<App, IRPointScheduleMutator>();

export function getSharedIRPointScheduleMutator(
	app: App,
): IRPointScheduleMutator {
	let service = mutatorByApp.get(app);
	if (!service) {
		service = new IRPointScheduleMutator(app);
		mutatorByApp.set(app, service);
	}
	return service;
}

export async function mutatePointScheduleFromBlock(
	app: App,
	block: IRBlockV4,
	changes: PointScheduleMutation,
	options?: PointScheduleMutateOptions,
): Promise<PointScheduleMutateResult> {
	try {
		return await getSharedIRPointScheduleMutator(app).mutateFromBlock(
			block,
			changes,
			options,
		);
	} catch (error) {
		logger.warn("[IRPointScheduleMutator] mutate failed", {
			pointId: block.id,
			error,
		});
		throw error;
	}
}

/** 将完整调度状态写入（段落工作台完成等路径）。 */
export async function persistBlockScheduleState(
	app: App,
	before: IRBlockV4,
	after: IRBlockV4,
	options?: Omit<PointScheduleMutateOptions, "previousNextRepDate">,
): Promise<PointScheduleMutateResult> {
	return mutatePointScheduleFromBlock(
		app,
		before,
		{
			nextRepDate: after.nextRepDate,
			intervalDays: after.intervalDays,
			scheduleStatus: after.status,
			priorityUi: after.priorityUi,
			priorityEff: after.priorityEff,
			manualSchedulePinnedDateKey:
				after.meta?.manualSchedulePinnedDateKey ?? null,
			manualPostponeCount:
				after.meta?.manualPostponeCount != null
					? Number(after.meta.manualPostponeCount) || 0
					: 0,
		},
		{
			...options,
			previousNextRepDate: Number(before.nextRepDate || 0) || undefined,
		},
	);
}
