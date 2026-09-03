import type { App } from "obsidian";
import type { IRBlockV4 } from "../../types/ir-types";
import { readAdvancedScheduleSettingsSnapshot } from "../../utils/ir-plugin-host-access";
import { IRChunkScheduleAdapter } from "./IRChunkScheduleAdapter";
import {
	IREpubBookmarkTaskService,
	isEpubBookmarkTaskId,
} from "./IREpubBookmarkTaskService";
import {
	IRPdfBookmarkTaskService,
	isPdfBookmarkTaskId,
} from "./IRPdfBookmarkTaskService";
import {
	type PointScheduleMutateResult,
	persistBlockScheduleState,
} from "./IRPointScheduleMutator";
import {
	type IRScheduleMenuAction,
	type IRScheduleModePreviewInput,
	POSTPONE_MENU_DAYS,
	canPostponeBlock,
	computePostponeAdjustedBlock,
	computeScheduleModeAdjustedBlock,
} from "./IRScheduleModePreviewService";
import { IRStorageService } from "./IRStorageService";

export type { IRScheduleMenuAction, IRScheduleModePreviewInput };

/** 构造与菜单预览一致的公式输入（无 I/O）。 */
export function buildScheduleModePreviewInput(
	app: App,
	block: IRBlockV4,
	tagGroupIntervalFactor = 1,
	postponeContextDate?: Date | string | number | null,
): IRScheduleModePreviewInput {
	return {
		block,
		advancedSettings: readAdvancedScheduleSettingsSnapshot(app),
		tagGroupIntervalFactor,
		postponeContextDate,
	};
}

/** Tier-A：计算某菜单动作的目标 block（预览 / 乐观 UI / L0 写盘共用）。 */
export function computeScheduleMenuActionBlock(
	beforeBlock: IRBlockV4,
	action: IRScheduleMenuAction,
	input: IRScheduleModePreviewInput,
): IRBlockV4 {
	if (action === "postpone") {
		if (!canPostponeBlock(beforeBlock)) {
			throw new Error("postpone_limit_reached");
		}
		return computePostponeAdjustedBlock(beforeBlock, POSTPONE_MENU_DAYS, {
			contextDate: input.postponeContextDate,
		});
	}
	return computeScheduleModeAdjustedBlock(beforeBlock, action, input);
}

/**
 * L0：月历安排菜单写盘。跳过全库 schedule-index 重建，由 scoped debounced refresh 对账。
 */
export async function persistScheduleMenuActionL0(
	app: App,
	beforeBlock: IRBlockV4,
	afterBlock: IRBlockV4,
): Promise<PointScheduleMutateResult> {
	return persistBlockScheduleState(app, beforeBlock, afterBlock, {
		skipInvalidate: true,
	});
}

/** 安排/改期后记录零时长交互（与 V4 Scheduler 行为一致）。 */
export async function recordScheduleMenuActionInteraction(
	app: App,
	pointId: string,
): Promise<void> {
	const normalizedId = String(pointId || "").trim();
	if (!normalizedId) {
		return;
	}

	if (isPdfBookmarkTaskId(normalizedId)) {
		const pdfService = new IRPdfBookmarkTaskService(app);
		await pdfService.initialize();
		await pdfService.recordTaskInteraction(normalizedId, 0, {});
		return;
	}

	if (isEpubBookmarkTaskId(normalizedId)) {
		const epubService = new IREpubBookmarkTaskService(app);
		await epubService.initialize();
		await epubService.recordTaskInteraction(normalizedId, 0, {});
		return;
	}

	const storage = new IRStorageService(app);
	await storage.initialize();
	const chunkAdapter = new IRChunkScheduleAdapter(app, storage);
	await chunkAdapter.recordChunkInteraction(normalizedId, 0, {});
}
