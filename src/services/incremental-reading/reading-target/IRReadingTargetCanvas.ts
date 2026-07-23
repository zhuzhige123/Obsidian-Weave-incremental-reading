import { normalizePath } from "obsidian";
import {
	DEFAULT_IR_BLOCK_META,
	type IRBlockMeta,
	createDefaultChunkFileData,
	generateChunkId,
	generateSourceId,
} from "../../../types/ir-types";
import { normalizeCanvasNodeId } from "../../ui/canvas-source-locate";
import { IRStorageService } from "../IRStorageService";
import type {
	IRReadingTargetSchedulePin,
	ParsedReadingTarget,
} from "./IRReadingTargetTypes";

function buildCanvasIRSourceId(canvasPath: string): string {
	const normalizedPath = normalizePath(
		String(canvasPath || "").trim(),
	).toLowerCase();
	const readableName =
		normalizedPath
			.split("/")
			.pop()
			?.replace(/\.canvas$/i, "")
			.replace(/[^a-z0-9]+/gi, "-")
			.replace(/^-+|-+$/g, "")
			.toLowerCase() || "canvas";
	let hash = 0;
	for (let index = 0; index < normalizedPath.length; index += 1) {
		hash = (hash * 31 + normalizedPath.charCodeAt(index)) | 0;
	}
	return `canvas-src-${readableName}-${Math.abs(hash).toString(36)}`;
}

function buildCanvasReadingPointScheduleMeta(
	context: {
		pointTitle: string;
		resumeLink: string;
		canvasNodeId: string;
		canvasTextCandidates: string[];
		anchorDateKey: string;
	},
	existingMeta?: IRBlockMeta,
): IRBlockMeta {
	const baseMeta = existingMeta ?? DEFAULT_IR_BLOCK_META;

	return {
		...baseMeta,
		priorityLog: baseMeta.priorityLog ?? DEFAULT_IR_BLOCK_META.priorityLog,
		siblings: baseMeta.siblings ?? DEFAULT_IR_BLOCK_META.siblings,
		tagGroup: baseMeta.tagGroup ?? DEFAULT_IR_BLOCK_META.tagGroup,
		externalDocument: true,
		pointTitle: context.pointTitle,
		resumeLink: context.resumeLink,
		canvasNodeId: context.canvasNodeId,
		canvasTextCandidates: context.canvasTextCandidates,
		sourceSequenceLocked: true,
		sourceSequenceAnchorDateKey: context.anchorDateKey,
	};
}

export function parseCanvasNodeFragment(
	fragment: string | undefined,
): { nodeId: string; fragmentWithQuery: string } | null {
	const raw = String(fragment || "").trim();
	if (!raw) {
		return null;
	}
	const withoutCaret = raw.startsWith("^") ? raw.slice(1) : raw;
	const nodeId = normalizeCanvasNodeId(withoutCaret);
	if (!nodeId) {
		return null;
	}
	return {
		nodeId,
		fragmentWithQuery: withoutCaret,
	};
}

export function buildCanvasParsedReadingTarget(options: {
	rawInput: string;
	sourceFilePath: string;
	nodeId: string;
	fragmentWithQuery: string;
	alias?: string;
	canvasTextCandidates?: string[];
}): ParsedReadingTarget {
	const wikiTarget = `${options.sourceFilePath}#^${options.fragmentWithQuery}`;
	const displayLink = options.alias
		? `[[${wikiTarget}|${options.alias}]]`
		: `[[${wikiTarget}]]`;

	return {
		kind: "canvas",
		rawInput: options.rawInput,
		resumeLink: displayLink,
		displayLink,
		sourceFilePath: options.sourceFilePath,
		canvasNodeId: options.nodeId,
		canvasTextCandidates: options.canvasTextCandidates,
		alias: options.alias,
		titleHint: options.alias,
	};
}

export async function ensureCanvasReadingTargetScheduled(options: {
	storage: IRStorageService;
	canvasPath: string;
	nodeId: string;
	resumeLink: string;
	title: string;
	deckId: string;
	deckName: string;
	schedulePin: IRReadingTargetSchedulePin;
	canvasTextCandidates?: string[];
}): Promise<{ result: "created" | "updated" | "unchanged"; pointId: string }> {
	const chunks = await options.storage.getAllChunkData();
	const normalizedCanvasPath = normalizePath(options.canvasPath);
	const now = Date.now();
	const textCandidates = Array.isArray(options.canvasTextCandidates)
		? options.canvasTextCandidates
		: [];
	const existing = Object.values(chunks).find((chunk) => {
		const chunkPath = normalizePath(String(chunk.filePath || "").trim());
		const chunkNodeId = String(chunk.meta?.canvasNodeId || "").trim();
		return (
			chunkPath === normalizedCanvasPath && chunkNodeId === options.nodeId
		);
	});

	const nextMeta = buildCanvasReadingPointScheduleMeta(
		{
			pointTitle: options.title,
			resumeLink: options.resumeLink,
			canvasNodeId: options.nodeId,
			canvasTextCandidates: textCandidates,
			anchorDateKey: options.schedulePin.dateKey,
		},
		existing?.meta,
	);

	if (existing) {
		const existingDeckIds = Array.isArray(existing.deckIds)
			? existing.deckIds
			: [];
		const existingTopicIds = Array.isArray(existing.topicIds)
			? existing.topicIds
			: [];
		const existingStatus = String(existing.scheduleStatus || "").trim();
		// Reading-target add always supplies an explicit first-read pin; match
		// IRHostSharedService note-backed reuse so the user's date is applied.
		const shouldPinSchedule = true;
		const shouldResetDueAt =
			shouldPinSchedule ||
			existingStatus === "removed" ||
			existingStatus === "done" ||
			existingStatus === "suspended" ||
			!existingStatus ||
			!Number(existing.nextRepDate || 0);
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
		if (JSON.stringify(existing.meta || {}) !== JSON.stringify(nextMeta)) {
			changed = true;
		}
		if (!changed) {
			return { result: "unchanged", pointId: existing.chunkId };
		}

		existing.updatedAt = now;
		existing.meta = nextMeta;
		await options.storage.saveChunkData(existing);
		return { result: "updated", pointId: existing.chunkId };
	}

	const chunkId = generateChunkId();
	const sourceId =
		buildCanvasIRSourceId(normalizedCanvasPath) || generateSourceId();
	const chunk = createDefaultChunkFileData(
		chunkId,
		sourceId,
		normalizedCanvasPath,
	);
	chunk.topicIds = [options.deckId];
	chunk.deckIds = [options.deckId];
	chunk.topicTag = `#IR_deck_${options.deckName}`;
	chunk.deckTag = `#IR_deck_${options.deckName}`;
	chunk.updatedAt = now;
	chunk.nextRepDate = options.schedulePin.nextRepDate;
	chunk.meta = nextMeta;
	await options.storage.saveChunkData(chunk);
	return { result: "created", pointId: chunk.chunkId };
}
