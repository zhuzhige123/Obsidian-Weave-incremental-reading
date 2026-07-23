import type { App } from "obsidian";
import { TFile, normalizePath } from "obsidian";
import { getVisibleAssociatedNotePath } from "../../services/incremental-reading/IRAssociatedNoteVisibility";
import type { ScheduleItem } from "../../services/incremental-reading/IRCalendarScheduleItem";
import { matchesScheduleItemTypeSearch } from "../../services/incremental-reading/IRCalendarScheduleItemTypeBadge";
import { isEpubBookmarkTaskId } from "../../services/incremental-reading/IREpubBookmarkTaskService";
import { isPdfBookmarkTaskId } from "../../services/incremental-reading/IRPdfBookmarkTaskService";
import { compareScheduleItemsForDailyQueue } from "../../services/incremental-reading/IRScheduleItemSort";
import type { ReadingMaterial } from "../../types/incremental-reading-types";
import type { IRDeck } from "../../types/ir-types";
import type { SearchQuery } from "../../utils/search-parser";
import {
	isSameCalendarDay,
	parseCalendarDateKey,
	toCalendarDateKey,
} from "./ir-calendar-date";
import type { IRCalendarSearchResultEntry } from "./ir-calendar-sidebar-types";

export interface IRCalendarSearchContext {
	app: App;
	readingMaterials: ReadingMaterial[];
	irDecks: IRDeck[];
	materialTagLabelsById: Record<string, string[]>;
	/** Child point id → parent reading-point title (for free-text search). */
	parentTitleByMaterialId?: Record<string, string>;
	resolveCanonicalDeckId: (deckId: string) => string;
}

function formatFrontmatterSearchValue(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}
	if (typeof value === "string") {
		return value;
	}
	if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
		return String(value);
	}
	if (Array.isArray(value)) {
		return value.map((entry) => formatFrontmatterSearchValue(entry)).join(" ");
	}
	return "";
}

export function normalizeSourcePathKey(path?: string): string {
	const normalized = normalizePath(String(path || "").trim());
	return normalized ? normalized.toLowerCase() : "";
}

export function getSourceDisplayLabel(path?: string): string {
	const normalized = normalizePath(String(path || "").trim());
	if (!normalized) {
		return "";
	}

	const baseName = normalized.split("/").pop() || normalized;
	return baseName.replace(/\.md$/i, "");
}

export function matchesDateRanges(
	dateValue: string,
	ranges: Array<{ from?: string; to?: string }>,
): boolean {
	if (ranges.length === 0) {
		return true;
	}

	if (!dateValue) {
		return false;
	}

	return ranges.every((range) => {
		if (range.from && dateValue < range.from) return false;
		if (range.to && dateValue > range.to) return false;
		return true;
	});
}

export function matchesAnyTokens(value: string, tokens: string[]): boolean {
	if (tokens.length === 0) {
		return true;
	}

	const normalizedValue = value.toLowerCase();
	return tokens.some((token) => normalizedValue.includes(token.toLowerCase()));
}

export function excludesAllTokens(value: string, tokens: string[]): boolean {
	if (tokens.length === 0) {
		return true;
	}

	const normalizedValue = value.toLowerCase();
	return tokens.every(
		(token) => !normalizedValue.includes(token.toLowerCase()),
	);
}

const PRIORITY_MATCH_EPSILON = 1e-6;

export function matchesPriorityValues(
	priority: number,
	targets: number[],
): boolean {
	if (targets.length === 0) {
		return true;
	}

	const value = Number(priority);
	if (!Number.isFinite(value)) {
		return false;
	}

	return targets.some(
		(target) =>
			Number.isFinite(target) &&
			Math.abs(value - target) <= PRIORITY_MATCH_EPSILON,
	);
}

export function normalizeFolderFilterPath(folder: string): string {
	return normalizePath(String(folder || "").trim())
		.replace(/\/+$/, "")
		.toLowerCase();
}

export function matchesFolderFilters(
	sourceFile: string,
	folders: string[],
): boolean {
	if (folders.length === 0) {
		return true;
	}

	const pathKey = normalizeSourcePathKey(sourceFile);
	if (!pathKey) {
		return false;
	}

	return folders.some((folder) => {
		const folderKey = normalizeFolderFilterPath(folder);
		if (!folderKey) {
			return false;
		}
		return pathKey === folderKey || pathKey.startsWith(`${folderKey}/`);
	});
}

export function excludesFolderFilters(
	sourceFile: string,
	folders: string[],
): boolean {
	if (folders.length === 0) {
		return true;
	}

	return !matchesFolderFilters(sourceFile, folders);
}

export function matchesTagFilters(tags: string[], tokens: string[]): boolean {
	if (tokens.length === 0) {
		return true;
	}

	const normalizedTags = tags
		.map((tag) =>
			String(tag || "")
				.trim()
				.replace(/^#+/, "")
				.toLowerCase(),
		)
		.filter(Boolean);
	if (normalizedTags.length === 0) {
		return false;
	}

	return tokens.some((token) => {
		const needle = String(token || "")
			.trim()
			.toLowerCase()
			.replace(/^#+/, "");
		if (!needle) {
			return false;
		}
		return normalizedTags.some(
			(tag) => tag === needle || tag.endsWith(`/${needle}`),
		);
	});
}

export function excludesTagFilters(tags: string[], tokens: string[]): boolean {
	if (tokens.length === 0) {
		return true;
	}

	return !matchesTagFilters(tags, tokens);
}

export function getScheduleItemDeckName(
	material: ScheduleItem,
	ctx: IRCalendarSearchContext,
): string {
	const deckId = ctx.resolveCanonicalDeckId(material.deckId || "");
	if (!deckId) {
		return "";
	}

	const matchedDeck = ctx.irDecks.find(
		(deck) => ctx.resolveCanonicalDeckId(deck.id) === deckId,
	);
	return String(matchedDeck?.name || "").trim();
}

export function getScheduleItemSourceTFile(
	material: ScheduleItem,
	app: App,
): TFile | null {
	const abstractFile = app.vault.getAbstractFileByPath(
		String(material.sourceFile || "").trim(),
	);
	return abstractFile instanceof TFile ? abstractFile : null;
}

export function getScheduleItemFrontmatter(
	material: ScheduleItem,
	app: App,
): Record<string, unknown> {
	const file = getScheduleItemSourceTFile(material, app);
	if (!file || file.extension !== "md") {
		return {};
	}

	return (
		(app.metadataCache.getFileCache(file)?.frontmatter as
			| Record<string, unknown>
			| undefined) || {}
	);
}

export function getReadingMaterialByPath(
	filePath: string,
	readingMaterials: ReadingMaterial[],
): ReadingMaterial | undefined {
	const normalizedPath = normalizeSourcePathKey(filePath);
	if (!normalizedPath) {
		return undefined;
	}

	return readingMaterials.find(
		(material) => normalizeSourcePathKey(material.filePath) === normalizedPath,
	);
}

export function getScheduleItemCreatedDate(material: ScheduleItem): string {
	// Prefer reading-point creation time. Material/file ctime is shared across
	// all points on a source and does not mean "when this point was added".
	return toCalendarDateKey(material.createdAt);
}

export function getScheduleItemModifiedDate(material: ScheduleItem): string {
	return toCalendarDateKey(material.updatedAt);
}

export function getScheduleItemDueDate(material: ScheduleItem): string {
	if (
		material.nextReviewDate instanceof Date &&
		!Number.isNaN(material.nextReviewDate.getTime())
	) {
		return toCalendarDateKey(material.nextReviewDate);
	}

	if (material.nextRepDate > 0) {
		return toCalendarDateKey(material.nextRepDate);
	}

	return "";
}

export function getMaterialTagLabels(
	materialId: string,
	materialTagLabelsById: Record<string, string[]>,
): string[] {
	return materialTagLabelsById[materialId] || [];
}

export function getScheduleItemSearchText(
	material: ScheduleItem,
	ctx: IRCalendarSearchContext,
): string {
	const frontmatter = getScheduleItemFrontmatter(material, ctx.app);
	const readingMaterial = getReadingMaterialByPath(
		material.sourceFile,
		ctx.readingMaterials,
	);
	const readingId = formatFrontmatterSearchValue(
		frontmatter["weave-reading-id"] ?? readingMaterial?.uuid ?? "",
	).trim();
	return [
		material.id,
		readingId,
		material.displayName,
		material.title,
		material.sourceFile,
		material.resumeLink,
		getVisibleAssociatedNotePath(material),
		getScheduleItemDeckName(material, ctx),
		ctx.parentTitleByMaterialId?.[material.id],
		...getMaterialTagLabels(material.id, ctx.materialTagLabelsById),
	]
		.filter(
			(value): value is string =>
				typeof value === "string" && value.trim().length > 0,
		)
		.join(" ")
		.toLowerCase();
}

export function matchesSearchQueryForMaterial(
	material: ScheduleItem,
	query: SearchQuery,
	ctx: IRCalendarSearchContext,
): boolean {
	if (!query.raw.trim()) {
		return true;
	}

	const deckName = getScheduleItemDeckName(material, ctx);
	const sourceFile = String(material.sourceFile || "");
	const tags = getMaterialTagLabels(material.id, ctx.materialTagLabelsById);
	const stateText = String(material.scheduleStatus || "").toLowerCase();
	const statusTokens = [...query.statuses, ...query.states];
	const searchText = getScheduleItemSearchText(material, ctx);

	if (query.decks.length > 0 && !matchesAnyTokens(deckName, query.decks)) {
		return false;
	}

	if (!matchesTagFilters(tags, query.tags)) {
		return false;
	}

	if (!matchesPriorityValues(Number(material.priority || 0), query.priorities)) {
		return false;
	}

	if (
		query.sources.length > 0 &&
		!matchesAnyTokens(sourceFile, query.sources)
	) {
		return false;
	}

	if (!matchesFolderFilters(sourceFile, query.folders)) {
		return false;
	}

	if (
		statusTokens.length > 0 &&
		!statusTokens.some((status) => stateText.includes(status.toLowerCase()))
	) {
		return false;
	}

	if (
		!matchesScheduleItemTypeSearch(
			ctx.app,
			material,
			query.types,
			query.excludeTypes,
		)
	) {
		return false;
	}

	if (
		!matchesDateRanges(getScheduleItemCreatedDate(material), query.dateRanges)
	) {
		return false;
	}

	if (
		!matchesDateRanges(
			getScheduleItemModifiedDate(material),
			query.modifiedRanges,
		)
	) {
		return false;
	}

	if (!matchesDateRanges(getScheduleItemDueDate(material), query.dueRanges)) {
		return false;
	}

	if (query.yamlFilters.length > 0) {
		const frontmatter = getScheduleItemFrontmatter(material, ctx.app);
		const matchesYaml = query.yamlFilters.every((filter) => {
			const rawValue = frontmatter[filter.key];
			if (rawValue === undefined || rawValue === null) {
				return false;
			}

			const valueText = formatFrontmatterSearchValue(rawValue);
			return valueText.toLowerCase().includes(filter.value.toLowerCase());
		});
		if (!matchesYaml) {
			return false;
		}
	}

	if (!excludesAllTokens(deckName, query.excludeDecks)) {
		return false;
	}

	if (!excludesTagFilters(tags, query.excludeTags)) {
		return false;
	}

	if (!excludesAllTokens(sourceFile, query.excludeSources)) {
		return false;
	}

	if (!excludesFolderFilters(sourceFile, query.excludeFolders)) {
		return false;
	}

	if (
		query.excludeStatuses.length > 0 &&
		query.excludeStatuses.some((status) =>
			stateText.includes(status.toLowerCase()),
		)
	) {
		return false;
	}

	if (
		query.text.length > 0 &&
		!query.text.every((text) => searchText.includes(text.toLowerCase()))
	) {
		return false;
	}

	if (
		query.excludeText.length > 0 &&
		query.excludeText.some((text) => searchText.includes(text.toLowerCase()))
	) {
		return false;
	}

	return true;
}

export function formatSearchResultDateLabel(
	dateKey: string,
	today: Date,
	t: (key: string, vars?: Record<string, string | number>) => string,
): string {
	const parsed = parseCalendarDateKey(dateKey);
	if (!parsed) {
		return dateKey;
	}

	if (isSameCalendarDay(parsed, today)) {
		return t("irSidebar.controls.today");
	}

	if (parsed.getFullYear() === today.getFullYear()) {
		return t("irSidebar.calendar.dateMonthDay", {
			month: parsed.getMonth() + 1,
			day: parsed.getDate(),
		});
	}

	return t("irSidebar.calendar.dateFull", {
		year: parsed.getFullYear(),
		month: parsed.getMonth() + 1,
		day: parsed.getDate(),
	});
}

export function getSearchableScheduleEntries(params: {
	materialsByDate: Map<string, ScheduleItem[]>;
	pinnedByDate: Map<string, ScheduleItem[]>;
	matchesActiveDeckFilter: (item: ScheduleItem) => boolean;
}): IRCalendarSearchResultEntry[] {
	const merged = new Map<string, IRCalendarSearchResultEntry>();
	const appendEntries = (input: Map<string, ScheduleItem[]>) => {
		for (const [dateKey, items] of input.entries()) {
			for (const item of items) {
				if (!params.matchesActiveDeckFilter(item) || merged.has(item.id)) {
					continue;
				}

				merged.set(item.id, { item, dateKey });
			}
		}
	};

	appendEntries(params.materialsByDate);
	appendEntries(params.pinnedByDate);

	return Array.from(merged.values()).sort((left, right) => {
		const dateCompare = left.dateKey.localeCompare(right.dateKey);
		if (dateCompare !== 0) {
			return dateCompare;
		}

		return compareScheduleItemsForDailyQueue(
			left.item,
			right.item,
			left.dateKey,
		);
	});
}

export function getMatchedSearchEntries(params: {
	materialsByDate: Map<string, ScheduleItem[]>;
	pinnedByDate: Map<string, ScheduleItem[]>;
	parsedSearchQuery: SearchQuery | null;
	matchesActiveDeckFilter: (item: ScheduleItem) => boolean;
	matchesActiveTagFilter: (item: ScheduleItem) => boolean;
	searchContext: IRCalendarSearchContext;
}): IRCalendarSearchResultEntry[] {
	const query = params.parsedSearchQuery;
	if (!query?.raw.trim()) {
		return [];
	}

	return getSearchableScheduleEntries({
		materialsByDate: params.materialsByDate,
		pinnedByDate: params.pinnedByDate,
		matchesActiveDeckFilter: params.matchesActiveDeckFilter,
	}).filter(
		(entry) =>
			params.matchesActiveTagFilter(entry.item) &&
			matchesSearchQueryForMaterial(entry.item, query, params.searchContext),
	);
}

export function getSearchResultIdentityKey(material: ScheduleItem): string {
	const normalizedSource = normalizeSourcePathKey(material.sourceFile);
	if (normalizedSource) {
		return `${material.id}::${normalizedSource}`;
	}

	const title = String(material.title || "").trim();
	if (title) {
		return title;
	}

	return material.id;
}

export function getScheduleItemLabel(
	material: ScheduleItem,
	options: {
		continueReadingResolvedTitleById: Record<string, string>;
		untitledLabel: string;
	},
): string {
	const displayName = String(material.displayName || "").trim();
	if (displayName) {
		return displayName;
	}

	const title = String(material.title || "").trim();
	if (title) {
		return title;
	}

	const cachedResolvedTitle = String(
		options.continueReadingResolvedTitleById[material.id] || "",
	).trim();
	if (cachedResolvedTitle) {
		return cachedResolvedTitle;
	}

	const sourceLabel = getSourceDisplayLabel(material.sourceFile);
	return sourceLabel || options.untitledLabel;
}

export function getScheduleItemSourceLabel(
	material: ScheduleItem,
	labels: { epubSource: string; pdfSource: string; sourceDocument: string },
): string {
	if (isEpubBookmarkTaskId(material.id)) {
		return labels.epubSource;
	}

	if (isPdfBookmarkTaskId(material.id)) {
		return labels.pdfSource;
	}

	return labels.sourceDocument;
}

export function buildIRCalendarSearchContext(params: {
	app: App;
	readingMaterials: ReadingMaterial[];
	irDecks: IRDeck[];
	materialTagLabelsById: Record<string, string[]>;
	parentTitleByMaterialId?: Record<string, string>;
	resolveCanonicalDeckId: (deckId: string) => string;
}): IRCalendarSearchContext {
	return {
		app: params.app,
		readingMaterials: params.readingMaterials,
		irDecks: params.irDecks,
		materialTagLabelsById: params.materialTagLabelsById,
		parentTitleByMaterialId: params.parentTitleByMaterialId,
		resolveCanonicalDeckId: params.resolveCanonicalDeckId,
	};
}
