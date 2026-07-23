import type { App } from "obsidian";
import { normalizePath } from "obsidian";
import { logger } from "../../utils/logger";
import { readString } from "../../utils/unknown-record";
import { isFolderSubscriptionMarkdownPath } from "./folder-subscription-vault-scan";
import { IRStorageService } from "./IRStorageService";
import type { ReadingMaterialStorage } from "./ReadingMaterialStorage";

export type FolderSubscriptionAutoSubscribedChunkLike = {
	chunkId?: string;
	filePath?: string;
	meta?: {
		autoSubscribedAt?: unknown;
		autoSubscribedFolderPath?: unknown;
		externalDocument?: unknown;
		readingMaterialId?: unknown;
	} & Record<string, unknown>;
};

export interface FolderSubscriptionNonMarkdownCleanupResult {
	scanned: number;
	deletedChunks: number;
	deletedMaterials: number;
	deletedChunkIds: string[];
	deletedMaterialIds: string[];
	/** 本会话已完成一次成功全量扫描后，后续调用会短路跳过。 */
	skippedAsSessionComplete?: boolean;
}

export interface FolderSubscriptionNonMarkdownCleanupDeps {
	getAllChunks: () => Promise<
		Record<string, FolderSubscriptionAutoSubscribedChunkLike>
	>;
	deleteChunk: (chunkId: string) => Promise<void>;
	resolveMaterialIdForChunk: (
		chunk: FolderSubscriptionAutoSubscribedChunkLike,
	) => string | null;
	deleteMaterial: (materialId: string) => Promise<boolean>;
}

let inflightCleanup: Promise<FolderSubscriptionNonMarkdownCleanupResult> | null =
	null;
const deletedChunkIdsThisSession = new Set<string>();
/** 本会话已成功跑完一次全量清理（无未处理失败）后置位，避免启动+同步重复投影全库 chunk。 */
let completedSuccessfulFullPassThisSession = false;

function hasAutoSubscriptionMarker(
	meta: FolderSubscriptionAutoSubscribedChunkLike["meta"],
): boolean {
	return Boolean(
		readString(meta?.autoSubscribedAt).trim() ||
			readString(meta?.autoSubscribedFolderPath).trim(),
	);
}

/**
 * 仅清理「文件夹订阅误加」的非 Markdown 阅读点：
 * - 源路径不是 `.md`
 * - 带有 autoSubscribed* 标记（手动添加的 PDF/EPUB 等不受影响）
 * - 未显式标记为非 externalDocument（订阅写入的是外部文档 chunk）
 */
export function isFolderSubscriptionNonMarkdownAutoSubscribedChunk(
	chunk: FolderSubscriptionAutoSubscribedChunkLike | null | undefined,
): boolean {
	if (!chunk) {
		return false;
	}
	const filePath = readString(chunk.filePath).trim();
	if (!filePath || isFolderSubscriptionMarkdownPath(filePath)) {
		return false;
	}
	if (!hasAutoSubscriptionMarker(chunk.meta)) {
		return false;
	}
	if (chunk.meta?.externalDocument === false) {
		return false;
	}
	return true;
}

export function collectFolderSubscriptionNonMarkdownAutoSubscribedChunks(
	chunks: Record<string, FolderSubscriptionAutoSubscribedChunkLike>,
): Array<{ chunkId: string; chunk: FolderSubscriptionAutoSubscribedChunkLike }> {
	const collected: Array<{
		chunkId: string;
		chunk: FolderSubscriptionAutoSubscribedChunkLike;
	}> = [];
	for (const [key, chunk] of Object.entries(chunks || {})) {
		if (!isFolderSubscriptionNonMarkdownAutoSubscribedChunk(chunk)) {
			continue;
		}
		const chunkId = readString(chunk.chunkId || key).trim();
		if (!chunkId) {
			continue;
		}
		collected.push({ chunkId, chunk });
	}
	return collected;
}

function createDefaultCleanupDeps(
	app: App,
	options?: {
		storage?: IRStorageService;
		readingMaterialStorage?: ReadingMaterialStorage | null;
	},
): FolderSubscriptionNonMarkdownCleanupDeps {
	const storage = options?.storage || new IRStorageService(app);
	const materials = options?.readingMaterialStorage ?? null;

	return {
		getAllChunks: async () => {
			await storage.initialize();
			return (await storage.getAllChunkData()) as unknown as Record<
				string,
				FolderSubscriptionAutoSubscribedChunkLike
			>;
		},
		deleteChunk: async (chunkId) => {
			await storage.deleteChunkData(chunkId);
		},
		resolveMaterialIdForChunk: (chunk) => {
			const fromMeta = readString(chunk.meta?.readingMaterialId).trim();
			if (fromMeta) {
				return fromMeta;
			}
			const filePath = normalizePath(readString(chunk.filePath).trim());
			if (!filePath || !materials) {
				return null;
			}
			return materials.getMaterialByPath(filePath)?.uuid || null;
		},
		deleteMaterial: async (materialId) => {
			if (!materials) {
				return false;
			}
			return materials.deleteMaterial(materialId);
		},
	};
}

function emptyCleanupResult(
	partial?: Partial<FolderSubscriptionNonMarkdownCleanupResult>,
): FolderSubscriptionNonMarkdownCleanupResult {
	return {
		scanned: 0,
		deletedChunks: 0,
		deletedMaterials: 0,
		deletedChunkIds: [],
		deletedMaterialIds: [],
		...partial,
	};
}

/**
 * 扫描并删除文件夹订阅误导入的图片等非 Markdown 阅读点（及关联材料索引）。
 * 同一会话内：成功全量扫描后短路；同一 chunkId 成功删除后不重试。
 */
export async function cleanupFolderSubscriptionNonMarkdownAutoSubscribedEntries(
	app: App,
	options?: {
		storage?: IRStorageService;
		readingMaterialStorage?: ReadingMaterialStorage | null;
		deps?: FolderSubscriptionNonMarkdownCleanupDeps;
	},
): Promise<FolderSubscriptionNonMarkdownCleanupResult> {
	if (completedSuccessfulFullPassThisSession) {
		return emptyCleanupResult({ skippedAsSessionComplete: true });
	}
	if (inflightCleanup) {
		return inflightCleanup;
	}

	inflightCleanup = (async (): Promise<FolderSubscriptionNonMarkdownCleanupResult> => {
		const deps =
			options?.deps ||
			createDefaultCleanupDeps(app, {
				storage: options?.storage,
				readingMaterialStorage: options?.readingMaterialStorage,
			});

		const chunks = await deps.getAllChunks();
		const scanned = Object.keys(chunks).length;
		const candidates =
			collectFolderSubscriptionNonMarkdownAutoSubscribedChunks(chunks).filter(
				(entry) => !deletedChunkIdsThisSession.has(entry.chunkId),
			);

		const deletedChunkIds: string[] = [];
		const deletedMaterialIds: string[] = [];
		const materialIdsToDelete = new Set<string>();
		let hadFailure = false;

		for (const { chunkId, chunk } of candidates) {
			try {
				const materialId = deps.resolveMaterialIdForChunk(chunk);
				await deps.deleteChunk(chunkId);
				deletedChunkIdsThisSession.add(chunkId);
				deletedChunkIds.push(chunkId);
				if (materialId) {
					materialIdsToDelete.add(materialId);
				}
			} catch (error) {
				hadFailure = true;
				logger.warn(
					"[FolderSubscriptionNonMarkdownCleanup] delete chunk failed",
					{ chunkId, error },
				);
			}
		}

		for (const materialId of materialIdsToDelete) {
			try {
				const deleted = await deps.deleteMaterial(materialId);
				if (deleted) {
					deletedMaterialIds.push(materialId);
				}
			} catch (error) {
				hadFailure = true;
				logger.warn(
					"[FolderSubscriptionNonMarkdownCleanup] delete material failed",
					{ materialId, error },
				);
			}
		}

		if (deletedChunkIds.length > 0) {
			logger.info(
				"[FolderSubscriptionNonMarkdownCleanup] removed non-md auto-subscribed entries",
				{
					deletedChunks: deletedChunkIds.length,
					deletedMaterials: deletedMaterialIds.length,
					deletedChunkIds,
				},
			);
		}

		if (!hadFailure) {
			completedSuccessfulFullPassThisSession = true;
		}

		return {
			scanned,
			deletedChunks: deletedChunkIds.length,
			deletedMaterials: deletedMaterialIds.length,
			deletedChunkIds,
			deletedMaterialIds,
		};
	})();

	try {
		return await inflightCleanup;
	} finally {
		inflightCleanup = null;
	}
}

/** 测试用：重置会话去重状态。 */
export function resetFolderSubscriptionNonMarkdownCleanupSessionStateForTests(): void {
	deletedChunkIdsThisSession.clear();
	completedSuccessfulFullPassThisSession = false;
	inflightCleanup = null;
}
