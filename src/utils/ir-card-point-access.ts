import type { Card } from "../data/types";
import type { IRBlockMeta } from "../types/ir-types";
import { isRecord, readString } from "./unknown-record";

export type IRCardPointKind = "block" | "chunk";

export function readCardPointKind(card: Card): IRCardPointKind | undefined {
	const metadata = card.metadata;
	if (!isRecord(metadata)) {
		return undefined;
	}
	if (metadata.irBlock === true) {
		return "block";
	}
	if (metadata.irChunk === true) {
		return "chunk";
	}
	return undefined;
}

export function readCardBlockMeta(card: Card): Partial<IRBlockMeta> {
	const topLevelMeta = (card as { meta?: unknown }).meta;
	if (isRecord(topLevelMeta)) {
		return topLevelMeta as Partial<IRBlockMeta>;
	}

	const metadata = card.metadata;
	if (isRecord(metadata?.meta)) {
		return metadata.meta as Partial<IRBlockMeta>;
	}

	return {};
}

export function resolveCardSourceDocumentPath(card: Card): string | undefined {
	const rawPath = readString(
		card.ir_source_document_key ??
			card.sourceDocumentKey ??
			card.sourceFile ??
			card.ir_source_file,
	);
	return rawPath || undefined;
}

export function buildPointWriteCardStub(target: {
	id: string;
	kind?: IRCardPointKind;
	sourceDocumentPath?: string;
}): Card {
	const now = new Date().toISOString();
	return {
		uuid: target.id,
		content: "",
		stats: {
			totalReviews: 0,
			totalTime: 0,
			averageTime: 0,
		},
		created: now,
		modified: now,
		metadata: {
			...(target.kind === "chunk" ? { irChunk: true } : {}),
			...(target.kind === "block" ? { irBlock: true } : {}),
		},
		ir_source_document_key: target.sourceDocumentPath,
		sourceFile: target.sourceDocumentPath,
		sourceDocumentKey: target.sourceDocumentPath,
	};
}

export function mergeBlockMeta(
	existing: IRBlockMeta,
	updates: Partial<IRBlockMeta>,
): IRBlockMeta {
	return {
		...existing,
		...updates,
		priorityLog: updates.priorityLog ?? existing.priorityLog,
		siblings: updates.siblings ?? existing.siblings,
		tagGroup: updates.tagGroup ?? existing.tagGroup,
	};
}
