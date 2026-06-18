import type { App } from "obsidian";
import { logger } from "../../utils/logger";
import type { IRPointSnapshot } from "../../types/ir-point-storage-types";
import {
	buildLegacyChunkFromPointSnapshot,
	getStoredPointKind,
	isLegacyBlockPointSnapshot,
} from "./IRLegacyTaskCompatAdapter";
import { getSharedIRPointStorageService } from "./IRPointStorageService";

export interface IRLegacyPointFormatScanResult {
	legacyBlockCount: number;
	chunkCount: number;
	pdfCount: number;
	epubCount: number;
	otherCount: number;
	totalCount: number;
}

export interface IRLegacyPointUnificationResult {
	migrated: number;
	skipped: number;
	failed: number;
	errors: string[];
}

/**
 * 将仍使用 legacy-block-entry 投影的旧版 Markdown 阅读点，统一升级为 chunk-entry。
 * 目标：只保留 points 存储的一种调度读写路径，逐步移除 blocksRecord 双轨维护。
 */
export class IRLegacyPointUnificationService {
	constructor(private readonly app: App) {}

	async scanPointFormats(): Promise<IRLegacyPointFormatScanResult> {
		const pointStorage = getSharedIRPointStorageService(this.app);
		const snapshots = await pointStorage.listPointSnapshots();
		const result: IRLegacyPointFormatScanResult = {
			legacyBlockCount: 0,
			chunkCount: 0,
			pdfCount: 0,
			epubCount: 0,
			otherCount: 0,
			totalCount: snapshots.length,
		};

		for (const snapshot of snapshots) {
			const kind = getStoredPointKind(snapshot);
			if (kind === "chunk") {
				result.chunkCount += 1;
				continue;
			}
			if (kind === "pdf") {
				result.pdfCount += 1;
				continue;
			}
			if (kind === "epub") {
				result.epubCount += 1;
				continue;
			}
			if (isLegacyBlockPointSnapshot(snapshot)) {
				result.legacyBlockCount += 1;
				continue;
			}
			result.otherCount += 1;
		}

		return result;
	}

	async migrateLegacyBlockPointsToChunkFormat(): Promise<IRLegacyPointUnificationResult> {
		const pointStorage = getSharedIRPointStorageService(this.app);
		const snapshots = await pointStorage.listPointSnapshots();
		const result: IRLegacyPointUnificationResult = {
			migrated: 0,
			skipped: 0,
			failed: 0,
			errors: [],
		};

		for (const snapshot of snapshots) {
			if (!isLegacyBlockPointSnapshot(snapshot)) {
				continue;
			}

			const pointId = String(snapshot.point.id || "").trim();
			if (!pointId) {
				result.skipped += 1;
				continue;
			}

			try {
				const upgraded = await this.upgradeLegacyBlockSnapshotToChunk(snapshot);
				if (upgraded) {
					result.migrated += 1;
				} else {
					result.skipped += 1;
				}
			} catch (error) {
				result.failed += 1;
				const message = error instanceof Error ? error.message : String(error);
				result.errors.push(`${pointId}: ${message}`);
				logger.warn("[IRLegacyPointUnificationService] 升级 legacy 阅读点失败", {
					pointId,
					error,
				});
			}
		}

		return result;
	}

	private async upgradeLegacyBlockSnapshotToChunk(snapshot: IRPointSnapshot): Promise<boolean> {
		const point = snapshot.point;
		const pointId = String(point.id || "").trim();
		if (!pointId) {
			return false;
		}

		const { chunk } = buildLegacyChunkFromPointSnapshot(snapshot);
		const chunkMeta = (chunk.meta || {}) as unknown as Record<string, unknown>;
		const topicIds = Array.isArray(point.relations?.topicIds)
			? point.relations.topicIds.map((id) => String(id || "").trim()).filter(Boolean)
			: [String(snapshot.topicId || "").trim()].filter(Boolean);
		const primaryTopicId = topicIds[0] || snapshot.topicId;
		const locator = point.trace?.locator || {};
		const sourcePath = String(
			chunk.filePath ||
				(locator as { filePath?: string }).filePath ||
				(locator as { sourcePath?: string }).sourcePath ||
				point.source?.path ||
				""
		).trim();

		if (!sourcePath) {
			return false;
		}

		const pointStorage = getSharedIRPointStorageService(this.app);
		await pointStorage.syncLegacyPoint({
			id: pointId,
			topicId: primaryTopicId,
			topicIds,
			topicName: snapshot.topicName,
			title: String(point.userData?.title || point.source?.title || pointId).trim(),
			tags: Array.isArray(point.userData?.tags) ? [...(point.userData.tags as string[])] : [],
			status: String(point.schedule?.status || "new"),
			priorityUi:
				typeof point.schedule?.manualPriority === "number"
					? point.schedule.manualPriority
					: undefined,
			priorityEff:
				typeof point.schedule?.priorityScore === "number"
					? point.schedule.priorityScore
					: undefined,
			intervalDays:
				typeof point.schedule?.intervalDays === "number"
					? point.schedule.intervalDays
					: undefined,
			nextRepDate:
				typeof point.schedule?.nextReviewAt === "string" && point.schedule.nextReviewAt.trim()
					? Date.parse(point.schedule.nextReviewAt)
					: undefined,
			sourceType: "ir-chunk",
			sourcePath,
			pointType: "chunk-entry",
			locatorType: "markdown-paragraph",
			locator: {
				...locator,
				filePath: sourcePath,
				sourcePath,
				chunkFilePath: chunk.filePath,
				headingPath: Array.isArray(chunkMeta.headingPath)
					? (chunkMeta.headingPath as string[])
					: undefined,
				resumeLink:
					typeof chunkMeta.resumeLink === "string" ? chunkMeta.resumeLink : undefined,
			},
			linkedNotePaths: Array.isArray(point.relations?.linkedNotePaths)
				? [...point.relations.linkedNotePaths]
				: [],
			stats: point.stats,
			metadata: {
				...(point.metadata || {}),
				sourcePath,
				chunkFilePath: chunk.filePath,
				migratedFromLegacyBlock: true,
				migratedAt: new Date().toISOString(),
			},
		});

		return true;
	}
}

export function getSharedIRLegacyPointUnificationService(app: App): IRLegacyPointUnificationService {
	return new IRLegacyPointUnificationService(app);
}
