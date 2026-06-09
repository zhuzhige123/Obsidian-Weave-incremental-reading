import { App, normalizePath } from "obsidian";
import { getPluginPathsById, getV2PathsFromApp } from "../../config/paths";
import type {
	IRBackupOrphanEntry,
	IRDataManagementScanResult,
	IRDuplicateTopicGroup,
	IRMergePointIdConflict,
	IRPointFileFormatIssue,
	IRPointFileFormatReport,
	IRPointFileMergeResult,
	IRPointFileMovePlanItem,
	IRPointFilePairDiff,
	IRVaultPointFileEntry,
} from "../../types/ir-data-management-types";
import { IR_POINT_STORAGE_VERSION } from "../../types/ir-point-storage-types";
import { DirectoryUtils } from "../../utils/directory-utils";
import { logger } from "../../utils/logger";
import { readString } from "../../utils/unknown-record";
import { sanitizeForSync } from "../../utils/sync-safe-filename";
import { IRPointStorageService } from "./IRPointStorageService";

const IR_DECK_FILE_EXTENSION = ".irdeck";
const BACKUP_PLUGIN_IDS = ["weave-incremental-reading", "weave"] as const;

export class IRDeckDataManagementService {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	private get adapter() {
		return this.app.vault.adapter;
	}

	private get pointStorage(): IRPointStorageService {
		return new IRPointStorageService(this.app);
	}

	getCanonicalPointsDir(): string {
		return normalizePath(getV2PathsFromApp(this.app).ir.pointsDir);
	}

	async scan(): Promise<IRDataManagementScanResult> {
		await this.pointStorage.initialize();
		const canonicalPointsDir = this.getCanonicalPointsDir();
		const catalog = await this.pointStorage.listPointFileCatalogEntries();
		const vaultFiles: IRVaultPointFileEntry[] = catalog.map((entry) => {
			const absolutePath = normalizePath(entry.absolutePath);
			const parentDir = absolutePath.split("/").slice(0, -1).join("/");
			return {
				absolutePath,
				topicId: String(entry.topicId || "").trim(),
				topicName: String(entry.topicName || "").trim(),
				pointCount: Array.isArray(entry.fileData.points) ? entry.fileData.points.length : 0,
				updatedAt: String(entry.fileData.updatedAt || "").trim(),
				isInCanonicalDir: parentDir === canonicalPointsDir,
			};
		});

		const duplicateGroups = this.buildDuplicateGroups(vaultFiles);
		const activeTopicIds = new Set(vaultFiles.map((file) => file.topicId).filter(Boolean));
		const backupOrphans = await this.scanBackupOrphans(activeTopicIds);
		const formatReports: IRPointFileFormatReport[] = [];
		for (const file of vaultFiles) {
			formatReports.push(await this.inspectPointFileFormat(file.absolutePath));
		}
		const emptyPointFiles = vaultFiles.filter((file) => file.pointCount <= 0);
		const needsMigrationFiles = formatReports.filter(
			(report) => report.needsMigration && report.canMigrate
		);

		return {
			canonicalPointsDir,
			vaultFiles,
			duplicateGroups,
			backupOrphans,
			formatReports,
			emptyPointFiles,
			needsMigrationFiles,
			scannedAt: Date.now(),
		};
	}

	async inspectPointFileFormat(absolutePath: string): Promise<IRPointFileFormatReport> {
		const normalizedPath = normalizePath(String(absolutePath || "").trim());
		const issues: IRPointFileFormatIssue[] = [];

		if (!normalizedPath) {
			return {
				absolutePath: "",
				topicId: "",
				topicName: "",
				pointCount: 0,
				issues: [
					{
						code: "missing_path",
						message: "缺少文件路径",
						severity: "error",
					},
				],
				needsMigration: false,
				canMigrate: false,
				isEmpty: true,
			};
		}

		if (!(await this.adapter.exists(normalizedPath))) {
			return {
				absolutePath: normalizedPath,
				topicId: "",
				topicName: "",
				pointCount: 0,
				issues: [
					{
						code: "file_missing",
						message: "文件不存在",
						severity: "error",
					},
				],
				needsMigration: false,
				canMigrate: false,
				isEmpty: true,
			};
		}

		let raw: Record<string, unknown>;
		try {
			raw = JSON.parse(await this.adapter.read(normalizedPath)) as Record<string, unknown>;
		} catch {
			return {
				absolutePath: normalizedPath,
				topicId: "",
				topicName: "",
				pointCount: 0,
				issues: [
					{
						code: "parse_error",
						message: "JSON 无法解析，需人工修复",
						severity: "error",
					},
				],
				needsMigration: false,
				canMigrate: false,
				isEmpty: true,
			};
		}

		if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
			issues.push({
				code: "invalid_root",
				message: "根节点必须是对象",
				severity: "error",
			});
		}

		const fileName = normalizedPath.split("/").pop() || "";
		const topicId = readString(raw.topicId);
		const topicName = readString(raw.topicName) || fileName.replace(/\.irdeck$/i, "");
		const points = Array.isArray(raw.points) ? raw.points : null;

		if (Number(raw.schemaVersion) !== IR_POINT_STORAGE_VERSION) {
			issues.push({
				code: "schema_version",
				message: `schemaVersion 应为 ${IR_POINT_STORAGE_VERSION}，当前为 ${
					raw.schemaVersion === undefined
						? "缺失"
						: typeof raw.schemaVersion === "string" || typeof raw.schemaVersion === "number"
							? String(raw.schemaVersion)
							: "无效"
				}`,
				severity: "warning",
			});
		}

		if (!topicId) {
			issues.push({
				code: "missing_topic_id",
				message: "缺少 topicId，迁移时将按文件名补全",
				severity: "warning",
			});
		}

		if (!readString(raw.topicName)) {
			issues.push({
				code: "missing_topic_name",
				message: "缺少 topicName，迁移时将使用文件名",
				severity: "info",
			});
		}

		if (!points) {
			issues.push({
				code: "points_not_array",
				message: "points 字段缺失或不是数组",
				severity: "error",
			});
		}

		if (!raw.deck || typeof raw.deck !== "object") {
			issues.push({
				code: "missing_deck",
				message: "缺少 deck 元数据对象",
				severity: "warning",
			});
		}

		if (!raw.tagGroups || typeof raw.tagGroups !== "object") {
			issues.push({
				code: "missing_tag_groups",
				message: "缺少 tagGroups 定义",
				severity: "warning",
			});
		}

		if (!raw.tagGroupProfiles || typeof raw.tagGroupProfiles !== "object") {
			issues.push({
				code: "missing_tag_group_profiles",
				message: "缺少 tagGroupProfiles 定义",
				severity: "warning",
			});
		}

		const pointCount = points?.length || 0;
		if (pointCount === 0) {
			issues.push({
				code: "empty_points",
				message: "没有任何阅读点",
				severity: "info",
			});
		} else if (points) {
			let missingPointIdCount = 0;
			let missingSourcePathCount = 0;
			for (const point of points) {
				if (!point || typeof point !== "object") {
					missingPointIdCount += 1;
					continue;
				}
				const record = point as Record<string, unknown>;
				if (!readString(record.id)) {
					missingPointIdCount += 1;
				}
				const source =
					record.source && typeof record.source === "object"
						? (record.source as Record<string, unknown>)
						: null;
				if (!readString(source?.path)) {
					missingSourcePathCount += 1;
				}
			}
			if (missingPointIdCount > 0) {
				issues.push({
					code: "invalid_points",
					message: `有 ${missingPointIdCount} 个阅读点缺少 id`,
					severity: "warning",
				});
			}
			if (missingSourcePathCount > 0) {
				issues.push({
					code: "missing_source_path",
					message: `有 ${missingSourcePathCount} 个阅读点缺少 source.path`,
					severity: "info",
				});
			}
		}

		const isEmpty = pointCount === 0;
		const hasBlockingIssue = issues.some(
			(issue) => issue.severity === "error" && issue.code !== "empty_points"
		);
		const needsMigration =
			!hasBlockingIssue &&
			issues.some(
				(issue) =>
					issue.code !== "empty_points" &&
					issue.code !== "missing_source_path" &&
					issue.severity !== "info"
			);

		return {
			absolutePath: normalizedPath,
			topicId,
			topicName,
			pointCount,
			issues,
			needsMigration,
			canMigrate: needsMigration && !hasBlockingIssue,
			isEmpty,
		};
	}

	async migratePointFileToCurrentSchema(absolutePath: string): Promise<void> {
		await this.pointStorage.rewritePointFileToCurrentSchema(absolutePath);
		this.pointStorage.invalidatePointSnapshotListCache();
	}

	async migrateAllPointFiles(reports: IRPointFileFormatReport[]): Promise<number> {
		let migrated = 0;
		for (const report of reports) {
			if (!report.canMigrate) {
				continue;
			}
			await this.migratePointFileToCurrentSchema(report.absolutePath);
			migrated += 1;
		}
		if (migrated > 0) {
			await this.pointStorage.refreshPointFilesIndexFromVault();
		}
		return migrated;
	}

	async detectMergePointIdConflicts(
		keeperPath: string,
		sourcePaths: string[]
	): Promise<IRMergePointIdConflict[]> {
		await this.pointStorage.initialize();
		return this.pointStorage.detectMergePointIdConflictsBetweenFiles(keeperPath, sourcePaths);
	}

	async mergeDuplicateGroupKeepingFile(
		keeperPath: string,
		sourcePaths: string[],
		options?: { resolutions?: Record<string, string> }
	): Promise<IRPointFileMergeResult> {
		const normalizedKeeper = normalizePath(String(keeperPath || "").trim());
		const mergeResult = await this.pointStorage.mergePointFilesIntoKeeper(
			normalizedKeeper,
			sourcePaths,
			{ resolutions: options?.resolutions }
		);

		if (mergeResult.conflicts?.length) {
			return {
				keeperPath: normalizedKeeper,
				addedPointCount: mergeResult.addedPointCount,
				skippedDuplicatePointCount: mergeResult.skippedDuplicatePointCount,
				replacedByResolutionCount: mergeResult.replacedByResolutionCount,
				removedPaths: [],
				conflicts: mergeResult.conflicts,
			};
		}

		const removedPaths: string[] = [];
		for (const sourcePath of sourcePaths) {
			const normalizedSource = normalizePath(String(sourcePath || "").trim());
			if (!normalizedSource || normalizedSource === normalizedKeeper) {
				continue;
			}
			await this.deleteVaultPointFile(normalizedSource);
			removedPaths.push(normalizedSource);
		}
		this.pointStorage.invalidatePointSnapshotListCache();
		return {
			keeperPath: normalizedKeeper,
			addedPointCount: mergeResult.addedPointCount,
			skippedDuplicatePointCount: mergeResult.skippedDuplicatePointCount,
			replacedByResolutionCount: mergeResult.replacedByResolutionCount,
			removedPaths,
		};
	}

	buildDuplicateGroups(vaultFiles: IRVaultPointFileEntry[]): IRDuplicateTopicGroup[] {
		const grouped = new Map<string, IRVaultPointFileEntry[]>();
		for (const file of vaultFiles) {
			const topicId = String(file.topicId || "").trim();
			if (!topicId) {
				continue;
			}
			const bucket = grouped.get(topicId) || [];
			bucket.push(file);
			grouped.set(topicId, bucket);
		}

		return Array.from(grouped.entries())
			.filter(([, files]) => files.length > 1)
			.map(([topicId, files]) => ({
				topicId,
				topicName: String(files[0]?.topicName || topicId).trim(),
				files: [...files].sort((left, right) =>
					left.absolutePath.localeCompare(right.absolutePath, "zh-CN")
				),
			}))
			.sort((left, right) =>
				left.topicName.localeCompare(right.topicName, "zh-CN") ||
				left.topicId.localeCompare(right.topicId, "zh-CN")
			);
	}

	buildNormalizeMovePlan(
		vaultFiles: IRVaultPointFileEntry[],
		targetDir: string
	): IRPointFileMovePlanItem[] {
		const normalizedTarget = normalizePath(String(targetDir || "").trim()) || this.getCanonicalPointsDir();
		const plan: IRPointFileMovePlanItem[] = [];
		const reservedTargets = new Set<string>(
			vaultFiles
				.filter((file) => {
					const parent = file.absolutePath.split("/").slice(0, -1).join("/");
					return parent === normalizedTarget;
				})
				.map((file) => file.absolutePath)
		);

		const filesNeedingMove = vaultFiles.filter((file) => {
			const parent = file.absolutePath.split("/").slice(0, -1).join("/");
			return parent !== normalizedTarget;
		});

		const byTopicId = new Map<string, IRVaultPointFileEntry[]>();
		for (const file of filesNeedingMove) {
			const bucket = byTopicId.get(file.topicId) || [];
			bucket.push(file);
			byTopicId.set(file.topicId, bucket);
		}

		for (const [topicId, files] of byTopicId) {
			const sorted = [...files].sort((left, right) => {
				if (right.pointCount !== left.pointCount) {
					return right.pointCount - left.pointCount;
				}
				return String(right.updatedAt).localeCompare(String(left.updatedAt));
			});

			sorted.forEach((file, index) => {
				const targetPath = this.allocateTargetPath(
					normalizedTarget,
					file.topicName,
					topicId,
					index + 1,
					reservedTargets
				);
				reservedTargets.add(targetPath);
				plan.push({
					sourcePath: file.absolutePath,
					targetPath,
					topicId: file.topicId,
					topicName: file.topicName,
					reason:
						index === 0
							? "移动到规范目录"
							: `同专题多文件分片（第 ${index + 1} 份）`,
				});
			});
		}

		return plan.sort((left, right) =>
			left.targetPath.localeCompare(right.targetPath, "zh-CN")
		);
	}

	async comparePointFiles(pathA: string, pathB: string): Promise<IRPointFilePairDiff> {
		const normalizedA = normalizePath(pathA);
		const normalizedB = normalizePath(pathB);
		const [fileA, fileB] = await Promise.all([
			this.readPointIds(normalizedA),
			this.readPointIds(normalizedB),
		]);

		const setA = new Set(fileA.pointIds);
		const setB = new Set(fileB.pointIds);
		const sharedPointIds: string[] = [];
		const onlyInA: string[] = [];
		const onlyInB: string[] = [];

		for (const id of setA) {
			if (setB.has(id)) {
				sharedPointIds.push(id);
			} else {
				onlyInA.push(id);
			}
		}
		for (const id of setB) {
			if (!setA.has(id)) {
				onlyInB.push(id);
			}
		}

		return {
			pathA: normalizedA,
			pathB: normalizedB,
			pointCountA: fileA.pointIds.length,
			pointCountB: fileB.pointIds.length,
			sharedPointIds: sharedPointIds.sort(),
			onlyInA: onlyInA.sort(),
			onlyInB: onlyInB.sort(),
		};
	}

	async executeMovePlan(plan: IRPointFileMovePlanItem[]): Promise<number> {
		if (plan.length === 0) {
			return 0;
		}

		await this.pointStorage.initialize();
		const targetDir = normalizePath(plan[0]?.targetPath.split("/").slice(0, -1).join("/") || "");
		if (targetDir) {
			await DirectoryUtils.ensureDirRecursive(this.adapter, targetDir);
		}

		let moved = 0;
		for (const item of plan) {
			const source = normalizePath(item.sourcePath);
			const target = normalizePath(item.targetPath);
			if (!source || !target || source === target) {
				continue;
			}
			if (!(await this.adapter.exists(source))) {
				continue;
			}
			if (await this.adapter.exists(target)) {
				throw new Error(`目标路径已存在，无法移动：${target}`);
			}

			await this.adapter.rename(source, target);
			moved += 1;
		}

		if (moved > 0) {
			await this.pointStorage.refreshPointFilesIndexFromVault();
			this.pointStorage.invalidatePointSnapshotListCache();
		}

		return moved;
	}

	async deleteVaultPointFile(path: string): Promise<void> {
		const normalized = normalizePath(String(path || "").trim());
		if (!normalized || !(await this.adapter.exists(normalized))) {
			return;
		}
		await this.adapter.remove(normalized);
		await this.pointStorage.refreshPointFilesIndexFromVault();
		this.pointStorage.invalidatePointSnapshotListCache();
	}

	async recoverBackupOrphan(
		entry: IRBackupOrphanEntry,
		targetDir?: string
	): Promise<string> {
		const normalizedTarget =
			normalizePath(String(targetDir || "").trim()) || this.getCanonicalPointsDir();
		await DirectoryUtils.ensureDirRecursive(this.adapter, normalizedTarget);

		const raw = await this.adapter.read(entry.absolutePath);
		const parsed = JSON.parse(raw) as {
			topicId?: string;
			topicName?: string;
		};
		const topicId = String(parsed.topicId || entry.topicId || "").trim();
		const topicName = String(parsed.topicName || entry.topicName || "").trim();
		const reserved = new Set<string>();
		const targetPath = this.allocateTargetPath(
			normalizedTarget,
			topicName,
			topicId,
			1,
			reserved
		);

		await this.adapter.write(targetPath, raw);
		await this.pointStorage.refreshPointFilesIndexFromVault();
		this.pointStorage.invalidatePointSnapshotListCache();
		return targetPath;
	}

	async deleteBackupFile(path: string): Promise<void> {
		const normalized = normalizePath(String(path || "").trim());
		if (!normalized || !(await this.adapter.exists(normalized))) {
			return;
		}
		await this.adapter.remove(normalized);
	}

	private async readPointIds(
		path: string
	): Promise<{ pointIds: string[]; topicId: string; topicName: string }> {
		const raw = await this.adapter.read(path);
		const parsed = JSON.parse(raw) as {
			topicId?: string;
			topicName?: string;
			points?: Array<{ id?: string }>;
		};
		const pointIds = (Array.isArray(parsed.points) ? parsed.points : [])
			.map((point) => String(point?.id || "").trim())
			.filter(Boolean);
		return {
			pointIds,
			topicId: String(parsed.topicId || "").trim(),
			topicName: String(parsed.topicName || "").trim(),
		};
	}

	private allocateTargetPath(
		targetDir: string,
		topicName: string,
		topicId: string,
		ordinal: number,
		reservedTargets: Set<string>
	): string {
		let attempt = Math.max(1, ordinal);
		while (attempt < 200) {
			const fileName = this.buildTargetFileName(topicName, topicId, attempt);
			const candidate = normalizePath(`${targetDir}/${fileName}`);
			if (!reservedTargets.has(candidate)) {
				return candidate;
			}
			attempt += 1;
		}
		throw new Error(`无法为专题 ${topicName || topicId} 分配目标文件名`);
	}

	private buildTargetFileName(topicName: string, topicId: string, ordinal: number): string {
		const safeBase =
			sanitizeForSync(topicName || topicId || "incremental-reading", 80) ||
			"incremental-reading";
		if (ordinal <= 1) {
			return `${safeBase}${IR_DECK_FILE_EXTENSION}`;
		}
		return `${safeBase}.part${ordinal}${IR_DECK_FILE_EXTENSION}`;
	}

	private async scanBackupOrphans(activeTopicIds: Set<string>): Promise<IRBackupOrphanEntry[]> {
		const orphans: IRBackupOrphanEntry[] = [];
		const seenPaths = new Set<string>();

		for (const pluginId of BACKUP_PLUGIN_IDS) {
			const backupRoot = normalizePath(getPluginPathsById(this.app, pluginId).backups);
			if (!(await this.adapter.exists(backupRoot))) {
				continue;
			}

			for (const filePath of await this.listIrdeckFilesRecursive(backupRoot)) {
				if (seenPaths.has(filePath)) {
					continue;
				}
				seenPaths.add(filePath);

				try {
					const meta = await this.readPointIds(filePath);
					if (activeTopicIds.has(meta.topicId)) {
						continue;
					}

					const stat = await this.adapter.stat(filePath);
					orphans.push({
						absolutePath: filePath,
						topicId: meta.topicId,
						topicName: meta.topicName || meta.topicId,
						pointCount: meta.pointIds.length,
						updatedAt: stat?.mtime
							? new Date(stat.mtime).toISOString()
							: new Date(0).toISOString(),
						backupRoot,
						relativePath: filePath.startsWith(`${backupRoot}/`)
							? filePath.slice(backupRoot.length + 1)
							: filePath,
					});
				} catch (error) {
					logger.debug("[IRDeckDataManagementService] 跳过无法解析的备份 .irdeck", {
						filePath,
						error,
					});
				}
			}
		}

		return orphans.sort(
			(left, right) =>
				left.topicName.localeCompare(right.topicName, "zh-CN") ||
				left.absolutePath.localeCompare(right.absolutePath, "zh-CN")
		);
	}

	private async listIrdeckFilesRecursive(rootDir: string): Promise<string[]> {
		const normalizedRoot = normalizePath(String(rootDir || "").trim());
		if (!normalizedRoot || !(await this.adapter.exists(normalizedRoot))) {
			return [];
		}

		const files: string[] = [];
		const listing = await this.adapter.list(normalizedRoot);

		for (const filePath of listing.files || []) {
			const normalizedFile = normalizePath(filePath);
			if (normalizedFile.toLowerCase().endsWith(IR_DECK_FILE_EXTENSION)) {
				files.push(normalizedFile);
			}
		}

		for (const folderPath of listing.folders || []) {
			files.push(...(await this.listIrdeckFilesRecursive(folderPath)));
		}

		return files;
	}
}
