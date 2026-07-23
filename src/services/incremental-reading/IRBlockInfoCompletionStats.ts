import type { App } from "obsidian";
import type { Card } from "../../data/types";
import { getObsidianPluginAs } from "../../utils/obsidian-plugin-registry";
import { WEAVE_MAIN_PLUGIN_ID } from "../../utils/weave-reader-access";
import { resolveDerivedOutlinkNotePaths } from "./IRAssociatedNoteOutlinks";
import { resolveAssociatedNotePaths } from "./IRAssociatedNoteSignals";
import {
	resolveAssociatedNoteRelationMode,
	type AssociatedNoteRelationMode,
} from "./IRLinkedNotePolicy";
import { getIncrementalReadingPlugin } from "./ir-runtime";
import {
	buildIRTraceOverviewStats,
	detectTraceSourceKind,
	normalizeTraceDocumentKey,
} from "./IRSourceTraceStats";

export interface IRBlockInfoCompletionStatsInput {
	sourceFilePath?: string | null;
	sourceType?: string | null;
	pointId?: string | null;
	linkedNotePaths?: Array<string | null | undefined> | null;
	linkedNotePath?: string | null;
	linkedCardIds?: Array<string | null | undefined> | null;
	cards?: Card[] | null;
	/** When set, skips relation-mode detection and uses this count/path source. */
	relationMode?: AssociatedNoteRelationMode;
	derivedOutlinkPaths?: string[] | null;
}

export interface IRBlockInfoCompletionStats {
	/** 溯源到该文档的 Weave 卡片数量（摘录 + 记忆卡） */
	cardCount: number;
	/** 关联 Markdown 笔记数量 */
	linkedNoteCount: number;
}

type CardListHost = {
	dataStorage?: {
		getAllCards?: () => Promise<Card[]>;
	} | null;
};

function normalizeIdList(
	ids: Array<string | null | undefined> | null | undefined,
): string[] {
	if (!Array.isArray(ids)) {
		return [];
	}
	const seen = new Set<string>();
	const result: string[] = [];
	for (const id of ids) {
		const normalized = String(id || "").trim();
		if (!normalized || seen.has(normalized)) {
			continue;
		}
		seen.add(normalized);
		result.push(normalized);
	}
	return result;
}

function resolveLinkedNoteCount(input: IRBlockInfoCompletionStatsInput): number {
	const mode =
		input.relationMode ||
		resolveAssociatedNoteRelationMode({
			id: input.pointId ?? undefined,
			sourceType: input.sourceType,
			sourceFile: input.sourceFilePath,
		});

	if (mode === "derived-outlinks") {
		return Array.isArray(input.derivedOutlinkPaths)
			? input.derivedOutlinkPaths.length
			: 0;
	}

	return resolveAssociatedNotePaths({
		associatedNotePath: input.linkedNotePath,
		associatedNotePaths: input.linkedNotePaths,
	}).length;
}

export function buildIRBlockInfoCompletionStats(
	input: IRBlockInfoCompletionStatsInput,
): IRBlockInfoCompletionStats {
	const linkedNoteCount = resolveLinkedNoteCount(input);

	const linkedCardIds = normalizeIdList(input.linkedCardIds);
	const sourcePath = String(input.sourceFilePath || "").trim();
	const sourceKind = detectTraceSourceKind(sourcePath);
	const sourceDocumentKey = normalizeTraceDocumentKey(sourcePath, sourceKind);
	const cards = Array.isArray(input.cards) ? input.cards : [];

	if (sourceDocumentKey && cards.length > 0) {
		const traced = buildIRTraceOverviewStats({
			units: [
				{
					sourceKind,
					sourceDocumentKey,
				},
			],
			cards,
		});
		return {
			cardCount: traced.extractCount + traced.memoryCardCount,
			linkedNoteCount,
		};
	}

	return {
		cardCount: linkedCardIds.length,
		linkedNoteCount,
	};
}

export async function loadWeaveCardsForTrace(app: App): Promise<Card[]> {
	const hosts: Array<CardListHost | null> = [
		getIncrementalReadingPlugin(app),
		getObsidianPluginAs<CardListHost>(app, WEAVE_MAIN_PLUGIN_ID),
	];

	for (const host of hosts) {
		const dataStorage = host?.dataStorage;
		const getAllCards = dataStorage?.getAllCards;
		if (!dataStorage || typeof getAllCards !== "function") {
			continue;
		}
		try {
			const cards = await getAllCards.call(dataStorage);
			if (Array.isArray(cards)) {
				return cards;
			}
		} catch {
			// Try next host.
		}
	}

	return [];
}

export async function resolveIRBlockInfoCompletionStats(
	app: App,
	input: Omit<
		IRBlockInfoCompletionStatsInput,
		"cards" | "derivedOutlinkPaths" | "relationMode"
	>,
): Promise<IRBlockInfoCompletionStats> {
	const cards = await loadWeaveCardsForTrace(app);
	const relationMode = resolveAssociatedNoteRelationMode({
		id: input.pointId ?? undefined,
		sourceType: input.sourceType,
		sourceFile: input.sourceFilePath,
	});

	const derivedOutlinkPaths =
		relationMode === "derived-outlinks"
			? resolveDerivedOutlinkNotePaths(app, input.sourceFilePath)
			: undefined;

	return buildIRBlockInfoCompletionStats({
		...input,
		relationMode,
		derivedOutlinkPaths,
		cards,
	});
}
