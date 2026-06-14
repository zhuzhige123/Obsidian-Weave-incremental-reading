import type { App } from "obsidian";
import { IRStorageService } from "../IRStorageService";
import { parseReadingTargetInput } from "../reading-target/IRReadingTargetParser";
import type { ParsedReadingTarget } from "../reading-target/IRReadingTargetTypes";
import type { IRReadingPointEditDraft, IRReadingPointEditSaveInput } from "./IRReadingPointEditTypes";

export type ReadingPointSavePatch = Partial<{
	title: string;
	titleManuallyEdited: boolean;
	deckId: string;
	linkInput: string;
	tags: string[];
}>;

export interface ReadingPointDeckOption {
	id: string;
	name: string;
}

export function resolveParsedTargetForSave(
	app: App,
	draft: IRReadingPointEditDraft,
	linkInput: string,
	originalLinkInput: string,
	cached?: ParsedReadingTarget | null
): ParsedReadingTarget | null {
	const trimmed = String(linkInput || "").trim();
	if (!trimmed) {
		return null;
	}

	const linkChanged = trimmed !== String(originalLinkInput || "").trim();
	if (!linkChanged && cached !== undefined) {
		return cached;
	}

	return parseReadingTargetInput(app, trimmed, draft.sourceFile || "");
}

export function buildSaveInputFromDraft(
	app: App,
	draft: IRReadingPointEditDraft,
	patch: ReadingPointSavePatch = {},
	options: {
		parsedTarget?: ParsedReadingTarget | null;
		preserveScheduleOnLinkChange?: boolean;
	} = {}
): IRReadingPointEditSaveInput {
	const linkInput = patch.linkInput ?? draft.linkInput;
	const originalLinkInput = draft.originalLinkInput;
	const parsedTarget =
		options.parsedTarget !== undefined
			? options.parsedTarget
			: resolveParsedTargetForSave(app, draft, linkInput, originalLinkInput);

	return {
		pointId: draft.pointId,
		sourceType: draft.sourceType,
		sourceFile: draft.sourceFile,
		title: patch.title ?? draft.title,
		titleManuallyEdited: patch.titleManuallyEdited ?? draft.titleManuallyEdited,
		linkInput,
		originalLinkInput,
		note: draft.note,
		deckId: patch.deckId ?? draft.deckId,
		priority: draft.priority,
		nextRepDate: draft.nextRepDate,
		tags: patch.tags ?? draft.tags,
		associatedNotePaths: draft.associatedNotePaths,
		isStarred: draft.isStarred,
		preserveScheduleOnLinkChange: options.preserveScheduleOnLinkChange ?? true,
		parameterContextOverride: draft.parameterContextOverride,
		parameterContext: draft.parameterContext,
		parsedTarget,
	};
}

export async function loadReadingPointDeckOptions(app: App): Promise<ReadingPointDeckOption[]> {
	const storage = new IRStorageService(app);
	await storage.initialize();
	return Object.values(await storage.getAllDecks())
		.filter((deck) => !deck.archivedAt)
		.sort((left, right) => left.name.localeCompare(right.name, "zh-CN"))
		.map((deck) => ({ id: deck.id, name: deck.name }));
}
