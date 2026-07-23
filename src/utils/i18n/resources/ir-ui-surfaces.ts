import type { AuthoringLanguage, TranslationKey } from "../types";

const zhIrDataMgmt: TranslationKey = {
	title: "增量阅读数据管理",
	tabs: {
		vault: "库内专题文件",
		format: "格式与空专题",
		duplicates: "重复专题",
		backups: "备份孤立专题",
		countSuffix: " ({count})",
	},
	notices: {
		scanFailed: "扫描增量阅读数据失败",
		compareNeedTwoFiles: "请选择两个不同的文件进行比较",
		compareFailed: "比较失败",
		noFilesToMove: "没有需要移动的文件",
		movedFiles: "已移动 {count} 个专题文件",
		moveFailed: "移动失败：{message}",
		mergeConflictPickVersion: "检测到内容冲突，请在下方选择保留版本后再合并",
		deleteFailed: "删除失败",
		selectKeeperFirst: "请先选择要保留的文件",
		noOtherFilesToDelete: "没有其它文件需要删除",
		pickConflictVersion: "请为每个冲突阅读点选择要保留的文件版本",
		conflictsDetected:
			"检测到 {count} 个阅读点在不同文件中内容不一致。请在下方为每个点选择保留版本，然后再次点击合并按钮。",
		conflictScanFailed: "检测合并冲突失败",
		recoveredTo: "已恢复到：{path}",
		recoverFailed: "恢复失败：{message}",
		backupDeleted: "已删除备份文件",
		migratedFile: "专题文件已迁移为当前规范格式",
		migrateFailed: "迁移失败",
		noFilesToMigrate: "没有需要迁移的文件",
		migratedBatch: "已迁移 {count} 个专题文件",
		batchMigrateFailed: "批量迁移失败",
		emptyFileDeleted: "已删除空专题文件",
		legacyMigrationDone: "旧存储迁移完成：成功 {success}，失败 {failed}",
		legacyMigrationFailed: "旧存储迁移失败",
		mergeSuccessWithResolutions:
			"已合并 {added} 个阅读点，跳过相同内容 {skipped} 个，按选择覆盖 {replaced} 个，删除 {removed} 个文件",
		mergeSuccess:
			"已合并 {added} 个阅读点，跳过重复 {skipped} 个，删除 {removed} 个文件",
		noLegacyPointsToUnify: "没有需要统一的旧版 Markdown 阅读点",
		pointFormatScanFailed: "阅读点格式统计失败",
		pointFormatUnifyDone:
			"已统一 {migrated} 个旧版阅读点为 chunk 格式，跳过 {skipped} 个，失败 {failed} 个",
		pointFormatUnifyFailed: "统一阅读点格式失败",
		invalidSourcePathScanFailed: "无效来源路径扫描失败",
		noInvalidSourcePaths: "没有需要清理的无效来源路径",
		invalidSourcePathNormalizeDone:
			"已清理 {pointsRepaired} 个阅读点的无效路径（{pathsCleared} 个字段），更新 {filesUpdated} 个专题文件",
		invalidSourcePathNormalizeFailed: "清理无效来源路径失败",
	},
	confirm: {
		normalizeMoveTitle: "确认规范移动",
		normalizeMoveConfirm: "开始移动",
		normalizeMoveBody:
			"将把 {count} 个专题文件移动到：\n{targetDir}\n\n{preview}{more}",
		normalizeMoveMore: "\n… 另有 {more} 个文件",
		mergeTitle: "确认合并并删除其它副本",
		mergeConfirm: "合并后删除",
		mergeKeeperLabel: "保留",
		mergeKeeperFileLabel: "保留文件",
		mergeConflictNote:
			"\n\n已处理 {count} 个「同阅读点 id、内容不一致」冲突（按你在下方选择的版本写入）。",
		mergeBody:
			"{keeperLabel}：\n{keeper}{conflictNote}\n\n将把其它 {removeCount} 个文件中的阅读点（按 id 去重）合并进保留文件，然后删除这些副本：\n{toRemove}\n\n此操作不可撤销。",
		recoverTitle: "确认恢复专题文件",
		recoverConfirm: "恢复",
		recoverBody: "将恢复到库内目录：\n{targetDir}\n\n来源：\n{sourcePath}",
		deleteBackupTitle: "确认删除备份文件",
		deleteBackupConfirm: "删除",
		deleteBackupBody: "不恢复并删除备份文件：\n{path}\n\n此操作不可撤销。",
		migrateFileTitle: "确认迁移专题文件",
		migrateFileConfirm: "迁移",
		migrateFileBody:
			"将把以下文件迁移为当前规范结构（schemaVersion={version}）：\n{path}\n\n{issues}",
		migrateBatchTitle: "确认批量迁移",
		migrateBatchConfirm: "开始迁移",
		migrateBatchBody: "将迁移 {count} 个专题文件为当前规范结构。建议先备份库。",
		deleteEmptyTitle: "删除空专题文件",
		deleteEmptyConfirm: "删除",
		deleteEmptyBody:
			"该专题文件没有任何阅读点：\n{path}\n\n是否删除此 .irdeck 文件？",
		legacyMigrationTitle: "执行旧存储迁移",
		legacyMigrationConfirm: "开始迁移",
		legacyMigrationBody:
			"这会把旧 chunks/sources/materials 等 vault 残留迁移到新 IR 存储结构，并清理已迁移的旧文件。建议先备份。",
		pointFormatUnifyTitle: "统一阅读点格式",
		pointFormatUnifyConfirm: "开始统一",
		pointFormatUnifyBody:
			"将把 {count} 个旧版 Markdown 阅读点（legacy-block）升级为当前 chunk-entry 格式。\n\n调度、溯源与标签会尽量保留；PDF/EPUB 阅读点不受影响。\n\n建议先备份库后再执行。",
		invalidSourcePathNormalizeTitle: "清理无效来源路径",
		invalidSourcePathNormalizeConfirm: "开始清理",
		invalidSourcePathNormalizeBody:
			"将清除 {pointCount} 个阅读点中的无效来源路径（如 /、目录、无扩展名等），并写回 {fileCount} 个专题文件。\n\n无法推断正确路径的字段会被删除；相关阅读点可能暂时无法调度，需你后续手动修复。\n\n建议先备份库后再执行。",
	},
	help: {
		ariaLabel: "查看当前标签页说明",
		dialogLabel: "当前标签页说明",
		vault:
			"列出 Obsidian 文件列表可见的全部 .irdeck。可将散落文件一键移动到规范目录 {canonicalDir}；同专题 ID 的多份文件会排在同一目录下（第 2 份起使用 .part2 后缀）。",
		vaultCanonicalPending: "（扫描后显示）",
		format:
			"检查 .irdeck 是否符合当前数据结构；可清理无效来源路径、将 legacy-block 统一为 chunk 格式、迁移旧 schema；空专题可删除。",
		duplicates:
			"同一专题 ID 对应多份库内文件时，请比较差异后选择要保留的一份；其余副本将从库内删除（请先确认阅读点是否已合并到保留文件）。",
		backups:
			"以下文件仅存在于插件安装目录的 backups / json-recovery 中，当前库内没有相同专题 ID 的在用文件。可恢复到库内规范目录，或选择不恢复并直接删除备份。",
	},
	rescan: {
		ariaLabel: "重新扫描",
		loading: "正在扫描…",
		tooltip: "重新扫描库内与备份中的专题文件",
	},
	legacy: {
		title: "旧 vault 存储迁移",
		description:
			"检测到 {count} 项旧增量阅读存储待迁移（Weave 主插件已不再处理此类任务）。",
		action: "执行旧存储迁移",
	},
	loading: "正在扫描库内与插件备份中的增量阅读专题文件…",
	scanFailedInline: "扫描失败，请重试。",
	columns: {
		topic: "专题",
		path: "路径",
		points: "阅读点",
		status: "状态",
		issues: "问题",
		actions: "操作",
		backupPath: "备份路径",
	},
	format: {
		pointKindTitle: "阅读点格式分布",
		pointKindLoading: "正在统计阅读点格式…",
		pointKindStats:
			"共 {total} 个阅读点：chunk {chunk} · 旧版 Markdown {legacy} · PDF {pdf} · EPUB {epub} · 其它 {other}",
		pointKindAllUnified: "所有 Markdown 阅读点均已使用 chunk 格式，无需统一。",
		pointKindLegacyHint:
			"旧版 Markdown 阅读点仍走 legacy-block 调度路径，可能与 chunk 双轨并存。建议统一为 chunk 格式。",
		unifyLegacyPoints: "统一阅读点格式（{count}）",
		needsMigrationTitle: "需规范迁移（{count}）",
		allCompliant: "所有可见专题文件均已符合当前结构。",
		batchMigrate: "批量迁移为当前格式（{count}）",
		migrate: "迁移",
		emptyTitle: "空专题文件（{count}）",
		noEmpty: "没有阅读点数为 0 的专题文件。",
		deleteEmpty: "删除空文件",
		invalidSourcePathTitle: "无效来源路径（{count}）",
		invalidSourcePathLoading: "正在扫描无效来源路径…",
		invalidSourcePathStats:
			"共 {pointCount} 个阅读点、{fieldCount} 个字段含无效路径，涉及 {fileCount} 个专题文件",
		invalidSourcePathAllClean: "所有阅读点来源路径均已符合规范。",
		invalidSourcePathHint:
			"无效路径（如 /、目录、无扩展名）会导致月历同步或分析页异常。清理会写回 .irdeck 并删除这些字段。",
		normalizeInvalidSourcePaths: "清理无效来源路径（{pointCount}）",
	},
	vault: {
		pathPanelTitle: "路径规范整理",
		pathPanelDesc:
			"默认规范目录为 {canonicalDir}。在下方设置目标目录后，可一键移动散落文件。",
		targetDir: "目标目录",
		normalizeMove: "一键规范移动（{count}）",
		statusInCanonical: "已在规范目录",
		statusPending: "待整理",
	},
	duplicates: {
		groupsTitle: "重复专题组",
		noGroups: "当前没有同 ID 多文件专题。",
		fileCount: "{count} 个文件",
		selectGroup: "请选择左侧重复专题组。",
		compareA: "比较 A",
		compareB: "比较 B",
		analyzeDiff: "分析差异",
		diffSummary: "A：{countA} 点 · B：{countB} 点 · 相同 ID：{shared}",
		onlyInA: "仅在 A（{count}）",
		onlyInB: "仅在 B（{count}）",
		moreIds: "… 还有 {count} 个",
		conflictTitle: "同阅读点 ID 内容冲突（请为每个点选择保留哪一版）",
		conflictHint:
			"下列阅读点在多个文件里 id 相同但字段不一致；未选择完整前不会写入保留文件，也不会删除副本。",
		cancelConflict: "取消冲突处理",
		mergeWithChoices: "确认合并（已选版本）并删除其它副本",
		mergeAndDelete: "保留所选文件并删除其它副本",
	},
	backups: {
		empty: "未发现备份中的孤立专题文件。",
		recover: "恢复到库内",
		deleteWithoutRecover: "不恢复，删除",
	},
	fileLabel: "{name}（{count} 点）",
};

const enIrDataMgmt: TranslationKey = {
	title: "Incremental Reading Data Management",
	tabs: {
		vault: "In-library topic files",
		format: "Format & empty topics",
		duplicates: "Duplicate topics",
		backups: "Backup orphan topics",
		countSuffix: " ({count})",
	},
	notices: {
		scanFailed: "Failed to scan incremental reading data",
		compareNeedTwoFiles: "Choose two different files to compare",
		compareFailed: "Comparison failed",
		noFilesToMove: "No files need to be moved",
		movedFiles: "Moved {count} topic files",
		moveFailed: "Move failed: {message}",
		mergeConflictPickVersion:
			"Content conflicts detected. Choose the version to keep below, then merge again",
		deleteFailed: "Delete failed",
		selectKeeperFirst: "Select the file to keep first",
		noOtherFilesToDelete: "No other files need to be deleted",
		pickConflictVersion:
			"Choose a file version for each conflicting reading point",
		conflictsDetected:
			"Detected {count} reading points with the same ID but different content across files. Choose a version for each point below, then click merge again.",
		conflictScanFailed: "Failed to scan merge conflicts",
		recoveredTo: "Recovered to: {path}",
		recoverFailed: "Recovery failed: {message}",
		backupDeleted: "Backup file deleted",
		migratedFile: "Topic file migrated to the current schema",
		migrateFailed: "Migration failed",
		noFilesToMigrate: "No files need migration",
		migratedBatch: "Migrated {count} topic files",
		batchMigrateFailed: "Batch migration failed",
		emptyFileDeleted: "Empty topic file deleted",
		legacyMigrationDone:
			"Legacy storage migration finished: {success} succeeded, {failed} failed",
		legacyMigrationFailed: "Legacy storage migration failed",
		mergeSuccessWithResolutions:
			"Merged {added} reading points, skipped {skipped} identical entries, overwrote {replaced} by selection, removed {removed} files",
		mergeSuccess:
			"Merged {added} reading points, skipped {skipped} duplicates, removed {removed} files",
		noLegacyPointsToUnify: "No legacy Markdown reading points need unification",
		pointFormatScanFailed: "Failed to scan reading-point formats",
		pointFormatUnifyDone:
			"Unified {migrated} legacy reading point(s) to chunk format; skipped {skipped}, failed {failed}",
		pointFormatUnifyFailed: "Failed to unify reading-point formats",
		invalidSourcePathScanFailed: "Failed to scan invalid source paths",
		noInvalidSourcePaths: "No invalid source paths need cleanup",
		invalidSourcePathNormalizeDone:
			"Cleaned invalid paths on {pointsRepaired} reading point(s) ({pathsCleared} field(s)), updated {filesUpdated} topic file(s)",
		invalidSourcePathNormalizeFailed: "Failed to clean invalid source paths",
	},
	confirm: {
		normalizeMoveTitle: "Confirm normalization move",
		normalizeMoveConfirm: "Start move",
		normalizeMoveBody:
			"Move {count} topic files to:\n{targetDir}\n\n{preview}{more}",
		normalizeMoveMore: "\n… plus {more} more files",
		mergeTitle: "Confirm merge and delete other copies",
		mergeConfirm: "Merge and delete",
		mergeKeeperLabel: "Keep",
		mergeKeeperFileLabel: "Keep file",
		mergeConflictNote:
			"\n\nResolved {count} conflicts where the same reading-point ID had different content (written using your selections below).",
		mergeBody:
			"{keeperLabel}:\n{keeper}{conflictNote}\n\nReading points from the other {removeCount} file(s) will be merged into the kept file (deduplicated by ID), then these copies will be deleted:\n{toRemove}\n\nThis cannot be undone.",
		recoverTitle: "Confirm topic file recovery",
		recoverConfirm: "Recover",
		recoverBody:
			"Recover into vault directory:\n{targetDir}\n\nSource:\n{sourcePath}",
		deleteBackupTitle: "Confirm backup file deletion",
		deleteBackupConfirm: "Delete",
		deleteBackupBody:
			"Delete this backup file without recovering it:\n{path}\n\nThis cannot be undone.",
		migrateFileTitle: "Confirm topic file migration",
		migrateFileConfirm: "Migrate",
		migrateFileBody:
			"Migrate this file to the current schema (schemaVersion={version}):\n{path}\n\n{issues}",
		migrateBatchTitle: "Confirm batch migration",
		migrateBatchConfirm: "Start migration",
		migrateBatchBody:
			"Migrate {count} topic files to the current schema. Back up your vault first.",
		deleteEmptyTitle: "Delete empty topic file",
		deleteEmptyConfirm: "Delete",
		deleteEmptyBody:
			"This topic file has no reading points:\n{path}\n\nDelete this .irdeck file?",
		legacyMigrationTitle: "Run legacy storage migration",
		legacyMigrationConfirm: "Start migration",
		legacyMigrationBody:
			"Migrates legacy vault chunks/sources/materials into the new IR storage layout and cleans up migrated old files. Back up first.",
		pointFormatUnifyTitle: "Unify reading-point formats",
		pointFormatUnifyConfirm: "Start unification",
		pointFormatUnifyBody:
			"Upgrade {count} legacy Markdown reading point(s) (legacy-block) to the current chunk-entry format.\n\nScheduling, trace links, and tags are preserved when possible. PDF/EPUB points are not changed.\n\nBack up your vault before proceeding.",
		invalidSourcePathNormalizeTitle: "Clean invalid source paths",
		invalidSourcePathNormalizeConfirm: "Start cleanup",
		invalidSourcePathNormalizeBody:
			"Remove invalid source paths (such as /, folders, or paths without extensions) from {pointCount} reading point(s) across {fileCount} topic file(s).\n\nFields that cannot be inferred are deleted; affected points may be temporarily unschedulable until you repair them manually.\n\nBack up your vault first.",
	},
	help: {
		ariaLabel: "View help for the current tab",
		dialogLabel: "Current tab help",
		vault:
			"Lists every visible .irdeck file in Obsidian. Scattered files can be moved into the canonical directory {canonicalDir} in one step. Multiple files for the same topic ID are grouped in one folder (.part2 suffix from the second copy onward).",
		vaultCanonicalPending: "(shown after scan)",
		format:
			"Checks .irdeck schema compliance; cleans invalid source paths; unifies legacy-block points to chunk format; migrates old schemas; deletes empty topic files.",
		duplicates:
			"When one topic ID maps to multiple vault files, compare differences and choose one to keep. Other copies are removed from the vault (confirm reading points are merged into the kept file first).",
		backups:
			"These files exist only under the plugin install directory (backups / json-recovery) with no active vault file for the same topic ID. Recover into the canonical vault directory, or delete the backup without recovering.",
	},
	rescan: {
		ariaLabel: "Rescan",
		loading: "Scanning…",
		tooltip: "Rescan topic files in the vault and plugin backups",
	},
	legacy: {
		title: "Legacy vault storage migration",
		description:
			"Found {count} legacy incremental-reading storage item(s) pending migration (no longer handled by the Weave main plugin).",
		action: "Run legacy storage migration",
	},
	loading:
		"Scanning incremental-reading topic files in the vault and plugin backups…",
	scanFailedInline: "Scan failed. Please try again.",
	columns: {
		topic: "Topic",
		path: "Path",
		points: "Reading points",
		status: "Status",
		issues: "Issues",
		actions: "Actions",
		backupPath: "Backup path",
	},
	format: {
		pointKindTitle: "Reading-point format breakdown",
		pointKindLoading: "Scanning reading-point formats…",
		pointKindStats:
			"{total} total: chunk {chunk} · legacy Markdown {legacy} · PDF {pdf} · EPUB {epub} · other {other}",
		pointKindAllUnified:
			"All Markdown reading points already use chunk format.",
		pointKindLegacyHint:
			"Legacy Markdown points still use the legacy-block scheduling path. Unifying to chunk format is recommended.",
		unifyLegacyPoints: "Unify reading-point formats ({count})",
		needsMigrationTitle: "Needs schema migration ({count})",
		allCompliant: "All visible topic files already match the current schema.",
		batchMigrate: "Batch migrate to current format ({count})",
		migrate: "Migrate",
		emptyTitle: "Empty topic files ({count})",
		noEmpty: "No topic files with zero reading points.",
		deleteEmpty: "Delete empty file",
		invalidSourcePathTitle: "Invalid source paths ({count})",
		invalidSourcePathLoading: "Scanning invalid source paths…",
		invalidSourcePathStats:
			"{pointCount} reading point(s) with {fieldCount} invalid path field(s) across {fileCount} topic file(s)",
		invalidSourcePathAllClean: "All reading-point source paths are valid.",
		invalidSourcePathHint:
			"Invalid paths (such as /, folders, or paths without extensions) can break calendar sync or analytics. Cleanup writes back to .irdeck and removes those fields.",
		normalizeInvalidSourcePaths: "Clean invalid source paths ({pointCount})",
	},
	vault: {
		pathPanelTitle: "Path normalization",
		pathPanelDesc:
			"The default canonical directory is {canonicalDir}. Set a target directory below to move scattered files in one step.",
		targetDir: "Target directory",
		normalizeMove: "Normalize paths ({count})",
		statusInCanonical: "In canonical directory",
		statusPending: "Needs cleanup",
	},
	duplicates: {
		groupsTitle: "Duplicate topic groups",
		noGroups: "No topic IDs with multiple vault files.",
		fileCount: "{count} files",
		selectGroup: "Select a duplicate topic group on the left.",
		compareA: "Compare A",
		compareB: "Compare B",
		analyzeDiff: "Analyze differences",
		diffSummary:
			"A: {countA} points · B: {countB} points · Shared IDs: {shared}",
		onlyInA: "Only in A ({count})",
		onlyInB: "Only in B ({count})",
		moreIds: "… plus {count} more",
		conflictTitle:
			"Same reading-point ID, different content (choose a version for each)",
		conflictHint:
			"These reading points share an ID across files but differ in fields. Nothing is written or deleted until every conflict has a selection.",
		cancelConflict: "Cancel conflict resolution",
		mergeWithChoices: "Merge with selected versions and delete other copies",
		mergeAndDelete: "Keep selected file and delete other copies",
	},
	backups: {
		empty: "No orphan topic files found in backups.",
		recover: "Recover to vault",
		deleteWithoutRecover: "Delete without recovering",
	},
	fileLabel: "{name} ({count} pts)",
};

const zhIrBlockInfo: TranslationKey = {
	dialogLabel: "内容块信息与来源",
	sections: {
		basic: "基础信息",
		learning: "学习数据",
		time: "时间信息",
		source: "来源信息",
		formula: "核心算法公式",
		currentParams: "当前参数值",
		psiExplain: "变速函数 Ψ(p) 解释",
		calcDemo: "计算过程演示",
		actualSchedule: "实际调度结果",
		priorityHistory: "优先级变更历史",
		ewma: "优先级平滑（EWMA）",
	},
	labels: {
		blockId: "内容块ID",
		file: "所属文件",
		deckName: "所属专题",
		state: "内容块状态",
		priority: "优先级",
		title: "标题",
		parentReadingPoint: "父阅读点",
		currentInterval: "当前间隔",
		intervalFactor: "间隔因子",
		reviewCount: "复习次数",
		cardCount: "制卡数量",
		linkedNoteCount: "关联md笔记数量",
		totalReadingTime: "累计阅读时长",
		lastRating: "上次理解度",
		effectivePriority: "有效优先级",
		createdAt: "创建时间",
		updatedAt: "修改时间",
		listAppearDate: "列表出现日",
		firstSchedule: "首次排期",
		nextReview: "下次复习",
		nextReviewPending: "未计算（完成阅读后由算法生成）",
		listAppearRolledHint: "承诺日 {date}，已滚入今日列表",
		nextReviewOverdueHint: "已逾期，仍出现在今日列表",
		scheduleAnchorDate: "钉日/序列锚点",
		lastReview: "上次复习",
		firstRead: "首次阅读",
		sourceDoc: "源文档",
		lineRange: "# 行号范围",
		tags: "标签",
	},
	states: {
		new: "新内容",
		learning: "学习中",
		review: "复习中",
		suspended: "已暂停",
		queued: "已排队",
		scheduled: "已调度",
		active: "活跃中",
		done: "已完成",
		unknown: "未知",
	},
	priority: {
		unset: "未设置",
		low: "低",
		medium: "中",
		high: "高",
		urgent: "紧急",
	},
	ratings: {
		unset: "未评分",
		ignore: "忽略",
		ok: "一般",
		clear: "清晰",
		master: "精通",
	},
	values: {
		notSet: "未设置",
		unknown: "未知",
		unknownFile: "未知文件",
		noTitle: "无标题",
		formatError: "格式错误",
		lessThanOneDay: "少于1天",
		oneDay: "1天",
		days: "{count}天",
		months: "{count}个月",
		years: "{count}年",
		seconds: "{count}秒",
		minutesSeconds: "{mins}分{secs}秒",
		hoursMinutes: "{hours}小时{mins}分",
		reviewCountSuffix: "{count}次",
		backToDetail: "返回详情",
		copy: "复制",
		daysOffset: "{value} 天",
	},
	calc: {
		formulaDesc: "其中 Ψ(p) 是变速函数，根据优先级调整间隔增长速度",
		highPriority: "高优先级模式",
		lowPriority: "低优先级模式",
		neutralPriority: "中性优先级",
		highEffect: "效果：间隔缩短，复习频率提高",
		lowEffect: "效果：间隔拉长，复习频率降低",
		neutralEffect: "效果：标准间隔增长",
		neutralPoint: "P_eff = 5（中性点）",
		stepRaw: "原始计算：{interval} × {mBase} × {mGroup} × {psi}",
		stepResult: "= {value} 天",
		stepClamp: "Clamp 到 [{min}, {max}]：{value} 天",
		nextReviewTime: "当前调度到期",
		daysFromToday: "距今天数",
		predictedInterval: "预测下次间隔（完成阅读后写入）",
		ewmaDesc:
			"EWMA 用于平滑优先级变化，避免单次调整造成过大波动。每次调整只影响 {percent}% 的权重。",
		labels: {
			currentInterval: "I_curr（当前间隔）",
			mBase: "M_base（基础扩张乘子）",
			mGroup: "M_group（TagGroup 系数）",
			pEff: "P_eff（有效优先级）",
			psi: "Ψ(P_eff)（变速系数）",
			minMax: "I_min / I_max",
			alpha: "α（EWMA 系数）",
		},
	},
};

const enIrBlockInfo: TranslationKey = {
	dialogLabel: "Reading block info & source",
	sections: {
		basic: "Basic information",
		learning: "Learning data",
		time: "Time",
		source: "Source",
		formula: "Core formula",
		currentParams: "Current parameters",
		psiExplain: "Speed function Ψ(p)",
		calcDemo: "Calculation walkthrough",
		actualSchedule: "Scheduled outcome",
		priorityHistory: "Priority change history",
		ewma: "Priority smoothing (EWMA)",
	},
	labels: {
		blockId: "Block ID",
		file: "File",
		deckName: "Topic",
		state: "Block state",
		priority: "Priority",
		title: "Title",
		parentReadingPoint: "Parent reading point",
		currentInterval: "Current interval",
		intervalFactor: "Interval factor",
		reviewCount: "Review count",
		cardCount: "Cards",
		linkedNoteCount: "Linked markdown notes",
		totalReadingTime: "Total reading time",
		lastRating: "Last comprehension",
		effectivePriority: "Effective priority",
		createdAt: "Created",
		updatedAt: "Modified",
		listAppearDate: "List appear day",
		firstSchedule: "First schedule",
		nextReview: "Next review",
		nextReviewPending: "Not calculated (set after you finish reading)",
		listAppearRolledHint: "Committed {date}; rolled into today's list",
		nextReviewOverdueHint: "Overdue; still shown in today's list",
		scheduleAnchorDate: "Pin / sequence anchor",
		lastReview: "Last review",
		firstRead: "First read",
		sourceDoc: "Source document",
		lineRange: "# Line range",
		tags: "Tags",
	},
	states: {
		new: "New",
		learning: "Learning",
		review: "Reviewing",
		suspended: "Suspended",
		queued: "Queued",
		scheduled: "Scheduled",
		active: "Active",
		done: "Done",
		unknown: "Unknown",
	},
	priority: {
		unset: "Not set",
		low: "Low",
		medium: "Medium",
		high: "High",
		urgent: "Urgent",
	},
	ratings: {
		unset: "Not rated",
		ignore: "Ignore",
		ok: "OK",
		clear: "Clear",
		master: "Mastered",
	},
	values: {
		notSet: "Not set",
		unknown: "Unknown",
		unknownFile: "Unknown file",
		noTitle: "No title",
		formatError: "Invalid format",
		lessThanOneDay: "Less than 1 day",
		oneDay: "1 day",
		days: "{count} days",
		months: "{count} months",
		years: "{count} years",
		seconds: "{count}s",
		minutesSeconds: "{mins}m {secs}s",
		hoursMinutes: "{hours}h {mins}m",
		reviewCountSuffix: "{count} times",
		backToDetail: "Back to details",
		copy: "Copy",
		daysOffset: "{value} days",
	},
	calc: {
		formulaDesc: "Ψ(p) adjusts how quickly intervals grow based on priority.",
		highPriority: "High-priority mode",
		lowPriority: "Low-priority mode",
		neutralPriority: "Neutral priority",
		highEffect: "Effect: shorter intervals, more frequent reviews",
		lowEffect: "Effect: longer intervals, fewer reviews",
		neutralEffect: "Effect: standard interval growth",
		neutralPoint: "P_eff = 5 (neutral)",
		stepRaw: "Raw: {interval} × {mBase} × {mGroup} × {psi}",
		stepResult: "= {value} days",
		stepClamp: "Clamp to [{min}, {max}]: {value} days",
		nextReviewTime: "Current scheduled due",
		daysFromToday: "Days from today",
		predictedInterval: "Predicted next interval (written after finish)",
		ewmaDesc:
			"EWMA smooths priority changes so a single adjustment does not swing scheduling too far. Each change affects {percent}% of the weight.",
		labels: {
			currentInterval: "I_curr (current interval)",
			mBase: "M_base (base multiplier)",
			mGroup: "M_group (tag group factor)",
			pEff: "P_eff (effective priority)",
			psi: "Ψ(P_eff) (speed factor)",
			minMax: "I_min / I_max",
			alpha: "α (EWMA coefficient)",
		},
	},
};

const zhIrSettingsStandalone: TranslationKey = {
	tabs: {
		basic: "基础",
		coreScheduling: "基础调度",
		advanced: "高级调度",
		license: "授权",
		about: "关于",
	},
	language: {
		title: "界面语言",
		description:
			"选择插件界面显示语言。设为「跟随 Obsidian」时将随 Obsidian 语言设置自动切换。",
		auto: "跟随 Obsidian",
		zhCN: "简体中文",
		zhTW: "繁體中文",
		enUS: "English",
		jaJP: "日本語",
		koKR: "한국어",
		ruRU: "Русский",
	},
	premiumPreview: {
		title: "显示高级功能预览",
		description:
			"开启后，基础设置页与阅读器中会显示锁定状态的高级功能入口；关闭后全部隐藏。",
	},
	dataFolders: {
		title: "数据文件夹配置",
		description:
			"配置插件数据文件夹与阅读点默认位置。插件机读数据（points、materials、registry 等）统一保存在所选数据文件夹下。",
		localDataName: "增量阅读本地数据文件夹",
		localDataDesc:
			"用于选择增量阅读数据在仓库中的本地目录；建议使用独立子目录，便于后续迁移与备份。",
		localDataPlaceholder: "例如：weave Incremental reading/local-data",
		localDataPicker: "选择增量阅读本地数据文件夹...",
		saveFolderName: "插件数据文件夹",
		saveFolderDesc:
			"选择插件数据文件夹。留空使用默认「weave Incremental reading」；points、materials、registry 等会自动保存在该文件夹下，与 Weave 系列其它插件的 weave/ 目录隔离。",
		saveFolderPlaceholder: "例如：weave Incremental reading",
		saveFolderPicker: "选择插件数据文件夹...",
		readingPointFolderName: "阅读点默认保存文件夹",
		readingPointFolderDesc:
			"仅用于新建 Markdown 阅读点（MD 阅读点）的默认保存路径；留空则遵循 Obsidian 新建笔记位置。",
		readingPointPlaceholder: "留空则使用 Obsidian 默认位置",
		readingPointPicker: "选择阅读点默认保存文件夹...",
		dataMgmtName: "增量阅读数据管理",
		dataMgmtDesc:
			"整理库内 .irdeck 路径、比较重复专题差异、恢复或清理插件备份中的孤立专题文件。",
		openDataMgmt: "打开数据管理",
		choose: "选择",
	},
	about: {
		pluginInfoTitle: "插件信息",
		pluginInfoDesc: "用于查看独立增量阅读插件当前版本、定位与核心支持能力。",
		basicInfoSection: "插件基础信息",
		name: "插件名称",
		version: "当前版本",
		positioning: "产品定位",
		positioningValue: "独立增量阅读主控插件",
		collaboration: "协作关系",
		collaborationValue: "可与 Weave 主插件、EPUB 阅读器协同",
		capabilitiesSection: "核心能力覆盖",
		supportScope: "支持范围",
		openTutorial: "打开完整教程",
		openTutorialDesc: "查看入门、添加阅读点、材料导入、来源溯源、数据路径与 Weave 系列说明。",
		contactsTitle: "联系与资源",
		contacts: {
			docs: "查看文档",
			changelog: "更新日志",
			community: "交流反馈",
			communityMenu: {
				qqPublic: "QQ公开交流群",
				otherInDocs: "其它群可在文档中找到",
			},
			author: "联系作者",
		},
	},
	supportedFormats: {
		markdown: "Markdown",
		pdfBookmark: "PDF 书签",
		epubSource: "EPUB 来源回跳",
		canvas: "Canvas",
	},
};

const enIrSettingsStandalone: TranslationKey = {
	tabs: {
		basic: "Basic",
		coreScheduling: "Core scheduling",
		advanced: "Advanced scheduling",
		license: "License",
		about: "About",
	},
	language: {
		title: "Interface language",
		description:
			"Choose the language for plugin UI. With “Follow Obsidian”, the UI tracks your Obsidian language setting.",
		auto: "Follow Obsidian",
		zhCN: "简体中文",
		zhTW: "繁體中文",
		enUS: "English",
		jaJP: "日本語",
		koKR: "한국어",
		ruRU: "Русский",
	},
	premiumPreview: {
		title: "Show advanced feature preview",
		description:
			"When enabled, locked advanced feature entries appear in basic settings and the reader; when disabled, they are hidden.",
	},
	dataFolders: {
		title: "Data folder configuration",
		description:
			"Configure the plugin data folder and default reading-point location. Machine-readable IR data (points, materials, registry, etc.) is stored under the selected data folder.",
		localDataName: "Incremental reading local data folder",
		localDataDesc:
			"Vault folder for incremental-reading local data. Use a dedicated subfolder for easier migration and backup.",
		localDataPlaceholder: "e.g. weave Incremental reading/local-data",
		localDataPicker: "Choose incremental reading local data folder...",
		saveFolderName: "Plugin data folder",
		saveFolderDesc:
			"Choose the plugin data folder. Leave blank for the default “weave Incremental reading”; points, materials, registry, etc. are saved under it automatically, isolated from other Weave-series weave/ folders.",
		saveFolderPlaceholder: "e.g. weave Incremental reading",
		saveFolderPicker: "Choose plugin data folder...",
		readingPointFolderName: "Default reading-point save folder",
		readingPointFolderDesc:
			"Default save path for new Markdown reading points only. Leave blank to follow Obsidian’s new-note location.",
		readingPointPlaceholder: "Leave blank for Obsidian default",
		readingPointPicker: "Choose default reading-point save folder...",
		dataMgmtName: "Incremental reading data management",
		dataMgmtDesc:
			"Normalize .irdeck paths, compare duplicate topics, and recover or clean orphan topic files in plugin backups.",
		openDataMgmt: "Open data management",
		choose: "Choose",
	},
	about: {
		pluginInfoTitle: "Plugin information",
		pluginInfoDesc:
			"Version, positioning, and core capabilities of the standalone incremental-reading plugin.",
		basicInfoSection: "Basics",
		name: "Plugin name",
		version: "Current version",
		positioning: "Product role",
		positioningValue: "Standalone incremental-reading control plugin",
		collaboration: "Works with",
		collaborationValue: "Weave main plugin and EPUB reader",
		capabilitiesSection: "Core capabilities",
		supportScope: "Supported sources",
		openTutorial: "Open full tutorial",
		openTutorialDesc:
			"Overview, adding reading points, material import, source tracing, data paths, and the Weave family.",
		contactsTitle: "Links & support",
		contacts: {
			docs: "View documentation",
			changelog: "Changelog",
			community: "Community & feedback",
			communityMenu: {
				qqPublic: "QQ community group",
				otherInDocs: "Other groups (see docs)",
			},
			author: "Contact author",
		},
	},
	supportedFormats: {
		markdown: "Markdown",
		pdfBookmark: "PDF bookmarks",
		epubSource: "EPUB source jump-back",
		canvas: "Canvas",
	},
};

const zhIrAnalytics: TranslationKey = {
	tabs: {
		activity: "活跃趋势",
		quantity: "数量变化",
		timing: "调度时机",
		difficulty: "优先级矩阵",
		forecast: "未来负荷",
	},
	range: {
		last7: "最近 7 天",
		last14: "最近 14 天",
		last30: "最近 30 天",
		last60: "最近 60 天",
		last90: "最近 90 天",
		daysShort: "{days}天",
		daysLabel: "{days} 天",
	},
	toolbar: {
		mode: "分析模式",
		selection: "条件选择",
		timeRange: "时间范围",
		pickSelection: "选择",
	},
	modes: {
		topic: "专题",
		tag: "标签",
		overall: "总体",
		modePrefix: "模式：{mode}",
		all: "全部",
		overallNoFilter: "总体模式无需二次筛选",
		noTopics: "暂无可分析专题",
		noTags: "暂无可分析标签",
		noTopicsShort: "暂无专题",
		noTagsShort: "暂无标签",
		pickTopic: "请选择专题",
		pickTag: "请选择标签",
		pickTopicShort: "选专题",
		pickTagShort: "选标签",
		topicPrefix: "专题：{label}",
		tagPrefix: "标签：#{label}",
	},
	menu: {
		clearTopic: "清空专题选择",
		clearTag: "清空标签选择",
		sourceItem: "{label} · 活跃 {active} · 到期 {due}",
	},
	hints: {
		overallStats: "总体模式会统计所有增量阅读点",
		noTopicsAvailable: "当前没有可用于分析的专题",
		noTagsAvailable: "当前没有可用于分析的手工标签",
		pickTopicFirst: "请选择一个专题后查看图表",
		pickTagFirst: "请选择一个标签后查看图表",
		selectionInvalid: "当前选择已失效，请重新选择",
		selectionSummary:
			"{subtitle} · 共 {items} 项，活跃 {active} 项，到期 {due} 项",
	},
	loading: "正在生成分析图表…",
	loadFailed: "分析数据加载失败",
	scope: {
		summary: "共 {total} 项阅读点，当前活跃 {active} 项",
		allPoints: "当前汇总全部增量阅读点",
	},
	overview: {
		totalItems: "总材料",
		activeItems: "活跃材料",
		dueToday: "今日到期",
		overdueItems: "逾期项",
		readingHours: "阅读小时",
		avgPriority: "平均优先级",
		extracts: "摘录",
		cards: "制卡",
		notes: "笔记",
	},
		charts: {
		totalMaterials: "累计材料",
		activeMaterials: "活跃材料",
		closedMaterials: "已退出主队列",
		effectivePriority: "有效优先级",
		schedulingUrgency: "调度紧迫度",
		itemCount: "材料数",
		minutes: "分钟",
		plannedItems: "计划材料数",
		estimatedMinutes: "预计阅读分钟",
		overload: {
			warning: "负荷偏高",
			overloaded: "负荷过载",
		},
		tooltip: {
			effectivePriority: "有效优先级: {value}",
			schedulingUrgency: "调度紧迫度: {value}",
			counts: "活跃项: {active} / 到期: {due} / 逾期: {overdue}",
			readingHours: "阅读时长: {hours} 小时",
			outcomes: "制卡: {cards} / 摘录: {extracts} / 笔记: {notes}",
			plannedTotal: "计划合计: {count}",
		},
	},
	monitoring:
		"近7天日均已安排 {scheduled} 项 · 日均完成 {completed} 项 · 日均阅读 {minutes} 分钟 · 决策闭环率 {rate}%",
	outcomes: {
		extractsTooltip: "当前沉淀摘录数：{total}\n本期动作摘录：{action}",
		cardsTooltip: "当前沉淀记忆卡数：{total}\n本期动作制卡：{action}",
		notesTooltip: "当前关联 Markdown 笔记数：{total}\n本期动作写笔记：{action}",
		actionPeriod: "本期动作 {count}",
	},
	empty: {
		noTopicData: "当前还没有可分析的专题数据",
		noTagData: "当前还没有可分析的手工标签数据",
		pickTopic: "先选择一个专题，再查看当前图表",
		pickTag: "先选择一个标签，再查看当前图表",
		noData: "当前范围下暂时没有可展示数据",
		noTopicDataDesc: "等增量阅读点和专题建立关联后，这里就会显示对应图表。",
		noTagDataDesc: "等手工标签被用于增量阅读后，这里就会显示对应图表。",
		pickTopicDesc: "先在上方选择一个专题，下方内容区会显示对应的分析图表。",
		pickTagDesc: "先在上方选择一个标签，下方内容区会显示对应的分析图表。",
		tryOtherFilters:
			"可以试试切换时间范围或分析条件，看看是否有可展示的图表数据。",
	},
	materialTypes: {
		md: "Markdown",
		canvas: "Canvas",
		epub: "EPUB",
		pdf: "PDF",
		link: "网页链接",
		other: "其它",
	},
	composition: {
		title: "材料构成",
		byDocuments: "按母文档数",
		byHours: "按阅读时长",
		byPoints: "按阅读点数",
		legendCount: "{label} · {count} ({share}%)",
		legendHours: "{label} · {hours}h ({share}%)",
	},
	outcomeTable: {
		title: "类型产出效率",
		type: "类型",
		readingHours: "阅读时长",
		extracts: "摘录",
		cards: "制卡",
		notes: "笔记",
		outcomesPerHour: "产出/小时",
	},
	topMaterials: {
		title: "重点母文档",
		active: "活跃 {count}",
		extracts: "摘录 {count}",
		cards: "制卡 {count}",
		notes: "笔记 {count}",
	},
};

const enIrAnalytics: TranslationKey = {
	tabs: {
		activity: "Activity trend",
		quantity: "Quantity change",
		timing: "Scheduling timing",
		difficulty: "Priority matrix",
		forecast: "Future load",
	},
	range: {
		last7: "Last 7 days",
		last14: "Last 14 days",
		last30: "Last 30 days",
		last60: "Last 60 days",
		last90: "Last 90 days",
		daysShort: "{days}d",
		daysLabel: "{days} days",
	},
	toolbar: {
		mode: "Analysis mode",
		selection: "Filter",
		timeRange: "Time range",
		pickSelection: "Select",
	},
	modes: {
		topic: "Topic",
		tag: "Tag",
		overall: "Overall",
		modePrefix: "Mode: {mode}",
		all: "All",
		overallNoFilter: "Overall mode needs no secondary filter",
		noTopics: "No analyzable topics",
		noTags: "No analyzable tags",
		noTopicsShort: "No topics",
		noTagsShort: "No tags",
		pickTopic: "Choose a topic",
		pickTag: "Choose a tag",
		pickTopicShort: "Topic",
		pickTagShort: "Tag",
		topicPrefix: "Topic: {label}",
		tagPrefix: "Tag: #{label}",
	},
	menu: {
		clearTopic: "Clear topic selection",
		clearTag: "Clear tag selection",
		sourceItem: "{label} · active {active} · due {due}",
	},
	hints: {
		overallStats: "Overall mode aggregates every incremental reading point",
		noTopicsAvailable: "No topics are available for analysis",
		noTagsAvailable: "No manual tags are available for analysis",
		pickTopicFirst: "Choose a topic to view charts",
		pickTagFirst: "Choose a tag to view charts",
		selectionInvalid: "The current selection is no longer valid. Choose again.",
		selectionSummary:
			"{subtitle} · {items} items total, {active} active, {due} due",
	},
	loading: "Generating analytics charts…",
	loadFailed: "Failed to load analytics data",
	scope: {
		summary: "{total} reading points total, {active} active",
		allPoints: "Summarizing all incremental reading points",
	},
	overview: {
		totalItems: "Total items",
		activeItems: "Active items",
		dueToday: "Due today",
		overdueItems: "Overdue",
		readingHours: "Reading hours",
		avgPriority: "Avg priority",
		extracts: "Extracts",
		cards: "Cards",
		notes: "Notes",
	},
	charts: {
		totalMaterials: "Total materials",
		activeMaterials: "Active materials",
		closedMaterials: "Left main queue",
		effectivePriority: "Effective priority",
		schedulingUrgency: "Scheduling urgency",
		itemCount: "Items",
		minutes: "Minutes",
		plannedItems: "Planned items",
		estimatedMinutes: "Estimated minutes",
		overload: {
			warning: "High load",
			overloaded: "Overloaded",
		},
		tooltip: {
			effectivePriority: "Effective priority: {value}",
			schedulingUrgency: "Scheduling urgency: {value}",
			counts: "Active: {active} / due: {due} / overdue: {overdue}",
			readingHours: "Reading time: {hours} h",
			outcomes: "Cards: {cards} / extracts: {extracts} / notes: {notes}",
			plannedTotal: "Planned total: {count}",
		},
	},
	monitoring:
		"Last 7 days avg scheduled {scheduled}/day · completed {completed}/day · reading {minutes} min/day · linked outcome rate {rate}%",
	outcomes: {
		extractsTooltip:
			"Stored extracts: {total}\nAction extracts this period: {action}",
		cardsTooltip: "Stored cards: {total}\nAction cards this period: {action}",
		notesTooltip:
			"Linked Markdown notes: {total}\nAction notes this period: {action}",
		actionPeriod: "Action this period {count}",
	},
	empty: {
		noTopicData: "No topic data is available for analysis yet",
		noTagData: "No manual tag data is available for analysis yet",
		pickTopic: "Choose a topic first to view the current chart",
		pickTag: "Choose a tag first to view the current chart",
		noData: "No data to display in the current scope",
		noTopicDataDesc:
			"Charts will appear here after reading points are linked to topics.",
		noTagDataDesc:
			"Charts will appear here after manual tags are used in incremental reading.",
		pickTopicDesc: "Choose a topic above and the chart area below will update.",
		pickTagDesc: "Choose a tag above and the chart area below will update.",
		tryOtherFilters:
			"Try switching the time range or filters to see whether chart data is available.",
	},
	materialTypes: {
		md: "Markdown",
		canvas: "Canvas",
		epub: "EPUB",
		pdf: "PDF",
		link: "Web link",
		other: "Other",
	},
	composition: {
		title: "Material composition",
		byDocuments: "By parent documents",
		byHours: "By reading time",
		byPoints: "By reading points",
		legendCount: "{label} · {count} ({share}%)",
		legendHours: "{label} · {hours}h ({share}%)",
	},
	outcomeTable: {
		title: "Type outcome efficiency",
		type: "Type",
		readingHours: "Reading time",
		extracts: "Extracts",
		cards: "Cards",
		notes: "Notes",
		outcomesPerHour: "Outcomes/hour",
	},
	topMaterials: {
		title: "Top parent documents",
		active: "Active {count}",
		extracts: "Extracts {count}",
		cards: "Cards {count}",
		notes: "Notes {count}",
	},
};

const zhIrPriority: TranslationKey = {
	kicker: "阅读节奏",
	title: "优先级",
	closeTitle: "关闭优先级面板",
	closeAria: "关闭优先级面板",
	scaleLow: "轻推进",
	scaleHigh: "更常出现",
	hint: "高优先级内容会更积极地回到你的今日阅读流中。",
	setTitle: "设置优先级",
	setAria: "设置优先级",
	presets: {
		low: {
			label: "低",
			shortHint: "低频出现",
			description: "保留在计划里，但不会主动占用太多今天的阅读注意力。",
		},
		medium: {
			label: "中",
			shortHint: "常规节奏",
			description: "按当前默认节奏安排，是最平衡的推进频率。",
		},
		high: {
			label: "高",
			shortHint: "更积极推进",
			description: "会更频繁回到你的阅读流里，适合当前值得优先推进的内容。",
		},
		urgent: {
			label: "紧急",
			shortHint: "优先处理",
			description: "尽可能优先出现，适合你现在明确不想继续拖延的阅读点。",
		},
	},
};

const enIrPriority: TranslationKey = {
	kicker: "Reading pace",
	title: "Priority",
	closeTitle: "Close priority panel",
	closeAria: "Close priority panel",
	scaleLow: "Light push",
	scaleHigh: "More often",
	hint: "Higher-priority content returns to today's reading flow more actively.",
	setTitle: "Set priority",
	setAria: "Set priority",
	presets: {
		low: {
			label: "Low",
			shortHint: "Infrequent",
			description:
				"Stays in the plan without taking much of today's attention.",
		},
		medium: {
			label: "Medium",
			shortHint: "Regular pace",
			description: "Follows the default rhythm—a balanced push frequency.",
		},
		high: {
			label: "High",
			shortHint: "Push harder",
			description:
				"Returns to your reading flow more often for content worth prioritizing now.",
		},
		urgent: {
			label: "Urgent",
			shortHint: "Handle first",
			description:
				"Surfaces as early as possible for reading points you do not want to delay.",
		},
	},
};

const zhIrSchedulePreview: TranslationKey = {
	kicker: "实时预览",
	afterLabel: "调整后",
	linkedItems: "联动 {count} 项",
	impactedDays: "影响未来 {days} 天",
	linkedPointsTitle: "联动阅读点",
	loadTitle: "负载预览",
	minutesChange: "{before} -> {after} 分钟",
};

const enIrSchedulePreview: TranslationKey = {
	kicker: "Live preview",
	afterLabel: "After change",
	linkedItems: "{count} linked items",
	impactedDays: "Affects next {days} days",
	linkedPointsTitle: "Linked reading points",
	loadTitle: "Load preview",
	minutesChange: "{before} -> {after} min",
};

const zhIrCommands: TranslationKey = {
	openCalendar: "打开增量阅读日历",
	openActiveIrdeck: "打开当前 IRDeck",
	createFromSelection: "从当前选区创建增量阅读点",
	createFromWebPage: "从当前网页添加到增量阅读",
	openParagraphWorkbench: "打开增量阅读段落工作台",
	updateFolderSubscription: "更新订阅文件夹",
	addReadingTarget: "添加阅读目标到增量阅读",
	addReadingTargetFromSelection: "将选中文本添加到增量阅读",
	openTutorial: "打开增量阅读教程",
	defaultDeckName: "默认专题",
	defaultIrName: "增量阅读",
	addToIr: "添加到增量阅读",
	canvasNodeNoContent: "当前节点暂无可用内容",
	noDecksAvailable: "暂无可用增量阅读专题",
	premiumBlockedMessage: "增量阅读是高级功能，请激活许可证后使用",
};

const enIrCommands: TranslationKey = {
	openCalendar: "Open incremental reading calendar",
	openActiveIrdeck: "Open active IRDeck",
	createFromSelection: "Create incremental reading point from selection",
	createFromWebPage: "Add current web page to incremental reading",
	openParagraphWorkbench: "Open incremental reading paragraph workbench",
	updateFolderSubscription: "Update subscribed folders",
	addReadingTarget: "Add reading target to incremental reading",
	addReadingTargetFromSelection: "Add selected text to incremental reading",
	openTutorial: "Open incremental reading tutorial",
	defaultDeckName: "Default topic",
	defaultIrName: "Incremental reading",
	addToIr: "Add to incremental reading",
	canvasNodeNoContent: "This node has no usable content",
	noDecksAvailable: "No incremental reading topics available",
	premiumBlockedMessage:
		"Incremental reading is a premium feature. Activate your license to use it.",
};

const zhIrViews: TranslationKey = {
	calendar: {
		defaultTitle: "增量阅读日历",
		loading: "正在加载日历...",
		loadingFeatureHelp: "正在加载功能说明...",
		loadFailed: "日历加载失败",
	},
	focus: {
		legacyEntrySuffix: "旧入口兼容",
		defaultTitleLegacy: "增量阅读（旧入口兼容）",
		removedTitle: "旧增量阅读主阅读界面已移除",
		redirectWithDeck:
			"正在切换到左侧月历阅读侧边栏，请在那里继续处理「{deckName}」。",
		redirectGeneric:
			"正在切换到左侧月历阅读侧边栏，请在那里继续调度和打开阅读材料。",
	},
	workbench: {
		paragraphSuffix: "段落阅读",
		defaultTitle: "增量阅读段落工作台",
		loading: "正在加载段落阅读工作台...",
		loadFailed: "段落阅读工作台加载失败",
	},
};

const enIrViews: TranslationKey = {
	calendar: {
		defaultTitle: "Incremental reading calendar",
		loading: "Loading calendar...",
		loadingFeatureHelp: "Loading feature information...",
		loadFailed: "Failed to load calendar",
	},
	focus: {
		legacyEntrySuffix: "Legacy Entry",
		defaultTitleLegacy: "Incremental Reading (Legacy Entry)",
		removedTitle: "The legacy incremental reading view has been removed",
		redirectWithDeck:
			'Switching to the left calendar reading sidebar. Continue working on "{deckName}" there.',
		redirectGeneric:
			"Switching to the left calendar reading sidebar. Continue scheduling and opening reading materials there.",
	},
	workbench: {
		paragraphSuffix: "Paragraph reading",
		defaultTitle: "Incremental reading paragraph workbench",
		loading: "Loading paragraph reading workbench...",
		loadFailed: "Failed to load paragraph reading workbench",
	},
};

const zhIrNotices: TranslationKey = {
	openSupportedFileFirst: "请先打开 Markdown、Canvas 或 EPUB 文件",
	noFolderSubscriptionRules: "尚未配置可用的订阅文件夹规则，或所选专题已不存在",
	folderSyncDone:
		"订阅文件夹更新完成：扫描 {scanned} 个 Markdown 文件，新增 {added}，更新 {updated}，跳过 {unchanged}",
	folderSyncAutoAdded: "订阅文件夹已自动同步：新增 {added}",
	sourceFileNotFound: "未找到对应的源文件，无法创建阅读点",
	selectTextFirst: "请先选中文本后再创建阅读点",
	noWebUrl: "未获取到当前网页链接",
	selectWebTextFirst: "请先选中网页文本后再添加",
	openAddModalFailed: "打开添加窗口失败，请重试",
	selectMarkdownTextOrLine:
		"请先在 Markdown 文档中选中文本，或将光标放在有内容的行",
	openCreateModalFailed: "打开阅读点创建窗口失败，请重试",
	enterReadingPointName: "请输入阅读点名称",
	selectIrDeck: "请选择增量阅读专题",
	deckNotFoundOrArchived: "所选专题不存在或已归档",
	addedToDeck: "已添加到增量阅读专题「{deckName}」",
	fileCreatedButJoinFailed:
		"阅读点文件已创建，但加入增量阅读失败，请检查控制台日志",
	addFailed: "添加失败，请重试",
	enterReadingPointTitle: "请输入阅读点标题",
	pointCreatedWithReplace: "阅读点已创建，并已替换源文档选区",
	pointCreatedWithoutReplace: "阅读点已创建，但未能自动替换源文档选区",
	pointCreated: "阅读点已创建",
	createPointFailed: "创建阅读点失败，请重试",
};

const enIrNotices: TranslationKey = {
	openSupportedFileFirst: "Open a Markdown, Canvas, or EPUB file first",
	noFolderSubscriptionRules:
		"No active folder subscription rules are configured, or the selected topic no longer exists",
	folderSyncDone:
		"Folder subscription sync finished: scanned {scanned} Markdown files, added {added}, updated {updated}, skipped {unchanged}",
	folderSyncAutoAdded: "Folder subscription auto-synced: {added} added",
	sourceFileNotFound: "Source file not found; cannot create reading point",
	selectTextFirst: "Select text before creating a reading point",
	noWebUrl: "Could not get the current web page URL",
	selectWebTextFirst: "Select text on the web page before adding",
	openAddModalFailed: "Failed to open the add dialog. Please try again.",
	selectMarkdownTextOrLine:
		"Select text in the Markdown document first, or place the cursor on a line with content",
	openCreateModalFailed:
		"Failed to open the reading point creation dialog. Please try again.",
	enterReadingPointName: "Enter a reading point name",
	selectIrDeck: "Select an incremental reading topic",
	deckNotFoundOrArchived: "The selected topic does not exist or is archived",
	addedToDeck: 'Added to incremental reading topic "{deckName}"',
	fileCreatedButJoinFailed:
		"The reading point file was created, but adding it to incremental reading failed. Check the console log.",
	addFailed: "Add failed. Please try again.",
	enterReadingPointTitle: "Enter a reading point title",
	pointCreatedWithReplace:
		"Reading point created and source selection replaced",
	pointCreatedWithoutReplace:
		"Reading point created, but the source selection could not be replaced automatically",
	pointCreated: "Reading point created",
	createPointFailed: "Failed to create reading point. Please try again.",
};

const zhIrMain: TranslationKey = {
	dialog: {
		confirm: "确认",
		cancel: "取消",
		delete: "删除",
		deleteTitle: "确认删除",
		deleteMessage: '确定要删除 "{itemName}" 吗？',
		warning: "警告",
		chooseTitle: "请选择",
		inputTitle: "输入",
	},
	confirm: {
		folderSubscriptionBatchTitle: "确认批量新增阅读材料",
		folderSubscriptionBatchConfirm: "确认新增",
		folderSubscriptionBatchSingleRule:
			"检测到订阅文件夹中有 {pendingCount} 个待新增阅读材料，超过当前阈值 {threshold}。\n文件夹：{folderPath}\n专题：{deckName}\n\n确认后再批量新增。",
		folderSubscriptionBatchMultipleRules:
			"检测到 {ruleCount} 条订阅规则下共有 {pendingCount} 个待新增阅读材料，超过当前阈值 {threshold}。\n\n确认后再批量新增。",
	},
	defaults: {
		webReadingPointTitle: "网页阅读点",
		unnamedReadingPoint: "未命名阅读点",
		readingPointFilePrefix: "阅读点",
	},
	epubReader: {
		displayName: "Weave EPUB 阅读器",
		unavailableFailed:
			"{displayName}（{pluginId}）已在社区插件中启用，但当前未能成功加载。请打开开发者控制台查看报错，或在社区插件列表中关闭后重新启用该插件。",
		unavailableDisabled:
			"{displayName}（{pluginId}）已安装但未启用。请在 Obsidian 设置 → 社区插件中启用。",
		unavailableMissing:
			"未检测到 {displayName}（{pluginId}）。请在 Obsidian 设置 → 社区插件中安装并启用。",
		unavailableOutdated:
			"已检测到 {displayName}（{pluginId}），但当前版本缺少导入目录所需的接口。请更新阅读器插件到最新版本后重试。",
	},
};

const enIrMain: TranslationKey = {
	dialog: {
		confirm: "Confirm",
		cancel: "Cancel",
		delete: "Delete",
		deleteTitle: "Confirm deletion",
		deleteMessage: 'Delete "{itemName}"?',
		warning: "Warning",
		chooseTitle: "Choose an option",
		inputTitle: "Input",
	},
	confirm: {
		folderSubscriptionBatchTitle: "Confirm batch import of reading materials",
		folderSubscriptionBatchConfirm: "Confirm import",
		folderSubscriptionBatchSingleRule:
			"Found {pendingCount} new reading materials in a subscribed folder, above the threshold of {threshold}.\nFolder: {folderPath}\nTopic: {deckName}\n\nConfirm before importing in bulk.",
		folderSubscriptionBatchMultipleRules:
			"Found {pendingCount} new reading materials across {ruleCount} subscription rules, above the threshold of {threshold}.\n\nConfirm before importing in bulk.",
	},
	defaults: {
		webReadingPointTitle: "Web reading point",
		unnamedReadingPoint: "Untitled reading point",
		readingPointFilePrefix: "Reading point",
	},
	epubReader: {
		displayName: "Weave EPUB Reader",
		unavailableFailed:
			"{displayName} ({pluginId}) is enabled in Community plugins but failed to load. Check the developer console for errors, or disable and re-enable the plugin.",
		unavailableDisabled:
			"{displayName} ({pluginId}) is installed but disabled. Enable it under Settings → Community plugins.",
		unavailableMissing:
			"{displayName} ({pluginId}) was not found. Install and enable it under Settings → Community plugins.",
		unavailableOutdated:
			"{displayName} ({pluginId}) is installed, but this version is missing the catalog import API. Update the EPUB reader plugin and try again.",
	},
};

const zhIrModals: TranslationKey = {
	common: {
		cancel: "取消",
		save: "保存",
		close: "关闭",
		create: "创建",
		discardChangesTitle: "放弃更改",
		discardChangesMessage: "有未保存的更改，确定要关闭吗？",
		continueEditing: "继续编辑",
		title: "标题",
		topic: "专题",
		topicLabel: "专题：{name}",
		selectTopic: "选择增量阅读专题",
		noTopicsYet: "暂无专题，请先新建",
		saveTo: "保存到：{path}",
		vaultRoot: "库根目录",
		createSuffix: "{path}（创建）",
		adding: "添加中...",
		creating: "创建中...",
	},
	readingPointTags: {
		title: "编辑标签",
		intro:
			"输入标签后按回车添加，或直接点保存也会添加当前输入。点击 × 移除；可从建议列表选择。",
		tagsUpdated: "标签已更新",
	},
	readingPointRename: {
		title: "重命名",
		duplicateTitle: "同专题已有同名阅读点：{title}",
		emptyTitle: "标题不能为空",
		renamed: "已重命名",
	},
	readingPointTraceLink: {
		title: "编辑溯源链接",
		fixLinkFirst: "请先修正定位链接",
		linkUpdated: "溯源链接已更新",
	},
	deckSelector: {
		placeholder: "搜索增量阅读专题...",
		instructions: {
			navigate: "导航",
			select: "选择",
			close: "关闭",
		},
	},
	vaultFileSuggest: {
		emptySelectionLabel: "清空当前选择",
		emptySelectionDescription: "不使用文件",
		placeholder: "选择文件...",
	},
	pointSuggest: {
		placeholder: "搜索并选择父阅读点...",
		clearLabel: "清除父阅读点",
		clearDescription: "该阅读点不再挂在任何父阅读点下",
		clearDescriptionWithCurrent: "当前父阅读点：{title}",
	},
	vaultFolderSuggest: {
		placeholder: "选择保存文件夹...",
		vaultRoot: "/（Vault 根目录）",
	},
	paragraphAddToTopic: {
		title: "添加到增量阅读",
		deckName: "所属专题",
		deckDesc: "选择已有专题，或新建一个专题后再添加当前内容块。",
		deckDescFixed: "当前内容块将加入文档已绑定的专题。",
		newTopic: "新建专题",
		titleDetected: "已从当前段落中自动提取标题，你可以继续修改。",
		titleFallback: "未检测到明确标题，已先用段落前缀生成标题。",
		titlePlaceholder: "输入阅读点标题",
		submit: "添加到增量阅读",
		newTopicPlaceholder: "输入新专题名称",
	},
	selectionToIr: {
		title: "从选区创建增量阅读点",
		deckName: "所属专题",
		deckDesc: "点击下拉菜单选择增量阅读专题。",
		savePath: "保存路径",
		savePathDesc:
			"默认遵循上次选择或 Obsidian 的新建笔记位置，也可以切换到其他文件夹。",
		titleDetected: "已从选中文本中自动提取标题，你可以继续修改。",
		titleFallback: "未检测到明确标题，已先用选中文本前缀生成标题。",
		titlePlaceholder: "输入阅读点标题",
		createReadingPoint: "创建阅读点",
		folderPickerPlaceholder: "选择阅读点保存路径...",
	},
	folderSubscriptionSyncResult: {
		title: "订阅文件夹更新结果",
		scanSummary:
			"本次扫描 {scanned} 个 Markdown 文件，启用 {rules} 条订阅规则，命中 {matched} 个候选文件。",
		applySummary: "新增 {added}，更新 {updated}，已存在跳过 {unchanged}。",
		sectionAdded: "本次新增到增量阅读",
		sectionUpdated: "本次已更新的已有材料",
		sectionUnchanged: "已存在且未变更",
		rulesHeading: "规则命中情况",
		ruleDesc: "专题：{deckName} | 命中 {matched} | 待新增 {pending}",
		none: "无",
		moreFiles: "其余 {count} 个文件未展开显示。",
	},
};

const enIrModals: TranslationKey = {
	common: {
		cancel: "Cancel",
		save: "Save",
		close: "Close",
		create: "Create",
		discardChangesTitle: "Discard changes",
		discardChangesMessage: "You have unsaved changes. Close anyway?",
		continueEditing: "Continue editing",
		title: "Title",
		topic: "Topic",
		topicLabel: "Topic: {name}",
		selectTopic: "Select incremental reading topic",
		noTopicsYet: "No topics yet. Create one first.",
		saveTo: "Save to: {path}",
		vaultRoot: "Vault root",
		createSuffix: "{path} (create)",
		adding: "Adding...",
		creating: "Creating...",
	},
	readingPointTags: {
		title: "Edit tags",
		intro:
			"Type a tag and press Enter to add, or click Save to add the current input. Click × to remove; pick from suggestions.",
		tagsUpdated: "Tags updated",
	},
	readingPointRename: {
		title: "Rename",
		duplicateTitle:
			"A reading point with this title already exists in this topic: {title}",
		emptyTitle: "Title cannot be empty",
		renamed: "Renamed",
	},
	readingPointTraceLink: {
		title: "Edit trace link",
		fixLinkFirst: "Fix the location link first",
		linkUpdated: "Trace link updated",
	},
	deckSelector: {
		placeholder: "Search incremental reading topics...",
		instructions: {
			navigate: "Navigate",
			select: "Select",
			close: "Close",
		},
	},
	vaultFileSuggest: {
		emptySelectionLabel: "Clear current selection",
		emptySelectionDescription: "No file",
		placeholder: "Select file...",
	},
	pointSuggest: {
		placeholder: "Search and select a parent reading point...",
		clearLabel: "Clear parent reading point",
		clearDescription: "This reading point will not belong to any parent",
		clearDescriptionWithCurrent: "Current parent: {title}",
	},
	vaultFolderSuggest: {
		placeholder: "Select save folder...",
		vaultRoot: "/ (Vault root)",
	},
	paragraphAddToTopic: {
		title: "Add to incremental reading",
		deckName: "Topic",
		deckDesc:
			"Select an existing topic or create a new one before adding this block.",
		deckDescFixed:
			"This content block will be added to the document's bound topic.",
		newTopic: "New topic",
		titleDetected: "Title auto-extracted from the paragraph. You can edit it.",
		titleFallback: "No clear title detected. Using paragraph prefix as title.",
		titlePlaceholder: "Enter reading point title",
		submit: "Add to incremental reading",
		newTopicPlaceholder: "Enter new topic name",
	},
	selectionToIr: {
		title: "Create incremental reading point from selection",
		deckName: "Topic",
		deckDesc: "Click to select an incremental reading topic.",
		savePath: "Save path",
		savePathDesc:
			"Defaults to your last choice or Obsidian's new-note location. You can switch folders.",
		titleDetected: "Title auto-extracted from selected text. You can edit it.",
		titleFallback: "No clear title. Using selected text prefix as title.",
		titlePlaceholder: "Enter reading point title",
		createReadingPoint: "Create reading point",
		folderPickerPlaceholder: "Select reading point save folder...",
	},
	folderSubscriptionSyncResult: {
		title: "Subscription folder sync results",
		scanSummary:
			"Scanned {scanned} Markdown files, {rules} active subscription rules, matched {matched} candidate files.",
		applySummary:
			"Added {added}, updated {updated}, skipped {unchanged} existing.",
		sectionAdded: "Newly added to incremental reading",
		sectionUpdated: "Updated existing materials",
		sectionUnchanged: "Unchanged existing",
		rulesHeading: "Rule matches",
		ruleDesc: "Topic: {deckName} | Matched {matched} | Pending {pending}",
		none: "None",
		moreFiles: "{count} more files not shown.",
	},
};

const zhIrImport: TranslationKey = {
	title: {
		importMaterials: "导入阅读材料",
		selectOutlineItems: "选择目录项",
		selectSplitMode: "选择拆分方式",
		configureSplitRules: "配置拆分规则",
		confirmPdfImport: "确认导入 PDF 材料",
		confirmEpubImport: "确认导入 EPUB 材料",
		previewSplitResults: "预览拆分结果",
	},
	steps: {
		select: "选择",
		outline: "目录",
		split: "拆分",
		confirm: "确认",
	},
	search: {
		placeholder: "搜索文件...",
	},
	selection: {
		selectedFiles: "已选择 {count} 个文件",
	},
	empty: {
		noMatch: "未找到匹配的文件",
		noMatchHint: "请尝试其他关键词",
		noFiles: "没有可导入的文件",
		noFilesHint: "Vault 中没有 Markdown / PDF / EPUB 文件",
	},
	progress: {
		parsingPdfOutline: "正在解析 PDF 目录...",
		parsingEpubOutline: "正在解析 EPUB 目录...",
		importing: "正在导入 {current}/{total}",
	},
	buttons: {
		nextWithCount: "下一步 ({count})",
		next: "下一步",
		back: "上一步",
		confirmImport: "确认导入",
		importing: "导入中...",
		parse: "解析",
	},
	outline: {
		pdfSelection: "PDF 目录选择",
		epubSelection: "EPUB 目录选择",
		bookmark: "书签",
		chapter: "章节",
		countBadge: "{count} 个{unit}",
		parsingPdf: "正在解析 PDF 目录...",
		parsingEpub: "正在解析 EPUB 目录...",
		noOutlinePdf: "未获取到 PDF 目录",
		noOutlineEpub: "未获取到 EPUB 目录",
		noOutlinePdfHint: "该 PDF 可能没有嵌入目录信息",
		noOutlineEpubHint: "该 EPUB 可能没有嵌入目录信息",
		selectLevel: "请至少选择一个目录层级",
		selectLevelHint: "勾选上方层级按钮后再选择要导入的章节",
		levelLabel: "层级:",
		selectAll: "全选",
		selectNone: "全不选",
		selectedCount: "{selected}/{visible} 已选",
	},
	configure: {
		sectionTitle: "配置拆分规则",
		wholeFile: "整个文件作为一个块",
		wholeFileHint: "每个文件将作为一个完整的内容块，不进行拆分",
		headingSplit: "按标题拆分",
		headingLevels: "标题级别:",
		blankLineSplit: "按空行拆分",
		blankLineCount: "连续空行数:",
		symbolSplit: "按符号拆分",
		splitSymbol: "分隔符:",
		splitSymbolPlaceholder: "例如: ---",
		filterEmpty: "过滤空内容块",
		preserveHeading: "保留标题作为内容块标题",
		minCharCount: "最小字符数:",
	},
	preview: {
		pdfOutline: "PDF 目录预览",
		epubChapters: "EPUB 章节预览",
		bookmarkCount: "{count} 个书签",
		chapterCount: "{count} 个章节",
		noPdfOutline: "未获取到 PDF 目录",
		noPdfOutlineHint: "该 PDF 可能没有嵌入目录信息",
		totalBlocks: "共 {count} 个内容块",
		charCount: "{count} 字",
		defaultPdfTitle: "PDF",
		defaultEpubTitle: "EPUB",
	},
	scheduling: {
		distributeTo: "分散到:",
		customDaysPlaceholder: "天数",
		firstImport: "首次导入:",
		viewDetailsTitle: "查看分散详情",
		overloadedDays: "超载天数:",
		peakLoad: "峰值负载:",
		calculating: "正在计算分散影响...",
		custom: "自定义",
		daysSuffix: "{count}天",
		strategies: {
			even: "均分",
			balanced: "均衡",
			frontLoaded: "尽快",
		},
		ordering: {
			preserveSourceOrder: "正序分散",
			pureScheduling: "按调度排序",
		},
		presets: {
			week: "一周",
			twoWeeks: "两周",
			month: "一个月",
		},
	},
	deck: {
		label: "专题:",
		selectDeck: "选择专题",
		newDeck: "新建专题",
		namePlaceholder: "输入专题名称...",
	},
	importMode: {
		label: "导入方式:",
		reference: "直接引用原文件",
		copy: "生成副本并导入",
	},
	mdPath: {
		label: "MD 路径:",
		folderPickerPlaceholder: "选择 MD 拆分文件导入路径...",
		vaultRoot: "/（Vault 根目录）",
	},
	sourceBacklink: {
		name: "添加完整源文档溯源双链",
		desc: "启用后，在拆分生成的 Markdown 文件末尾追加指向原始完整源文档的双链。",
		linkLabel: "溯源完整源文档",
	},
	tagGroup: {
		default: "默认",
	},
	notices: {
		mixedImportNotSupported:
			"暂不支持混合导入（请分别导入 Markdown、PDF 或 EPUB）",
		parsePdfOutlineFailed: "解析 PDF 目录失败: {message}",
		importFailed: "导入失败: {message}",
		importFailedWithFile: "导入失败: {file} - {message}",
		selectAtLeastOne: "请至少选择一个{unit}",
		epubImportComplete:
			"EPUB 导入完成: {success} 个任务创建, {skipped} 个已跳过",
		importCompleteMd: "导入完成: {count} 个 Markdown 文档已接入增量阅读",
		legacyBlockImportDisabled:
			"旧文件化块导入已停用：PDF/EPUB 等文件不再拆成 raw/index/chunk，请改用正文阅读点或等待新模型重做。",
		batchImportFailedCount: "{count} 个文件导入失败",
		importFailedGeneric: "导入失败",
		unknownError: "未知错误",
	},
	errors: {
		noDeckSelected: "未选择专题",
		materialServiceNotInit: "增量阅读材料服务尚未初始化",
		storageServiceNotInit: "增量阅读存储服务尚未初始化",
		noSplitContent: "没有可导入的拆分内容",
		tagGroupInitFailed: "[MaterialImportModal] IRTagGroupService 初始化失败",
		noDeckForLoadInfo: "[MaterialImportModal] 未选择专题，无法生成导入负载信息",
	},
};

const enIrImport: TranslationKey = {
	title: {
		importMaterials: "Import reading materials",
		selectOutlineItems: "Select outline items",
		selectSplitMode: "Choose split method",
		configureSplitRules: "Configure split rules",
		confirmPdfImport: "Confirm PDF import",
		confirmEpubImport: "Confirm EPUB import",
		previewSplitResults: "Preview split results",
	},
	steps: {
		select: "Select",
		outline: "Outline",
		split: "Split",
		confirm: "Confirm",
	},
	search: {
		placeholder: "Search files...",
	},
	selection: {
		selectedFiles: "{count} file(s) selected",
	},
	empty: {
		noMatch: "No matching files",
		noMatchHint: "Try different keywords",
		noFiles: "No files to import",
		noFilesHint: "No Markdown / PDF / EPUB files in the vault",
	},
	progress: {
		parsingPdfOutline: "Parsing PDF outline...",
		parsingEpubOutline: "Parsing EPUB outline...",
		importing: "Importing {current}/{total}",
	},
	buttons: {
		nextWithCount: "Next ({count})",
		next: "Next",
		back: "Back",
		confirmImport: "Confirm import",
		importing: "Importing...",
		parse: "Parse",
	},
	outline: {
		pdfSelection: "PDF outline selection",
		epubSelection: "EPUB outline selection",
		bookmark: "bookmark",
		chapter: "chapter",
		countBadge: "{count} {unit}(s)",
		parsingPdf: "Parsing PDF outline...",
		parsingEpub: "Parsing EPUB outline...",
		noOutlinePdf: "No PDF outline found",
		noOutlineEpub: "No EPUB outline found",
		noOutlinePdfHint: "This PDF may not have an embedded outline",
		noOutlineEpubHint: "This EPUB may not have an embedded table of contents",
		selectLevel: "Select at least one outline level",
		selectLevelHint: "Check a level above, then choose chapters to import",
		levelLabel: "Level:",
		selectAll: "Select all",
		selectNone: "Select none",
		selectedCount: "{selected}/{visible} selected",
	},
	configure: {
		sectionTitle: "Configure split rules",
		wholeFile: "Treat whole file as one block",
		wholeFileHint: "Each file becomes one block with no splitting",
		headingSplit: "Split by headings",
		headingLevels: "Heading levels:",
		blankLineSplit: "Split by blank lines",
		blankLineCount: "Consecutive blank lines:",
		symbolSplit: "Split by symbol",
		splitSymbol: "Delimiter:",
		splitSymbolPlaceholder: "e.g. ---",
		filterEmpty: "Filter empty blocks",
		preserveHeading: "Keep heading as block title",
		minCharCount: "Minimum characters:",
	},
	preview: {
		pdfOutline: "PDF outline preview",
		epubChapters: "EPUB chapter preview",
		bookmarkCount: "{count} bookmark(s)",
		chapterCount: "{count} chapter(s)",
		noPdfOutline: "No PDF outline found",
		noPdfOutlineHint: "This PDF may not have an embedded outline",
		totalBlocks: "{count} content block(s) total",
		charCount: "{count} chars",
		defaultPdfTitle: "PDF",
		defaultEpubTitle: "EPUB",
	},
	scheduling: {
		distributeTo: "Spread over:",
		customDaysPlaceholder: "Days",
		firstImport: "First import:",
		viewDetailsTitle: "View spread details",
		overloadedDays: "Overloaded days:",
		peakLoad: "Peak load:",
		calculating: "Calculating spread impact...",
		custom: "Custom",
		daysSuffix: "{count} days",
		strategies: {
			even: "Even",
			balanced: "Balanced",
			frontLoaded: "Front-loaded",
		},
		ordering: {
			preserveSourceOrder: "Source order spread",
			pureScheduling: "Sort by schedule",
		},
		presets: {
			week: "One week",
			twoWeeks: "Two weeks",
			month: "One month",
		},
	},
	deck: {
		label: "Topic:",
		selectDeck: "Select topic",
		newDeck: "New topic",
		namePlaceholder: "Enter topic name...",
	},
	importMode: {
		label: "Import mode:",
		reference: "Reference original file",
		copy: "Create copy and import",
	},
	mdPath: {
		label: "MD path:",
		folderPickerPlaceholder: "Choose folder for split MD imports...",
		vaultRoot: "/ (Vault root)",
	},
	sourceBacklink: {
		name: "Append full-source trace wikilink",
		desc: "When enabled, append a wikilink to the original full source at the end of each split Markdown file.",
		linkLabel: "Trace full source document",
	},
	tagGroup: {
		default: "Default",
	},
	notices: {
		mixedImportNotSupported:
			"Mixed imports are not supported. Import Markdown, PDF, or EPUB separately.",
		parsePdfOutlineFailed: "Failed to parse PDF outline: {message}",
		importFailed: "Import failed: {message}",
		importFailedWithFile: "Import failed: {file} - {message}",
		selectAtLeastOne: "Select at least one {unit}",
		epubImportComplete:
			"EPUB import done: {success} task(s) created, {skipped} skipped",
		importCompleteMd:
			"Import complete: {count} Markdown document(s) added to incremental reading",
		legacyBlockImportDisabled:
			"Legacy file-based block import is disabled. PDF/EPUB files are no longer split into raw/index/chunk. Use body reading points or wait for the new model.",
		batchImportFailedCount: "{count} file(s) failed to import",
		importFailedGeneric: "Import failed",
		unknownError: "Unknown error",
	},
	errors: {
		noDeckSelected: "No topic selected",
		materialServiceNotInit:
			"Incremental reading material service is not initialized",
		storageServiceNotInit:
			"Incremental reading storage service is not initialized",
		noSplitContent: "No split content to import",
		tagGroupInitFailed:
			"[MaterialImportModal] IRTagGroupService failed to initialize",
		noDeckForLoadInfo:
			"[MaterialImportModal] No topic selected; cannot build import load info",
	},
};

const zhIrAddTarget: TranslationKey = {
	title: "添加到增量阅读",
	previewFallback: "预览",
	panels: {
		linkOrReference: "链接或引用",
		locationPreview: "定位预览",
		readingPointName: "阅读点名称",
		topic: "所属专题",
		parentReadingPoint: "父阅读点",
		firstReadDay: "首次阅读日",
	},
	actions: {
		currentLocation: "当前位置",
		currentLocationTitle: "添加当前位置",
		cancel: "取消",
		confirmAdd: "确认添加",
		adding: "添加中…",
		pickParent: "选择父阅读点",
		changeParent: "更换父阅读点",
		clearParent: "清除",
	},
	placeholders: {
		linkInput:
			"粘贴 https://…、[[笔记#^块ID]]、EPUB/PDF++/Canvas 链接或 ![[笔记#^块ID|标题]]",
		titleInput: "用于月历与队列显示",
		parentNone: "无（顶层阅读点）",
	},
	hints: {
		supportedFormats:
			"支持网页 URL、Obsidian 双链/块引用、EPUB 定位、PDF++ 与 Canvas 节点。",
		titleDetected: "已从链接或上下文推断标题，可继续修改。",
		titleConfirm: "请确认阅读点名称。",
		topicIntro: "选择该阅读点要加入的增量阅读专题。",
		parentIntro: "可选：挂到已有父阅读点下，便于按文档拆分与统计完成度。",
		scheduleExplainer: "只安排第一次何时读；读完后由算法自动排下次复习。",
		customDayLoad: "已排 {itemCount} 项 · 约 {minutes} 分钟",
		scheduleLoading: "正在计算推荐日期…",
		scheduleFallback: "未能计算推荐日期，请改选「我选日期」。",
	},
	meta: {
		pdfBatchCount: "{count} 个 PDF 阅读点",
	},
	schedule: {
		modeAriaLabel: "首次阅读排期方式",
		customDate: "我选日期",
		autoRecommend: "系统推荐",
		pickDateTitle: "选择首次阅读日",
		dateAriaLabel: "首次阅读日",
	},
	scheduleSummaries: {
		todayNormal:
			"今天负载适中，加入后约 {loadRatioPercent}% 日预算（{projectedMinutes}/{dailyBudgetMinutes} 分钟），适合排入今天。",
		futureNormal:
			"未来 {offset} 天内负载最轻的一天，加入后约 {loadRatioPercent}% 日预算。",
		warning:
			"近期日程较满，推荐相对较轻的一天；加入后约 {loadRatioPercent}% 日预算。",
		overloaded:
			"近期负载偏高，已选择未来 {offset} 天内相对最轻的一天；加入后约 {loadRatioPercent}% 日预算。",
	},
	options: {
		createNote: "创建阅读笔记（默认仅加入队列，不复制正文）",
		appendBacklink: "在源笔记末尾追加增量阅读标记",
	},
	deck: {
		label: "专题：{name}",
		selectTopic: "选择增量阅读专题",
		createTopicMenu: "新建专题…",
		createTopicTitle: "新建专题",
		nameLabel: "专题名称",
		namePlaceholder: "输入专题名称",
		emptyName: "专题名称不能为空",
		createFailed: "创建专题失败",
	},
	notices: {
		needMarkdownCursor: "请先在 Markdown 笔记中将光标放在目标段落",
		added: "已添加 {count} 项到专题「{deckName}」",
		updated: "已更新排期并加入专题「{deckName}」",
		topicCreated: "已创建专题「{name}」",
		epubUnresolved:
			"无法解析 EPUB 来源，请确认 weave-epub-reader 已启用且书籍仍在库中",
		epubMissingCfi: "EPUB 链接缺少 cfi 定位信息",
		epubInvalid: "EPUB 链接无效，请检查定位参数",
		missingTitle: "请填写阅读点名称",
		missingDeck: "请选择增量阅读专题",
		deckMissing: "所选专题不存在或已归档",
		canvasInvalid: "Canvas 链接无效，请包含节点 ID",
		missingSource: "无法识别源文件路径",
		schedulePinFailed: "阅读点已创建，但未能写入首次阅读日，请重试或手动调整排期",
		pdfBatchFailed: "PDF 批量添加失败，已回滚本次已创建的阅读点",
		invalidFolder: "笔记保存目录无效（路径上存在同名文件）",
		addFailed: "添加失败，请检查链接与专题设置",
	},
	parser: {
		emptyInput: "请输入或粘贴链接",
		epubFileNotFound: "未找到 EPUB 文件：{filePath}",
		epubMissingFileOrSid: "EPUB 链接缺少有效的 file 或 sid 参数",
		blockRefNotFound: "未在「{filePath}」中找到块引用 ^{blockId}",
		pdfParseFailed: "未能解析 PDF++ 链接",
		unknownFormat:
			"无法识别链接格式，请粘贴网页 URL、Obsidian 双链/块引用，或 EPUB/PDF++/Canvas 定位链接",
		fileNotFound: "未找到文件：{filePath}",
		epubCfiRequired:
			"请粘贴 EPUB 阅读器的完整定位链接（含 cfi），例如 [章节名](obsidian://weave-epub-reader?file=...&cfi=...)",
		canvasNodeRequired: "请粘贴指向具体 Canvas 节点的链接（含 #^节点ID）",
	},
	kindLabels: {
		web: "网页链接",
		vaultBlock: "Vault 块引用",
		vaultLink: "标题锚点",
		vaultFile: "Vault 文件",
		pdf: "PDF 定位",
		pdfBatch: "PDF++ 批量链接",
		epub: "EPUB 阅读定位",
		canvas: "Canvas 节点",
		unknown: "未知类型",
		readingPoint: "阅读点",
	},
};

const enIrAddTarget: TranslationKey = {
	title: "Add to incremental reading",
	previewFallback: "Preview",
	panels: {
		linkOrReference: "Link or reference",
		locationPreview: "Location preview",
		readingPointName: "Reading point name",
		topic: "Topic",
		parentReadingPoint: "Parent reading point",
		firstReadDay: "First read day",
	},
	actions: {
		currentLocation: "Current location",
		currentLocationTitle: "Use current location",
		cancel: "Cancel",
		confirmAdd: "Confirm add",
		adding: "Adding…",
		pickParent: "Select parent",
		changeParent: "Change parent",
		clearParent: "Clear",
	},
	placeholders: {
		linkInput:
			"Paste https://…, [[note#^blockId]], EPUB/PDF++/Canvas links, or ![[note#^blockId|title]]",
		titleInput: "Shown in calendar and queue",
		parentNone: "None (top-level reading point)",
	},
	hints: {
		supportedFormats:
			"Supports web URLs, Obsidian wikilinks/block refs, EPUB locations, PDF++, and Canvas nodes.",
		titleDetected: "Title inferred from link or context. You can edit it.",
		titleConfirm: "Confirm the reading point name.",
		topicIntro: "Choose the incremental reading topic for this reading point.",
		parentIntro:
			"Optional: attach under an existing parent for document splits and progress.",
		scheduleExplainer:
			"Schedules only the first read; the algorithm plans later reviews after you finish.",
		customDayLoad: "{itemCount} item(s) scheduled · ~{minutes} min",
		scheduleLoading: "Calculating recommended date…",
		scheduleFallback:
			"Could not compute a recommendation. Switch to “Pick date”.",
	},
	meta: {
		pdfBatchCount: "{count} PDF reading point(s)",
	},
	schedule: {
		modeAriaLabel: "First-read scheduling mode",
		customDate: "Pick date",
		autoRecommend: "Recommended",
		pickDateTitle: "Pick first read day",
		dateAriaLabel: "First read day",
	},
	scheduleSummaries: {
		todayNormal:
			"Today’s load is moderate — about {loadRatioPercent}% of the daily budget after adding ({projectedMinutes}/{dailyBudgetMinutes} min). Good for today.",
		futureNormal:
			"Lightest day within the next {offset} day(s); about {loadRatioPercent}% of the daily budget after adding.",
		warning:
			"Upcoming days are busy; recommending a lighter day — about {loadRatioPercent}% of the daily budget after adding.",
		overloaded:
			"Load is high; chose the lightest day within {offset} day(s) — about {loadRatioPercent}% of the daily budget after adding.",
	},
	options: {
		createNote: "Create reading note (default: queue only, no body copy)",
		appendBacklink: "Append incremental reading marker at end of source note",
	},
	deck: {
		label: "Topic: {name}",
		selectTopic: "Select incremental reading topic",
		createTopicMenu: "New topic…",
		createTopicTitle: "New topic",
		nameLabel: "Topic name",
		namePlaceholder: "Enter topic name",
		emptyName: "Topic name cannot be empty",
		createFailed: "Failed to create topic",
	},
	notices: {
		needMarkdownCursor:
			"Place the cursor on the target paragraph in a Markdown note first",
		added: "Added {count} item(s) to topic “{deckName}”",
		updated: "Updated schedule and added to topic “{deckName}”",
		topicCreated: "Created topic “{name}”",
		epubUnresolved:
			"Could not resolve EPUB source. Ensure weave-epub-reader is enabled and the book is in the vault.",
		epubMissingCfi: "EPUB link is missing cfi location data",
		epubInvalid: "EPUB link is invalid. Check the location parameters.",
		missingTitle: "Enter a reading point name",
		missingDeck: "Select an incremental reading topic",
		deckMissing: "The selected topic is missing or archived",
		canvasInvalid: "Canvas link is invalid. Include a node ID.",
		missingSource: "Could not resolve the source file path",
		schedulePinFailed:
			"Reading point was created, but the first-read date could not be saved. Retry or adjust the schedule manually.",
		pdfBatchFailed:
			"PDF batch add failed. Points created in this attempt were rolled back.",
		invalidFolder:
			"Note folder path is invalid (a file exists where a folder is expected).",
		addFailed: "Add failed. Check the link and topic settings.",
	},
	parser: {
		emptyInput: "Enter or paste a link",
		epubFileNotFound: "EPUB file not found: {filePath}",
		epubMissingFileOrSid: "EPUB link is missing a valid file or sid parameter",
		blockRefNotFound:
			"Block reference ^{blockId} was not found in “{filePath}”",
		pdfParseFailed: "Could not parse PDF++ link",
		unknownFormat:
			"Unrecognized link format. Paste a web URL, Obsidian wikilink/block ref, or EPUB/PDF++/Canvas location.",
		fileNotFound: "File not found: {filePath}",
		epubCfiRequired:
			"Paste the full EPUB reader location link (with cfi), e.g. [Chapter](obsidian://weave-epub-reader?file=...&cfi=...)",
		canvasNodeRequired:
			"Paste a Canvas node link that includes #^nodeId",
	},
	kindLabels: {
		web: "Web link",
		vaultBlock: "Vault block reference",
		vaultLink: "Heading anchor",
		vaultFile: "Vault file",
		pdf: "PDF location",
		pdfBatch: "PDF++ batch links",
		epub: "EPUB location",
		canvas: "Canvas node",
		unknown: "Unknown type",
		readingPoint: "Reading point",
	},
};

const zhIrAddReadingPoint: TranslationKey = {
	title: "新增阅读点",
	closeAriaLabel: "关闭",
	hint: "粘贴 PDF++ 选区链接（支持多条，用空行分隔）",
	placeholder:
		"> [!PDF|] [[file.pdf#page=1&selection=...|display]]\n> > 标题文本\n\n> [!PDF|] [[file.pdf#page=2&selection=...|display]]\n> > 另一个标题",
	parsedCount: "已解析 {count} 个阅读点",
	rePaste: "重新粘贴",
	actions: {
		decreaseLevel: "减少层级",
		increaseLevel: "增加层级",
		moveUp: "上移",
		moveDown: "下移",
		remove: "删除",
		cancel: "取消",
		parse: "解析",
		confirmCreate: "确认创建 ({count})",
		creating: "创建中...",
	},
	notices: {
		pasteRequired: "请粘贴 PDF++ 链接文本",
		parseFailed: "未能解析出有效的 PDF++ 链接",
		created: "已创建 {count} 个阅读点",
		createFailed: "创建失败: {message}",
		unknownError: "未知错误",
	},
};

const enIrAddReadingPoint: TranslationKey = {
	title: "Add reading points",
	closeAriaLabel: "Close",
	hint: "Paste PDF++ selection links (multiple entries separated by blank lines)",
	placeholder:
		"> [!PDF|] [[file.pdf#page=1&selection=...|display]]\n> > Title text\n\n> [!PDF|] [[file.pdf#page=2&selection=...|display]]\n> > Another title",
	parsedCount: "Parsed {count} reading point(s)",
	rePaste: "Paste again",
	actions: {
		decreaseLevel: "Decrease level",
		increaseLevel: "Increase level",
		moveUp: "Move up",
		moveDown: "Move down",
		remove: "Remove",
		cancel: "Cancel",
		parse: "Parse",
		confirmCreate: "Create ({count})",
		creating: "Creating...",
	},
	notices: {
		pasteRequired: "Paste PDF++ link text",
		parseFailed: "No valid PDF++ links found",
		created: "Created {count} reading point(s)",
		createFailed: "Create failed: {message}",
		unknownError: "Unknown error",
	},
};

const zhIrReadingPointEdit: TranslationKey = {
	previewFallback: "预览",
	tags: {
		tagExists: "标签已存在：{tag}",
		createPrefix: "新建 {label}",
		createKeyword: "新建",
		removeAriaLabel: "移除标签 {tag}",
		placeholder: "#标签，回车添加",
	},
	traceLink: {
		linkTitle: "定位链接",
		linkPlaceholder: "粘贴 https://…、[[笔记#^块ID]] 或 EPUB/PDF 定位链接",
		locationPreview: "定位预览",
		supportedFormatsHint:
			"支持网页 URL、Obsidian 双链、块引用与 EPUB/PDF 定位格式。",
		preserveSchedule: "保留复习计划",
		preserveScheduleHint: "修改链接后仍保留当前下次复习时间与间隔。",
		notSet: "（未设置定位）",
	},
};

const enIrReadingPointEdit: TranslationKey = {
	previewFallback: "Preview",
	tags: {
		tagExists: "Tag already exists: {tag}",
		createPrefix: "Create {label}",
		createKeyword: "Create",
		removeAriaLabel: "Remove tag {tag}",
		placeholder: "#tag, press Enter to add",
	},
	traceLink: {
		linkTitle: "Location link",
		linkPlaceholder:
			"Paste https://…, [[note#^blockId]], or EPUB/PDF location link",
		locationPreview: "Location preview",
		supportedFormatsHint:
			"Supports web URLs, Obsidian wikilinks, block references, and EPUB/PDF location formats.",
		preserveSchedule: "Keep review schedule",
		preserveScheduleHint:
			"Keep the current next review time and interval after changing the link.",
		notSet: "(No location set)",
	},
};

const zhIrServiceNotices: TranslationKey = {
	quickEdit: {
		pointNotFoundDeleted: "未找到该阅读点，可能已被删除。",
		openRenameFailed: "打开重命名失败，请稍后重试。",
		traceLinkUnsupported: "该阅读点暂不支持编辑溯源链接。",
		openTraceLinkFailed: "打开溯源链接编辑失败，请稍后重试。",
		tagsUnsupported: "该阅读点暂不支持编辑标签。",
		openTagsFailed: "打开标签编辑失败，请稍后重试。",
		openSelectParentFailed: "打开父阅读点选择失败，请稍后重试。",
		selectParentFailed: "设置父阅读点失败，请检查是否形成循环引用。",
		parentSet: "已设置父阅读点：{title}",
		parentCleared: "已清除父阅读点",
	},
	topicSubmenu: {
		pointNotFound: "未找到该阅读点",
		noTopics: "暂无可用的增量阅读专题",
		currentTopicLabel: "当前专题",
		currentTopic: "当前专题：{topic}",
		movedToTopic: "已移动到专题：{deckName}",
		loadFailed: "加载专题列表失败",
	},
	scheduler: {
		switchedTagGroup: "已切换到标签组「{groupName}」",
		tagDriftTitle: "“{fileName}” 的标签已变化",
		tagDriftDescription: "匹配到新标签组「{newName}」（原：「{oldName}」）",
		switchBtn: "切换",
		keepBtn: "保持",
	},
	host: {
		noDecksAvailable: "暂无可用增量阅读专题",
		openDeckListFailed: "打开增量阅读专题列表失败",
		epubFileNotFound: "未找到对应的 EPUB 文件",
		epubChapterLocationFailed: "未能读取章节定位信息",
		chapterAlreadyInDeck: "章节“{title}”已存在于专题“{deckName}”中",
		chapterAddedToDeck: "已将“{title}”添加到专题“{deckName}”",
		noReadingPosition: "没有可用的阅读位置",
		epubTaskNotFound: "未找到此 EPUB 的 IR 任务",
		resumeSaved: "续读点已保存：{title}",
	},
	sourceNav: {
		openedButNotLocated: "已打开源文档，但未精确定位到溯源内容",
	},
	anchor: {
		createdMaterialAndAnchor: "已创建阅读材料并标记锚点",
		markedAnchor: "已标记阅读锚点",
	},
	readingTarget: {
		epubLocationExists: "该 EPUB 定位已在专题「{deckName}」中",
		blockRefExists: "该块引用已在专题「{deckName}」中",
		canvasNodeExists: "该 Canvas 节点已在专题「{deckName}」中",
		backlinkCalloutTitle: "增量阅读",
		backlinkCalloutBody: "已加入专题「{deckName}」：{title}",
		defaultFileName: "阅读点-{ts}",
	},
	workbench: {
		openContentFirst: "请先打开段落阅读内容",
		noParagraph: "当前没有可添加的段落",
		openDeckSelectFailed: "打开专题选择失败，请重试",
		selectDocumentTopicFirst: "请先为当前文档选择所属专题",
		documentTopicBound: "已将当前文档归属到专题「{deckName}」",
		paragraphAlreadyInDeck: "当前段落已在专题「{deckName}」中",
		addedToDeck: "已添加到专题「{deckName}」",
		selectExcerptFirst: "请先选中要摘录的文本",
		weaveMainPluginRequired: "请先安装并启用 Weave 主插件以创建记忆卡片",
		sourcePathUnknown: "无法识别源文档路径，制卡已取消",
		paragraphUnavailable: "当前段落不可用，制卡已取消",
		memoryCardCreated: "记忆卡片已创建",
		createMemoryCardFailed: "创建记忆卡片失败，请重试",
		addParagraphToDeckFirst: "请先将当前段落添加到专题",
		canvasNodeAlreadyInDeck: "当前 Canvas 节点已在专题「{deckName}」中",
		epubParagraphLocationFailed: "无法识别 EPUB 段落定位信息",
		epubParagraphAlreadyInDeck: "当前 EPUB 段落已在专题「{deckName}」中",
	},
	editor: {
		initFailed: "编辑器初始化失败",
	},
	defaults: {
		defaultTopic: "默认专题",
		unnamedMaterial: "未命名材料",
		unnamedContentBlock: "未命名内容块",
		unnamedSource: "未命名来源",
		bookmarkNotLocated: "未定位到目录书签",
	},
};

const enIrServiceNotices: TranslationKey = {
	quickEdit: {
		pointNotFoundDeleted: "Reading point not found. It may have been deleted.",
		openRenameFailed: "Failed to open rename. Please try again later.",
		traceLinkUnsupported:
			"This reading point does not support editing the trace link.",
		openTraceLinkFailed:
			"Failed to open trace link editor. Please try again later.",
		tagsUnsupported: "This reading point does not support editing tags.",
		openTagsFailed: "Failed to open tag editor. Please try again later.",
		openSelectParentFailed:
			"Failed to open parent reading point picker. Please try again later.",
		selectParentFailed:
			"Failed to set parent reading point. Check for circular references.",
		parentSet: "Parent reading point set: {title}",
		parentCleared: "Parent reading point cleared",
	},
	topicSubmenu: {
		pointNotFound: "Reading point not found",
		noTopics: "No incremental reading topics available",
		currentTopicLabel: "Current topic",
		currentTopic: "Current topic: {topic}",
		movedToTopic: "Moved to topic: {deckName}",
		loadFailed: "Failed to load topics",
	},
	scheduler: {
		switchedTagGroup: 'Switched to tag group "{groupName}"',
		tagDriftTitle: 'Tags changed for "{fileName}"',
		tagDriftDescription: 'Matched tag group "{newName}" (was "{oldName}")',
		switchBtn: "Switch",
		keepBtn: "Keep",
	},
	host: {
		noDecksAvailable: "No incremental reading topics available",
		openDeckListFailed: "Failed to open incremental reading topic list",
		epubFileNotFound: "Matching EPUB file not found",
		epubChapterLocationFailed: "Could not read chapter location data",
		chapterAlreadyInDeck:
			'Chapter "{title}" already exists in topic "{deckName}"',
		chapterAddedToDeck: 'Added "{title}" to topic "{deckName}"',
		noReadingPosition: "No usable reading position",
		epubTaskNotFound: "No IR task found for this EPUB",
		resumeSaved: "Resume point saved: {title}",
	},
	sourceNav: {
		openedButNotLocated:
			"Source document opened, but trace content could not be located precisely",
	},
	anchor: {
		createdMaterialAndAnchor: "Reading material created and anchor marked",
		markedAnchor: "Reading anchor marked",
	},
	readingTarget: {
		epubLocationExists:
			"This EPUB location already exists in topic “{deckName}”",
		blockRefExists: "This block reference already exists in topic “{deckName}”",
		canvasNodeExists: "This Canvas node already exists in topic “{deckName}”",
		backlinkCalloutTitle: "Incremental reading",
		backlinkCalloutBody: "Added to topic “{deckName}”: {title}",
		defaultFileName: "Reading-point-{ts}",
	},
	workbench: {
		openContentFirst: "Open paragraph reading content first",
		noParagraph: "No paragraph available to add",
		openDeckSelectFailed: "Failed to open topic picker. Please try again.",
		selectDocumentTopicFirst:
			"Select the document’s topic before adding this block",
		documentTopicBound: 'Document bound to topic “{deckName}”',
		paragraphAlreadyInDeck:
			"This paragraph already exists in topic “{deckName}”",
		addedToDeck: "Added to topic “{deckName}”",
		selectExcerptFirst: "Select text to excerpt first",
		weaveMainPluginRequired:
			"Install and enable the Weave main plugin to create memory cards",
		sourcePathUnknown:
			"Could not resolve source path. Card creation cancelled.",
		paragraphUnavailable:
			"Current paragraph is unavailable. Card creation cancelled.",
		memoryCardCreated: "Memory card created",
		createMemoryCardFailed: "Failed to create memory card. Please try again.",
		addParagraphToDeckFirst: "Add the current paragraph to a topic first",
		canvasNodeAlreadyInDeck:
			"This Canvas node already exists in topic “{deckName}”",
		epubParagraphLocationFailed: "Could not resolve EPUB paragraph location",
		epubParagraphAlreadyInDeck:
			"This EPUB paragraph already exists in topic “{deckName}”",
	},
	editor: {
		initFailed: "Editor initialization failed",
	},
	defaults: {
		defaultTopic: "Default topic",
		unnamedMaterial: "Untitled material",
		unnamedContentBlock: "Untitled content block",
		unnamedSource: "Untitled source",
		bookmarkNotLocated: "TOC bookmark not located",
	},
};

const zhIrTutorial: TranslationKey = {
	title: "增量阅读教程",
	close: "关闭教程",
	dontShowAgain: "不再显示",
	menuTitle: "教程与说明",
};

const enIrTutorial: TranslationKey = {
	title: "Incremental reading tutorial",
	close: "Close tutorial",
	dontShowAgain: "Don't show again",
	menuTitle: "Tutorial & guide",
};

export const irUiSurfaceTranslations: Record<
	AuthoringLanguage,
	TranslationKey
> = {
	"zh-CN": {
		irDataMgmt: zhIrDataMgmt,
		irBlockInfo: zhIrBlockInfo,
		irAnalytics: zhIrAnalytics,
		irPriority: zhIrPriority,
		irSchedulePreview: zhIrSchedulePreview,
		irSettings: {
			standalone: zhIrSettingsStandalone,
		},
		irCommands: zhIrCommands,
		irViews: zhIrViews,
		irNotices: zhIrNotices,
		irMain: zhIrMain,
		irModals: zhIrModals,
		irImport: zhIrImport,
		irAddTarget: zhIrAddTarget,
		irAddReadingPoint: zhIrAddReadingPoint,
		irReadingPointEdit: zhIrReadingPointEdit,
		irServiceNotices: zhIrServiceNotices,
		irTutorial: zhIrTutorial,
	},
	"en-US": {
		irDataMgmt: enIrDataMgmt,
		irBlockInfo: enIrBlockInfo,
		irAnalytics: enIrAnalytics,
		irPriority: enIrPriority,
		irSchedulePreview: enIrSchedulePreview,
		irSettings: {
			standalone: enIrSettingsStandalone,
		},
		irCommands: enIrCommands,
		irViews: enIrViews,
		irNotices: enIrNotices,
		irMain: enIrMain,
		irModals: enIrModals,
		irImport: enIrImport,
		irAddTarget: enIrAddTarget,
		irAddReadingPoint: enIrAddReadingPoint,
		irReadingPointEdit: enIrReadingPointEdit,
		irServiceNotices: enIrServiceNotices,
		irTutorial: enIrTutorial,
	},
};
