import type { IRBlockMeta } from "../../types/ir-types";
import type { App } from "obsidian";
import { logger } from "../../utils/logger";
import { IRChunkScheduleAdapter } from "./IRChunkScheduleAdapter";
import { isEpubBookmarkTaskId, IREpubBookmarkTaskService } from "./IREpubBookmarkTaskService";
import type { IRLoadDeferralRecord } from "./IRDailyLoadAllocator";
import { IRMonitoringService } from "./IRMonitoringService";
import { isPdfBookmarkTaskId, IRPdfBookmarkTaskService } from "./IRPdfBookmarkTaskService";
import type { ScheduleRecomputeReason } from "./IRScheduleKernel";
import { IRStorageService } from "./IRStorageService";
import { getSharedIRScheduleIndexService } from "./IRScheduleIndexService";
import { getSharedIRWorkspaceSnapshotService } from "./IRWorkspaceSnapshotService";

const SKIP_PERSIST_REASONS = new Set<ScheduleRecomputeReason>([
	"change_priority",
	"load_defer",
	"manual_reschedule",
]);

export interface ApplyLoadDeferralsOptions {
	reason: ScheduleRecomputeReason;
	/** 仅当工作区 nextRepDate 仍等于计划 defer 前的值时才写入，避免覆盖用户手动改期。 */
	requireMatchingFromDate?: boolean;
}

function formatDateKeyFromMs(timestamp: number): string {
	const date = new Date(timestamp);
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function startOfDayMs(timestamp: number): number {
	const date = new Date(timestamp);
	date.setHours(0, 0, 0, 0);
	return date.getTime();
}

function isSameDay(leftMs: number, rightMs: number): boolean {
	return startOfDayMs(leftMs) === startOfDayMs(rightMs);
}

export async function applyLoadDeferralsFromPlan(
	app: App,
	deferrals: IRLoadDeferralRecord[],
	options: ApplyLoadDeferralsOptions
): Promise<number> {
	if (deferrals.length === 0 || SKIP_PERSIST_REASONS.has(options.reason)) {
		return 0;
	}

	const storage = new IRStorageService(app);
	await storage.initialize();
	const chunkAdapter = new IRChunkScheduleAdapter(app, storage);
	const pdfService = new IRPdfBookmarkTaskService(app);
	const epubService = new IREpubBookmarkTaskService(app);
	await Promise.all([pdfService.initialize(), epubService.initialize()]);

	const workspace = await getSharedIRWorkspaceSnapshotService(app).getWorkspaceData();
	const monitoring = new IRMonitoringService(app.vault);
	await monitoring.load();

	let appliedCount = 0;

	for (const deferral of deferrals) {
		const itemId = String(deferral.itemId || "").trim();
		if (!itemId) {
			continue;
		}

		const currentNextRepDate = readCurrentNextRepDate(workspace, itemId);
		if (currentNextRepDate <= 0) {
			continue;
		}

		if (
			options.requireMatchingFromDate !== false &&
			!isSameDay(currentNextRepDate, deferral.fromNextRepDate)
		) {
			continue;
		}

		if (isSameDay(currentNextRepDate, deferral.toNextRepDate)) {
			continue;
		}

		const persisted = await persistLoadDeferral({
			itemId,
			toNextRepDate: deferral.toNextRepDate,
			chunkAdapter,
			pdfService,
			epubService,
		});
		if (!persisted) {
			continue;
		}

		monitoring.recordDecisionEvent({
			itemId,
			action: deferral.action || "load_defer",
			beforeDate: formatDateKeyFromMs(deferral.fromNextRepDate),
			afterDate: formatDateKeyFromMs(deferral.toNextRepDate),
			sourceType: deferral.sourceType,
		});
		appliedCount += 1;
	}

	if (appliedCount > 0) {
		await monitoring.save();
		getSharedIRWorkspaceSnapshotService(app).invalidate();
		getSharedIRScheduleIndexService(app).invalidate();
		logger.info(`[IRLoadDeferService] 负载顺延已写入 ${appliedCount} 个阅读点`, {
			reason: options.reason,
		});
	}

	return appliedCount;
}

function readCurrentNextRepDate(
	workspace: Awaited<
		ReturnType<ReturnType<typeof getSharedIRWorkspaceSnapshotService>["getWorkspaceData"]>
	>,
	itemId: string
): number {
	const chunk = workspace.chunksRecord[itemId];
	if (chunk) {
		return Number(chunk.nextRepDate || 0);
	}

	if (isPdfBookmarkTaskId(itemId)) {
		const task = workspace.pdfTasks.find((entry) => entry.id === itemId);
		return Number(task?.nextRepDate || 0);
	}

	if (isEpubBookmarkTaskId(itemId)) {
		const task = workspace.epubTasks.find((entry) => entry.id === itemId);
		return Number(task?.nextRepDate || 0);
	}

	return 0;
}

const CLEAR_MANUAL_SCHEDULE_PIN_META = {
	manualSchedulePinnedDateKey: null,
} as Partial<IRBlockMeta> & { manualSchedulePinnedDateKey: null };

async function persistLoadDeferral(input: {
	itemId: string;
	toNextRepDate: number;
	chunkAdapter: IRChunkScheduleAdapter;
	pdfService: IRPdfBookmarkTaskService;
	epubService: IREpubBookmarkTaskService;
}): Promise<boolean> {
	const { itemId, toNextRepDate } = input;

	if (isPdfBookmarkTaskId(itemId)) {
		const updated = await input.pdfService.updateTask(itemId, {
			nextRepDate: toNextRepDate,
			status: "queued",
			meta: CLEAR_MANUAL_SCHEDULE_PIN_META,
		});
		return Boolean(updated);
	}

	if (isEpubBookmarkTaskId(itemId)) {
		const updated = await input.epubService.updateTask(itemId, {
			nextRepDate: toNextRepDate,
			status: "queued",
			meta: CLEAR_MANUAL_SCHEDULE_PIN_META,
		});
		return Boolean(updated);
	}

	try {
		await input.chunkAdapter.updateChunkSchedule(itemId, {
			nextRepDate: toNextRepDate,
			scheduleStatus: "queued",
			manualSchedulePinnedDateKey: null,
		});
		return true;
	} catch (error) {
		logger.warn(`[IRLoadDeferService] 写入负载顺延失败: ${itemId}`, error);
		return false;
	}
}
