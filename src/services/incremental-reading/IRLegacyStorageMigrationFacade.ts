import type { App } from "obsidian";
import { IRPointStorageService } from "./IRPointStorageService";
import { IRStorageService } from "./IRStorageService";
import { IRTagGroupService } from "./IRTagGroupService";

export type IRLegacyStorageMigrationSummary = {
	pendingCount: number;
	pendingItems: string[];
	legacyChunkStorageFileCount: number;
	deletedReadableMarkdownCount: number;
	legacyTagGroupFileCount: number;
};

export type IRLegacyStorageMigrationExecutionReport = {
	success: number;
	failed: number;
	errors: Array<{ id: string; message: string }>;
};

/** 聚合旧 vault 存储迁移检测与执行，供独立 IR 插件数据管理 UI 使用 */
export class IRLegacyStorageMigrationFacade {
	constructor(private readonly app: App) {}

	async inspect(): Promise<IRLegacyStorageMigrationSummary> {
		const pointStorage = new IRPointStorageService(this.app);
		await pointStorage.initialize();
		const inspection = await pointStorage.inspectMigrationStatus();

		const tagGroupService = new IRTagGroupService(this.app);
		await tagGroupService.initialize();
		const legacyTagGroupInspection =
			await tagGroupService.inspectLegacyCatalogResidue();

		const irStorageService = new IRStorageService(this.app);
		await irStorageService.initialize();
		const deletedReadableMarkdownInspection =
			await irStorageService.inspectDeletedReadableMarkdownResidue();

		const deletedReadableMarkdownCount = Number(
			deletedReadableMarkdownInspection.count || 0,
		);
		const legacyTagGroupFileCount = Number(
			legacyTagGroupInspection.legacyFileCount || 0,
		);
		const items = [...inspection.pendingItems];

		if (Number(inspection.legacyChunkStorageFileCount || 0) > 0) {
			items.push(
				`legacy-chunks: ${Number(inspection.legacyChunkStorageFileCount || 0)}`,
			);
		}
		if (deletedReadableMarkdownCount > 0) {
			items.push(`deleted-readable-markdown: ${deletedReadableMarkdownCount}`);
		}
		if (legacyTagGroupFileCount > 0) {
			items.push(`legacy-tag-groups: ${legacyTagGroupFileCount}`);
		}

		return {
			pendingCount:
				inspection.pendingCount +
				Number(inspection.legacyChunkStorageFileCount || 0) +
				deletedReadableMarkdownCount +
				legacyTagGroupFileCount,
			pendingItems: items,
			legacyChunkStorageFileCount: Number(
				inspection.legacyChunkStorageFileCount || 0,
			),
			deletedReadableMarkdownCount,
			legacyTagGroupFileCount,
		};
	}

	async execute(): Promise<IRLegacyStorageMigrationExecutionReport> {
		const pointStorage = new IRPointStorageService(this.app);
		await pointStorage.initialize();
		const report = await pointStorage.executeMigration({
			cleanupLegacyReaderStateFiles: false,
			cleanupLegacyBookmarkTaskFiles: true,
			cleanupLegacyChunkStorageFiles: true,
			cleanupLegacyMaterialFiles: true,
			cleanupLegacyRegistryFiles: true,
			cleanupLegacyTopicStoreFiles: true,
		});

		const tagGroupService = new IRTagGroupService(this.app);
		await tagGroupService.initialize();
		const legacyTagGroupMigration =
			await tagGroupService.migrateLegacyCatalogToPointFiles({
				cleanupLegacyFiles: true,
			});

		const irStorageService = new IRStorageService(this.app);
		await irStorageService.initialize();
		const deletedReadableMarkdownCleanup =
			await irStorageService.cleanupDeletedReadableMarkdownResidue();

		const errors = [
			...report.summary.failures.map((item) => ({
				id: item.id,
				message: `${item.type}: ${item.message}`,
			})),
			...legacyTagGroupMigration.failures.map((item) => ({
				id: item.id,
				message: `${item.type}: ${item.message}`,
			})),
			...deletedReadableMarkdownCleanup.failures.map((item) => ({
				id: item.path,
				message: item.message,
			})),
		];

		return {
			success:
				report.summary.migratedMaterials +
				report.summary.migratedPoints +
				report.summary.migratedReaderStateFiles +
				report.summary.removedLegacyReaderStateFiles +
				report.summary.removedLegacyBookmarkTaskFiles +
				report.summary.removedLegacyChunkStorageFiles +
				(report.summary.removedLegacyMaterialRecordFiles || 0) +
				(report.summary.removedLegacyMaterialsIndexCount || 0) +
				(report.summary.removedLegacyMaterialsFileCount || 0) +
				(report.summary.removedEmptyLegacyMaterialDirs || 0) +
				(report.summary.removedLegacyRegistryFiles || 0) +
				(report.summary.removedLegacyTopicStoreFiles || 0) +
				legacyTagGroupMigration.embeddedTopicCount +
				legacyTagGroupMigration.removedLegacyFileCount +
				deletedReadableMarkdownCleanup.removed,
			failed:
				report.summary.failures.length +
				legacyTagGroupMigration.failures.length +
				legacyTagGroupMigration.remainingLegacyFiles.length +
				deletedReadableMarkdownCleanup.failures.length,
			errors,
		};
	}
}
