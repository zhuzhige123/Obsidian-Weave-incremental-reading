import { normalizePath } from "obsidian";
import {
	DEFAULT_IR_BLOCK_META,
	type IRBlockMeta,
	type IRChunkFileData,
	createDefaultChunkFileData,
	generateChunkId,
	generateSourceId,
} from "../../../types/ir-types";
import {
	blockReferencesObsidianId,
	normalizeObsidianBlockId,
} from "../paragraph-workbench/paragraph-block-reference";
import { IRStorageService } from "../IRStorageService";
import type { IRReadingTargetSchedulePin } from "./IRReadingTargetTypes";

function buildVaultIRSourceId(sourcePath: string): string {
	const normalizedPath = normalizePath(
		String(sourcePath || "").trim(),
	).toLowerCase();
	const readableName =
		normalizedPath
			.split("/")
			.pop()
			?.replace(/\.[^.]+$/i, "")
			.replace(/[^a-z0-9]+/gi, "-")
			.replace(/^-+|-+$/g, "")
			.toLowerCase() || "vault";
	let hash = 0;
	for (let index = 0; index < normalizedPath.length; index += 1) {
		hash = (hash * 31 + normalizedPath.charCodeAt(index)) | 0;
	}
	return `vault-src-${readableName}-${Math.abs(hash).toString(36)}`;
}

function buildVaultReadingPointScheduleMeta(
	context: {
		pointTitle: string;
		resumeLink: string;
		obsidianBlockId?: string;
		anchorDateKey: string;
	},
	existingMeta?: IRBlockMeta,
): IRBlockMeta {
	const baseMeta = existingMeta ?? DEFAULT_IR_BLOCK_META;
	const normalizedBlockId = normalizeObsidianBlockId(context.obsidianBlockId);

	return {
		...baseMeta,
		priorityLog: baseMeta.priorityLog ?? DEFAULT_IR_BLOCK_META.priorityLog,
		siblings: baseMeta.siblings ?? DEFAULT_IR_BLOCK_META.siblings,
		tagGroup: baseMeta.tagGroup ?? DEFAULT_IR_BLOCK_META.tagGroup,
		externalDocument: true,
		pointTitle: context.pointTitle,
		resumeLink: context.resumeLink,
		...(normalizedBlockId
			? { notes: context.resumeLink || `^${normalizedBlockId}` }
			: {}),
		sourceSequenceLocked: true,
		sourceSequenceAnchorDateKey: context.anchorDateKey,
		canvasNodeId: undefined,
		canvasTextCandidates: undefined,
	};
}

export function vaultChunkMatchesReadingTarget(
	chunk: IRChunkFileData,
	options: {
		sourcePath: string;
		blockId?: string;
		resumeLink: string;
	},
): boolean {
	const chunkPath = normalizePath(String(chunk.filePath || "").trim());
	const sourcePath = normalizePath(String(options.sourcePath || "").trim());
	if (!chunkPath || chunkPath !== sourcePath) {
		return false;
	}
	if (String(chunk.meta?.canvasNodeId || "").trim()) {
		return false;
	}

	const normalizedBlockId = normalizeObsidianBlockId(options.blockId);
	if (normalizedBlockId) {
		return (
			blockReferencesObsidianId(
				{ notes: chunk.meta?.resumeLink },
				normalizedBlockId,
			) ||
			blockReferencesObsidianId(
				{ notes: chunk.meta?.notes },
				normalizedBlockId,
			)
		);
	}

	const chunkResume = String(chunk.meta?.resumeLink || "").trim();
	const targetResume = String(options.resumeLink || "").trim();
	if (targetResume) {
		return chunkResume === targetResume;
	}
	// File-level target without a distinct resume: only match other file-level
	// externalDocument chunks that also lack a block anchor.
	return chunk.meta?.externalDocument === true && !/#\^/.test(chunkResume);
}

export async function ensureVaultReadingTargetScheduled(options: {
	storage: IRStorageService;
	sourcePath: string;
	resumeLink: string;
	title: string;
	deckId: string;
	deckName: string;
	schedulePin: IRReadingTargetSchedulePin;
	blockId?: string;
	priorityUi?: number;
}): Promise<{ result: "created" | "updated" | "unchanged"; pointId: string }> {
	const chunks = await options.storage.getAllChunkData();
	const normalizedSourcePath = normalizePath(options.sourcePath);
	const now = Date.now();
	const resumeLink = String(options.resumeLink || "").trim();
	const existing = Object.values(chunks).find((chunk) =>
		vaultChunkMatchesReadingTarget(chunk, {
			sourcePath: normalizedSourcePath,
			blockId: options.blockId,
			resumeLink,
		}),
	);

	const nextMeta = buildVaultReadingPointScheduleMeta(
		{
			pointTitle: options.title,
			resumeLink,
			obsidianBlockId: options.blockId,
			anchorDateKey: options.schedulePin.dateKey,
		},
		existing?.meta,
	);
	const nextPriorityUi =
		typeof options.priorityUi === "number" && Number.isFinite(options.priorityUi)
			? options.priorityUi
			: undefined;

	if (existing) {
		const existingDeckIds = Array.isArray(existing.deckIds)
			? existing.deckIds
			: [];
		const existingTopicIds = Array.isArray(existing.topicIds)
			? existing.topicIds
			: [];
		// Reading-target add always supplies an explicit first-read pin.
		const shouldResetDueAt = true;
		let changed = false;

		if (existingDeckIds.length !== 1 || existingDeckIds[0] !== options.deckId) {
			existing.deckIds = [options.deckId];
			changed = true;
		}
		if (
			existingTopicIds.length !== 1 ||
			existingTopicIds[0] !== options.deckId
		) {
			existing.topicIds = [options.deckId];
			changed = true;
		}
		if (existing.topicTag !== `#IR_deck_${options.deckName}`) {
			existing.topicTag = `#IR_deck_${options.deckName}`;
			changed = true;
		}
		if (existing.deckTag !== `#IR_deck_${options.deckName}`) {
			existing.deckTag = `#IR_deck_${options.deckName}`;
			changed = true;
		}
		if (
			shouldResetDueAt &&
			existing.nextRepDate !== options.schedulePin.nextRepDate
		) {
			existing.nextRepDate = options.schedulePin.nextRepDate;
			changed = true;
		}
		if (!existing.intervalDays) {
			existing.intervalDays = 1;
			changed = true;
		}
		if (shouldResetDueAt && existing.scheduleStatus !== "new") {
			existing.scheduleStatus = "new";
			changed = true;
		}
		if (
			nextPriorityUi !== undefined &&
			existing.priorityUi !== nextPriorityUi
		) {
			existing.priorityUi = nextPriorityUi;
			existing.priorityEff = nextPriorityUi;
			changed = true;
		}
		if (JSON.stringify(existing.meta || {}) !== JSON.stringify(nextMeta)) {
			existing.meta = nextMeta;
			changed = true;
		}
		if (!changed) {
			return { result: "unchanged", pointId: existing.chunkId };
		}

		existing.updatedAt = now;
		await options.storage.saveChunkData(existing);
		return { result: "updated", pointId: existing.chunkId };
	}

	const chunkId = generateChunkId();
	const sourceId =
		buildVaultIRSourceId(normalizedSourcePath) || generateSourceId();
	const chunk = createDefaultChunkFileData(
		chunkId,
		sourceId,
		normalizedSourcePath,
	);
	chunk.topicIds = [options.deckId];
	chunk.deckIds = [options.deckId];
	chunk.topicTag = `#IR_deck_${options.deckName}`;
	chunk.deckTag = `#IR_deck_${options.deckName}`;
	chunk.updatedAt = now;
	chunk.nextRepDate = options.schedulePin.nextRepDate;
	chunk.meta = nextMeta;
	if (nextPriorityUi !== undefined) {
		chunk.priorityUi = nextPriorityUi;
		chunk.priorityEff = nextPriorityUi;
	}
	await options.storage.saveChunkData(chunk);
	return { result: "created", pointId: chunk.chunkId };
}
