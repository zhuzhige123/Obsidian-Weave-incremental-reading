/** 库内可见 .irdeck 文件条目（数据管理扫描） */
export interface IRVaultPointFileEntry {
	absolutePath: string;
	topicId: string;
	topicName: string;
	pointCount: number;
	updatedAt: string;
	isInCanonicalDir: boolean;
}

export type IRPointFileFormatIssueSeverity = "error" | "warning" | "info";

/** 单条格式/结构问题 */
export interface IRPointFileFormatIssue {
	code: string;
	message: string;
	severity: IRPointFileFormatIssueSeverity;
}

/** 单文件格式检查报告 */
export interface IRPointFileFormatReport {
	absolutePath: string;
	topicId: string;
	topicName: string;
	pointCount: number;
	issues: IRPointFileFormatIssue[];
	needsMigration: boolean;
	canMigrate: boolean;
	isEmpty: boolean;
}

/** 同 topicId 多文件分组 */
export interface IRDuplicateTopicGroup {
	topicId: string;
	topicName: string;
	files: IRVaultPointFileEntry[];
}

/** 同 point id 多份内容不一致时，用户可选择的单个版本 */
export interface IRMergePointVariant {
	filePath: string;
	fingerprint: string;
	title: string;
}

/** 合并多份 .irdeck 时，同一阅读点 id 对应不同正文/字段的冲突 */
export interface IRMergePointIdConflict {
	pointId: string;
	variants: IRMergePointVariant[];
}

/** 两份专题文件差异摘要 */
export interface IRPointFilePairDiff {
	pathA: string;
	pathB: string;
	pointCountA: number;
	pointCountB: number;
	sharedPointIds: string[];
	onlyInA: string[];
	onlyInB: string[];
}

/** 计划移动条目 */
export interface IRPointFileMovePlanItem {
	sourcePath: string;
	targetPath: string;
	topicId: string;
	topicName: string;
	reason: string;
}

/** 插件备份目录中的孤立专题文件 */
export interface IRBackupOrphanEntry {
	absolutePath: string;
	topicId: string;
	topicName: string;
	pointCount: number;
	updatedAt: string;
	backupRoot: string;
	relativePath: string;
}

/** 合并重复专题文件的结果 */
export interface IRPointFileMergeResult {
	keeperPath: string;
	addedPointCount: number;
	skippedDuplicatePointCount: number;
	replacedByResolutionCount: number;
	removedPaths: string[];
	/** 若存在未解决的同 id 内容冲突，则不会写入、也不会删除副本 */
	conflicts?: IRMergePointIdConflict[];
}

/** 数据管理全量扫描结果 */
export interface IRDataManagementScanResult {
	canonicalPointsDir: string;
	vaultFiles: IRVaultPointFileEntry[];
	duplicateGroups: IRDuplicateTopicGroup[];
	backupOrphans: IRBackupOrphanEntry[];
	formatReports: IRPointFileFormatReport[];
	emptyPointFiles: IRVaultPointFileEntry[];
	needsMigrationFiles: IRPointFileFormatReport[];
	scannedAt: number;
}
