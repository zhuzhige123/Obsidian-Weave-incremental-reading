import type { App } from "obsidian";
import { isIRDeckGhostPointSnapshot } from "../../utils/ir-internal-data-path";
import { logger } from "../../utils/logger";
import {
	getSharedIRPointStorageService,
	type IRPointStorageService,
} from "./IRPointStorageService";

export interface IRDeckGhostPointCleanupResult {
	scanned: number;
	deleted: number;
	deletedIds: string[];
}

let inflightCleanup: Promise<IRDeckGhostPointCleanupResult> | null = null;
const deletedThisSession = new Set<string>();

/**
 * 扫描并删除错误以 `.irdeck` 自身作为阅读点的幽灵条目。
 * 同一会话内同一 pointId 只尝试删除一次，避免重复 IO。
 */
export async function cleanupIRDeckGhostPoints(
	app: App,
	options?: {
		pointIds?: string[];
		pointStorage?: IRPointStorageService;
	},
): Promise<IRDeckGhostPointCleanupResult> {
	if (inflightCleanup) {
		return inflightCleanup;
	}

	inflightCleanup = (async (): Promise<IRDeckGhostPointCleanupResult> => {
		const pointStorage =
			options?.pointStorage || getSharedIRPointStorageService(app);
		await pointStorage.initialize();

		const explicitIds = Array.from(
			new Set(
				(options?.pointIds || [])
					.map((id) => String(id || "").trim())
					.filter(Boolean),
			),
		);

		let candidateIds = explicitIds;
		let scanned = explicitIds.length;

		if (candidateIds.length === 0) {
			const snapshots = await pointStorage.listPointSnapshots();
			scanned = snapshots.length;
			candidateIds = snapshots
				.filter((snapshot) => isIRDeckGhostPointSnapshot(snapshot))
				.map((snapshot) => String(snapshot.point.id || "").trim())
				.filter(Boolean);
		}

		const pendingIds = candidateIds.filter(
			(id) => id && !deletedThisSession.has(id),
		);
		const deletedIds: string[] = [];

		for (const pointId of pendingIds) {
			try {
				const deleted = await pointStorage.deletePointByLegacyId(pointId);
				if (deleted) {
					deletedThisSession.add(pointId);
					deletedIds.push(pointId);
				} else if (explicitIds.length === 0) {
					// 全库扫描命中但删失败：仍标记，避免本会话反复重试同一坏数据。
					deletedThisSession.add(pointId);
				}
			} catch (error) {
				logger.warn("[IRDeckGhostPointCleanup] delete failed", {
					pointId,
					error,
				});
			}
		}

		if (deletedIds.length > 0) {
			logger.info("[IRDeckGhostPointCleanup] removed irdeck ghost points", {
				deleted: deletedIds.length,
				deletedIds,
			});
		}

		return {
			scanned,
			deleted: deletedIds.length,
			deletedIds,
		};
	})();

	try {
		return await inflightCleanup;
	} finally {
		inflightCleanup = null;
	}
}

/** 非阻塞清理；列表过滤命中后调用，避免阻塞 UI。 */
export function scheduleIRDeckGhostPointCleanup(
	app: App,
	pointIds?: string[],
): void {
	void cleanupIRDeckGhostPoints(
		app,
		pointIds && pointIds.length > 0 ? { pointIds } : undefined,
	).catch((error) => {
		logger.warn("[IRDeckGhostPointCleanup] scheduled cleanup failed", error);
	});
}

/** 测试用：重置会话去重状态。 */
export function resetIRDeckGhostPointCleanupSessionStateForTests(): void {
	deletedThisSession.clear();
	inflightCleanup = null;
}
