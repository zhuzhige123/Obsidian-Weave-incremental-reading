import type { App, TFile } from "obsidian";
import { normalizePath } from "obsidian";
import type {
	IncrementalReadingFolderSubscriptionRule,
	IncrementalReadingFolderSubscriptionSettings,
} from "../../types/plugin-settings.d";
import { readString } from "../../utils/unknown-record";
import { extractAllTags } from "../../utils/yaml-utils";
import { spreadBunchedDueDates } from "./IRHorizonLoadPlanner";
import {
	getActiveIncrementalReadingFolderSubscriptionRules,
	resolveIncrementalReadingFolderSubscriptionRuleForFile,
} from "./folder-subscription-settings";
import {
	type ExistingChunkLike,
	type ExistingMaterialLike,
	type FolderSubscriptionSyncGap,
	evaluateFolderSubscriptionSyncState,
	isFolderSubscriptionPendingNewEntry,
} from "./folder-subscription-sync-state";
import { collectMarkdownFilesForFolderSubscriptionRules } from "./folder-subscription-vault-scan";
import { IR_RUNTIME } from "./ir-runtime";

export type {
	ExistingChunkLike,
	ExistingMaterialLike,
	FolderSubscriptionSyncGap,
};

export interface IRFolderSubscriptionPendingRuleSummary {
	ruleId: string;
	folderPath: string;
	deckId: string;
	deckName: string;
	matchedCount: number;
	pendingCount: number;
}

export interface IRFolderSubscriptionCandidate {
	file: TFile;
	rule: IncrementalReadingFolderSubscriptionRule;
	deckName: string;
	/** 是否已有 chunk 记录（用于统计“更新”vs“新增”） */
	hasChunkRecord: boolean;
	/** 是否已完整订阅到目标专题（材料 + chunk + 调度均就绪） */
	isFullySubscribed: boolean;
	needsSync: boolean;
	syncGaps: FolderSubscriptionSyncGap[];
	existingChunk?: ExistingChunkLike | null;
	existingMaterial?: ExistingMaterialLike | null;
	/** @deprecated 使用 isFullySubscribed；保留兼容旧调用方 */
	existsAlready: boolean;
}

export interface IRFolderSubscriptionScanResult {
	scannedMarkdownCount: number;
	activeRuleCount: number;
	candidates: IRFolderSubscriptionCandidate[];
	pendingCount: number;
	ruleSummaries: IRFolderSubscriptionPendingRuleSummary[];
}

export interface IRFolderSubscriptionApplyResult {
	added: number;
	updated: number;
	unchanged: number;
	addedFiles: string[];
	updatedFiles: string[];
	unchangedFiles: string[];
}

function normalizeComparablePath(path: string): string {
	return normalizePath(String(path || "").trim()).toLowerCase();
}

function normalizeWeaveType(value: unknown): string {
	return readString(value).replace(/^['"]|['"]$/g, "");
}

function readYamlReadingId(app: App, file: TFile): string {
	try {
		const cache = app.metadataCache?.getFileCache?.(file);
		return String(cache?.frontmatter?.["weave-reading-id"] || "").trim();
	} catch {
		return "";
	}
}

async function readWeaveType(app: App, file: TFile): Promise<string> {
	try {
		const cache = app.metadataCache?.getFileCache?.(file);
		const fmType = normalizeWeaveType(cache?.frontmatter?.weave_type);
		if (fmType) {
			return fmType;
		}
	} catch { /* ignored */ }

	if (file.extension !== "md") {
		return "";
	}

	try {
		const content = await app.vault.read(file);
		const match = content.match(/\bweave_type\s*:\s*([^\n\r]+)/);
		return normalizeWeaveType(match?.[1]);
	} catch {
		return "";
	}
}

/** 跳过插件内部 IR 系统文件；普通剪藏 md 即使带有 weave-reading-id 仍应参与订阅补齐。 */
async function shouldSkipFolderSubscriptionFile(
	app: App,
	file: TFile,
): Promise<boolean> {
	if (file.extension === "irdeck") {
		return true;
	}

	const weaveType = await readWeaveType(app, file);
	if (weaveType === "ir-chunk" || weaveType === "ir-index") {
		return true;
	}
	if (weaveType.startsWith("ir-")) {
		return true;
	}

	const pluginConfigPath = normalizePath(
		`${app.vault.configDir}/plugins/${IR_RUNTIME.pluginId}/`,
	);
	if (normalizePath(file.path).startsWith(pluginConfigPath)) {
		return true;
	}

	return false;
}

function isFolderSubscriptionDeletedTag(tag: string): boolean {
	const normalizedTag = String(tag || "")
		.trim()
		.replace(/^#/, "")
		.toLowerCase();
	return (
		normalizedTag === "已删除" ||
		normalizedTag === "we_已删除" ||
		normalizedTag === "we_deleted"
	);
}

async function hasFolderSubscriptionExcludedTag(
	app: App,
	file: TFile,
): Promise<boolean> {
	if (file.extension !== "md") {
		return false;
	}
	try {
		const content = await app.vault.read(file);
		return extractAllTags(content).some((tag) =>
			isFolderSubscriptionDeletedTag(tag),
		);
	} catch {
		return false;
	}
}

function buildMaterialIndexes(materials: ExistingMaterialLike[]): {
	byPath: Map<string, ExistingMaterialLike>;
	byId: Map<string, ExistingMaterialLike>;
} {
	const byPath = new Map<string, ExistingMaterialLike>();
	const byId = new Map<string, ExistingMaterialLike>();
	for (const material of materials) {
		const filePath = normalizeComparablePath(String(material.filePath || ""));
		const uuid = String(material.uuid || "").trim();
		if (filePath) {
			byPath.set(filePath, material);
		}
		if (uuid) {
			byId.set(uuid, material);
		}
	}
	return { byPath, byId };
}

function resolveExistingMaterialForFile(
	file: TFile,
	app: App,
	materialIndexes: ReturnType<typeof buildMaterialIndexes>,
): ExistingMaterialLike | null {
	const normalizedFilePath = normalizeComparablePath(file.path);
	const byPath = materialIndexes.byPath.get(normalizedFilePath);
	if (byPath) {
		return byPath;
	}

	const yamlReadingId = readYamlReadingId(app, file);
	if (yamlReadingId) {
		return materialIndexes.byId.get(yamlReadingId) || null;
	}

	return null;
}

export async function scanIncrementalReadingFolderSubscriptions(options: {
	app: App;
	settings?: IncrementalReadingFolderSubscriptionSettings | null;
	existingChunks?: ExistingChunkLike[];
	existingMaterials?: ExistingMaterialLike[];
	deckNameById?: Record<string, string>;
}): Promise<IRFolderSubscriptionScanResult> {
	const {
		app,
		settings,
		existingChunks = [],
		existingMaterials = [],
		deckNameById = {},
	} = options;
	const activeRules =
		getActiveIncrementalReadingFolderSubscriptionRules(settings);
	const markdownFiles = collectMarkdownFilesForFolderSubscriptionRules(
		app,
		activeRules,
	);

	if (activeRules.length === 0 || markdownFiles.length === 0) {
		return {
			scannedMarkdownCount: markdownFiles.length,
			activeRuleCount: activeRules.length,
			candidates: [],
			pendingCount: 0,
			ruleSummaries: [],
		};
	}

	const chunkByFilePath = new Map<string, ExistingChunkLike>();
	for (const chunk of existingChunks) {
		const chunkPath = normalizeComparablePath(String(chunk?.filePath || ""));
		if (chunkPath) {
			chunkByFilePath.set(chunkPath, chunk);
		}
	}
	const materialIndexes = buildMaterialIndexes(existingMaterials);
	const candidateEntries: IRFolderSubscriptionCandidate[] = [];
	const matchedCountByRuleId = new Map<string, number>();
	const pendingCountByRuleId = new Map<string, number>();

	for (const file of markdownFiles) {
		const rule = resolveIncrementalReadingFolderSubscriptionRuleForFile(
			file.path,
			activeRules,
		);
		if (!rule) {
			continue;
		}
		if (await shouldSkipFolderSubscriptionFile(app, file)) {
			continue;
		}
		if (await hasFolderSubscriptionExcludedTag(app, file)) {
			continue;
		}

		const ruleId = String(rule.id || "").trim();
		const targetDeckId = String(rule.deckId || "").trim();
		matchedCountByRuleId.set(
			ruleId,
			(matchedCountByRuleId.get(ruleId) || 0) + 1,
		);

		const normalizedFilePath = normalizeComparablePath(file.path);
		const existingChunk = chunkByFilePath.get(normalizedFilePath) || null;
		const existingMaterial = resolveExistingMaterialForFile(
			file,
			app,
			materialIndexes,
		);
		const syncState = evaluateFolderSubscriptionSyncState({
			targetDeckId,
			existingMaterial,
			existingChunk,
		});

		if (!syncState.needsSync) {
			continue;
		}

		if (isFolderSubscriptionPendingNewEntry(syncState.syncGaps)) {
			pendingCountByRuleId.set(
				ruleId,
				(pendingCountByRuleId.get(ruleId) || 0) + 1,
			);
		}

		candidateEntries.push({
			file,
			rule,
			deckName: String(deckNameById[targetDeckId] || "").trim(),
			hasChunkRecord: syncState.hasChunkRecord,
			isFullySubscribed: syncState.isFullySubscribed,
			needsSync: syncState.needsSync,
			syncGaps: syncState.syncGaps,
			existingChunk,
			existingMaterial,
			existsAlready: syncState.isFullySubscribed,
		});
	}

	const ruleSummaries = activeRules.map((rule) => {
		const deckId = String(rule.deckId || "").trim();
		return {
			ruleId: String(rule.id || "").trim(),
			folderPath: String(rule.folderPath || "").trim(),
			deckId,
			deckName: String(deckNameById[deckId] || "").trim() || deckId,
			matchedCount: matchedCountByRuleId.get(String(rule.id || "").trim()) || 0,
			pendingCount: pendingCountByRuleId.get(String(rule.id || "").trim()) || 0,
		};
	});

	return {
		scannedMarkdownCount: markdownFiles.length,
		activeRuleCount: activeRules.length,
		candidates: candidateEntries,
		pendingCount: candidateEntries.filter((entry) =>
			isFolderSubscriptionPendingNewEntry(entry.syncGaps),
		).length,
		ruleSummaries,
	};
}

export async function applyIncrementalReadingFolderSubscriptionCandidates(options: {
	candidates: IRFolderSubscriptionCandidate[];
	pinToToday: boolean;
	initialScheduleSpread?: {
		enabled: boolean;
		horizonDays: number;
		anchorMs: number;
	};
	getOrCreateMaterial: (
		file: TFile,
		options: {
			source: "manual";
			category: "later";
			priority: number;
			tags: string[];
			copyToImportFolder: false;
		},
	) => Promise<{ uuid: string }>;
	setReadingDeck: (materialId: string, deckId: string) => Promise<boolean>;
	ensureChunkScheduled: (
		file: TFile,
		deckId: string,
		deckName: string,
		options: {
			autoSubscribedAt: string;
			autoSubscribedFolderPath: string;
			pinToToday: boolean;
			scheduleDate?: Date;
			existingChunk?: ExistingChunkLike | null;
			readingMaterialId: string;
		},
	) => Promise<boolean>;
}): Promise<IRFolderSubscriptionApplyResult> {
	const {
		candidates,
		pinToToday,
		getOrCreateMaterial,
		setReadingDeck,
		ensureChunkScheduled,
	} = options;
	let added = 0;
	let updated = 0;
	let unchanged = 0;
	const addedFiles: string[] = [];
	const updatedFiles: string[] = [];
	const unchangedFiles: string[] = [];

	const pendingNewCandidates = candidates.filter(
		(candidate) =>
			candidate.needsSync &&
			isFolderSubscriptionPendingNewEntry(candidate.syncGaps),
	);
	const spreadDateByPath = new Map<string, number>();
	if (
		pinToToday &&
		options.initialScheduleSpread?.enabled &&
		pendingNewCandidates.length > 1
	) {
		const spread = spreadBunchedDueDates(
			pendingNewCandidates.map(() => ({
				nextRepDate: options.initialScheduleSpread?.anchorMs ?? Date.now(),
			})),
			Math.max(1, options.initialScheduleSpread?.horizonDays ?? 7),
			options.initialScheduleSpread?.anchorMs ?? Date.now(),
		);
		pendingNewCandidates.forEach((candidate, index) => {
			const spreadMs = spread[index]?.nextRepDate;
			if (spreadMs) {
				spreadDateByPath.set(candidate.file.path, spreadMs);
			}
		});
	}

	for (const candidate of candidates) {
		if (!candidate.needsSync) {
			continue;
		}

		const deckId = String(candidate.rule.deckId || "").trim();
		const deckName = String(candidate.deckName || "").trim() || deckId;
		if (!deckId || !deckName) {
			continue;
		}

		const material = await getOrCreateMaterial(candidate.file, {
			source: "manual",
			category: "later",
			priority: 50,
			tags: ["weave-incremental-reading"],
			copyToImportFolder: false,
		});
		await setReadingDeck(material.uuid, deckId);

		const autoSubscribedAt =
			typeof candidate.existingChunk?.meta?.autoSubscribedAt === "string" &&
			candidate.existingChunk.meta.autoSubscribedAt.trim()
				? candidate.existingChunk.meta.autoSubscribedAt.trim()
				: candidate.hasChunkRecord
				? ""
				: new Date().toISOString();
		const spreadMs = spreadDateByPath.get(candidate.file.path);
		const scheduleDate =
			typeof spreadMs === "number" && Number.isFinite(spreadMs)
				? new Date(spreadMs)
				: undefined;
		const changed = await ensureChunkScheduled(
			candidate.file,
			deckId,
			deckName,
			{
				autoSubscribedAt,
				autoSubscribedFolderPath: String(
					candidate.rule.folderPath || "",
				).trim(),
				pinToToday: pinToToday && !scheduleDate,
				scheduleDate,
				existingChunk: candidate.existingChunk,
				readingMaterialId: material.uuid,
			},
		);

		if (!changed) {
			unchanged += 1;
			unchangedFiles.push(candidate.file.path);
			continue;
		}

		if (isFolderSubscriptionPendingNewEntry(candidate.syncGaps)) {
			added += 1;
			addedFiles.push(candidate.file.path);
		} else {
			updated += 1;
			updatedFiles.push(candidate.file.path);
		}
	}

	return {
		added,
		updated,
		unchanged,
		addedFiles,
		updatedFiles,
		unchangedFiles,
	};
}
