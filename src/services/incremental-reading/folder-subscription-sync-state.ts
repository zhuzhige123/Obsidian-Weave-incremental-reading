export type FolderSubscriptionSyncGap =
	| "missing_material"
	| "material_deck_mismatch"
	| "missing_chunk"
	| "chunk_deck_mismatch"
	| "chunk_schedule_inactive"
	| "chunk_material_unlinked";

export type ExistingMaterialLike = {
	uuid?: string;
	filePath?: string;
	readingDeckId?: string;
	topicId?: string;
};

export type ExistingChunkLike = {
	filePath?: string;
	deckIds?: string[];
	topicIds?: string[];
	scheduleStatus?: string;
	nextRepDate?: number;
	meta?: {
		autoSubscribedAt?: string;
		autoSubscribedFolderPath?: string;
		externalDocument?: boolean;
		readingMaterialId?: string;
	} & Record<string, unknown>;
};

function getMaterialDeckId(material: ExistingMaterialLike): string {
	return String(material.readingDeckId || material.topicId || "").trim();
}

function chunkAssignedToDeck(
	chunk: ExistingChunkLike,
	deckId: string,
): boolean {
	if (!deckId) {
		return false;
	}
	const deckIds = Array.isArray(chunk.deckIds)
		? chunk.deckIds.map((id) => String(id || "").trim())
		: [];
	const topicIds = Array.isArray(chunk.topicIds)
		? chunk.topicIds.map((id) => String(id || "").trim())
		: [];
	return deckIds.includes(deckId) || topicIds.includes(deckId);
}

function isChunkScheduleInactive(chunk: ExistingChunkLike): boolean {
	const status = String(chunk.scheduleStatus || "")
		.trim()
		.toLowerCase();
	if (status === "removed" || status === "done" || status === "suspended") {
		return true;
	}
	return !Number(chunk.nextRepDate || 0);
}

/**
 * 订阅文件夹双重核对：
 * 1. 阅读材料是否存在于插件存储，且归属目标专题
 * 2. 调度 chunk 是否存在、归属目标专题，且处于可出现在月历中的状态
 *
 * 仅有 YAML 中的 weave-reading-id 不算“已订阅”。
 */
export function evaluateFolderSubscriptionSyncState(options: {
	targetDeckId: string;
	existingMaterial?: ExistingMaterialLike | null;
	existingChunk?: ExistingChunkLike | null;
}): {
	needsSync: boolean;
	syncGaps: FolderSubscriptionSyncGap[];
	hasChunkRecord: boolean;
	isFullySubscribed: boolean;
} {
	const targetDeckId = String(options.targetDeckId || "").trim();
	const existingMaterial = options.existingMaterial ?? null;
	const existingChunk = options.existingChunk ?? null;
	const syncGaps: FolderSubscriptionSyncGap[] = [];

	if (!existingMaterial) {
		syncGaps.push("missing_material");
	} else if (getMaterialDeckId(existingMaterial) !== targetDeckId) {
		syncGaps.push("material_deck_mismatch");
	}

	if (!existingChunk) {
		syncGaps.push("missing_chunk");
	} else {
		if (!chunkAssignedToDeck(existingChunk, targetDeckId)) {
			syncGaps.push("chunk_deck_mismatch");
		}
		if (isChunkScheduleInactive(existingChunk)) {
			syncGaps.push("chunk_schedule_inactive");
		}
		const materialUuid = String(existingMaterial?.uuid || "").trim();
		const linkedMaterialId = String(
			existingChunk.meta?.readingMaterialId || "",
		).trim();
		if (materialUuid && linkedMaterialId !== materialUuid) {
			syncGaps.push("chunk_material_unlinked");
		}
	}

	const hasChunkRecord = Boolean(existingChunk);
	const isFullySubscribed = syncGaps.length === 0;

	return {
		needsSync: !isFullySubscribed,
		syncGaps,
		hasChunkRecord,
		isFullySubscribed,
	};
}

export function isFolderSubscriptionPendingNewEntry(
	syncGaps: FolderSubscriptionSyncGap[],
): boolean {
	return (
		syncGaps.includes("missing_material") || syncGaps.includes("missing_chunk")
	);
}
