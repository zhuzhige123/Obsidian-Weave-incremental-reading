import { type App, Notice } from "obsidian";
import type { IRBlockV4 } from "../../../types/ir-types";
import { i18n } from "../../../utils/i18n";
import { logger } from "../../../utils/logger";
import { showObsidianConfirm } from "../../../utils/obsidian-confirm";
import type { ScheduleItem } from "../IRCalendarScheduleItem";
import { IRPointWriteService } from "../IRPointWriteService";
import { IRStorageService } from "../IRStorageService";
import { IRV4SchedulerService } from "../IRV4SchedulerService";
import { IRReadingPointTopicMigrationService } from "../reading-point-edit/IRReadingPointTopicMigrationService";
import { resolveScheduleItemWriteTarget } from "./resolveScheduleItemWriteTarget";

export interface IRReadingPointBatchCallbacks {
	resolveBlockV4: (item: ScheduleItem) => Promise<IRBlockV4>;
	onBatchRemoved?: (materialIds: string[]) => Promise<void>;
}

export interface IRReadingPointBatchResult {
	total: number;
	success: number;
	failed: number;
	skipped: number;
}

export class IRReadingPointBatchService {
	private readonly pointWrite: IRPointWriteService;
	private readonly scheduler: IRV4SchedulerService;
	private readonly topicMigration: IRReadingPointTopicMigrationService;
	private readonly storage: IRStorageService;

	constructor(
		private readonly app: App,
		private readonly callbacks: IRReadingPointBatchCallbacks,
	) {
		this.pointWrite = new IRPointWriteService(app);
		this.scheduler = new IRV4SchedulerService(app);
		this.topicMigration = new IRReadingPointTopicMigrationService(app);
		this.storage = new IRStorageService(app);
	}

	async batchRemove(
		materials: ScheduleItem[],
		options?: { skipConfirm?: boolean },
	): Promise<IRReadingPointBatchResult> {
		const targets = dedupeMaterials(materials);
		if (targets.length === 0) {
			return emptyBatchResult();
		}

		if (!options?.skipConfirm) {
			const confirmed = await showObsidianConfirm(
				this.app,
				i18n.t("irSidebar.batch.confirmRemove", { count: targets.length }),
				{
					title: i18n.t("irSidebar.batch.removeTitle"),
					confirmText: i18n.t("irSidebar.calendar.removeConfirm"),
					confirmClass: "mod-warning",
				},
			);
			if (!confirmed) {
				return cancelledBatchResult(targets.length);
			}
		}

		return await this.runDestructiveBatch(
			targets,
			async (material) => {
				const writeTarget = resolveScheduleItemWriteTarget(material);
				const removed = await this.pointWrite.deletePoint({
					id: writeTarget.id,
					kind: writeTarget.kind,
				});
				if (!removed) {
					throw new Error(`remove-failed:${material.id}`);
				}
				return material.id;
			},
			"remove",
		);
	}

	async batchDelete(
		materials: ScheduleItem[],
	): Promise<IRReadingPointBatchResult> {
		const targets = dedupeMaterials(materials);
		if (targets.length === 0) {
			return emptyBatchResult();
		}

		const confirmed = await showObsidianConfirm(
			this.app,
			i18n.t("irSidebar.batch.confirmDelete", { count: targets.length }),
			{
				title: i18n.t("irSidebar.batch.deleteTitle"),
				confirmText: i18n.t("irMain.dialog.delete"),
				confirmClass: "mod-warning",
			},
		);
		if (!confirmed) {
			return cancelledBatchResult(targets.length);
		}

		await this.scheduler.initialize();

		return await this.runDestructiveBatch(
			targets,
			async (material) => {
				const block = await this.callbacks.resolveBlockV4(material);
				await this.scheduler.deleteBlockV4(block, true);
				return material.id;
			},
			"delete",
		);
	}

	async batchMoveTopic(
		materials: ScheduleItem[],
		targetDeckId: string,
	): Promise<IRReadingPointBatchResult> {
		const targets = dedupeMaterials(materials);
		const normalizedDeckId = String(targetDeckId || "").trim();
		if (targets.length === 0 || !normalizedDeckId) {
			return emptyBatchResult();
		}

		await this.storage.initialize();

		const result: IRReadingPointBatchResult = {
			total: targets.length,
			success: 0,
			failed: 0,
			skipped: 0,
		};

		for (const material of targets) {
			try {
				const migration = await this.topicMigration.movePointToTopic({
					pointId: material.id,
					targetDeckId: normalizedDeckId,
					sourceTypeHint: material.sourceType || "unknown",
					sourceDocumentPath: material.sourceFile || undefined,
				});
				if (migration.changed) {
					result.success++;
				} else {
					result.skipped++;
				}
			} catch (error) {
				result.failed++;
				logger.error(
					`[IRReadingPointBatchService] move-topic failed: ${material.id}`,
					error,
				);
			}

			if ((result.success + result.failed + result.skipped) % 10 === 0) {
				await yieldToMainThread();
			}
		}

		if (result.success > 0) {
			this.storage.invalidateScheduleRuntimeCaches();
		}

		this.showResultNotice("move-topic", result);
		return result;
	}

	private async runDestructiveBatch(
		targets: ScheduleItem[],
		action: (material: ScheduleItem) => Promise<string>,
		operation: "remove" | "delete",
	): Promise<IRReadingPointBatchResult> {
		const result: IRReadingPointBatchResult = {
			total: targets.length,
			success: 0,
			failed: 0,
			skipped: 0,
		};
		const removedIds: string[] = [];

		for (const material of targets) {
			try {
				const removedId = await action(material);
				removedIds.push(removedId);
				result.success++;
			} catch (error) {
				result.failed++;
				logger.error(
					`[IRReadingPointBatchService] ${operation} failed: ${material.id}`,
					error,
				);
			}

			if ((result.success + result.failed) % 10 === 0) {
				await yieldToMainThread();
			}
		}

		if (removedIds.length > 0) {
			await this.callbacks.onBatchRemoved?.(removedIds);
		}

		this.showResultNotice(operation, result);
		return result;
	}

	private showResultNotice(
		operation: "remove" | "delete" | "move-topic",
		result: IRReadingPointBatchResult,
	): void {
		if (result.success === 0 && result.failed === 0) {
			return;
		}

		if (result.failed === 0) {
			const key =
				operation === "remove"
					? "irSidebar.batch.removeSuccess"
					: operation === "delete"
					? "irSidebar.batch.deleteSuccess"
					: "irSidebar.batch.moveTopicSuccess";
			new Notice(i18n.t(key, { count: result.success }), 2500);
			return;
		}

		new Notice(
			i18n.t("irSidebar.batch.partialFailure", {
				success: result.success,
				failed: result.failed,
			}),
			3500,
		);
	}
}

export function dedupeMaterials(materials: ScheduleItem[]): ScheduleItem[] {
	const seen = new Set<string>();
	const unique: ScheduleItem[] = [];
	for (const material of materials) {
		const id = String(material.id || "").trim();
		if (!id || seen.has(id)) {
			continue;
		}
		seen.add(id);
		unique.push(material);
	}
	return unique;
}

function emptyBatchResult(): IRReadingPointBatchResult {
	return { total: 0, success: 0, failed: 0, skipped: 0 };
}

function cancelledBatchResult(total: number): IRReadingPointBatchResult {
	return { total, success: 0, failed: 0, skipped: 0 };
}

function yieldToMainThread(): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, 0));
}
