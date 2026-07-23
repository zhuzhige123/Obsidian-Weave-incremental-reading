import { describe, expect, it } from "vitest";
import type { ScheduleItem } from "../../../services/incremental-reading/IRCalendarScheduleItem";
import { buildScheduleItemFromChunkData } from "../../../services/incremental-reading/IRCalendarScheduleItem";
import { parseDateRange, parseSearchQuery } from "../../../utils/search-parser";
import { formatCalendarDateKey } from "../ir-calendar-date";
import {
	getScheduleItemCreatedDate,
	getScheduleItemDueDate,
	getScheduleItemModifiedDate,
	matchesFolderFilters,
	matchesPriorityValues,
	matchesSearchQueryForMaterial,
	matchesTagFilters,
	type IRCalendarSearchContext,
} from "../ir-calendar-search-logic";

function makeScheduleItem(
	overrides: Partial<ScheduleItem> & Pick<ScheduleItem, "id">,
): ScheduleItem {
	return {
		id: overrides.id,
		title: overrides.title || "Point",
		sourceFile: overrides.sourceFile || "Notes/old-note.md",
		priority: overrides.priority ?? 5,
		intervalDays: overrides.intervalDays ?? 1,
		scheduleStatus: overrides.scheduleStatus || "new",
		nextRepDate: overrides.nextRepDate ?? 0,
		nextReviewDate: overrides.nextReviewDate ?? null,
		...overrides,
	};
}

function makeContext(
	overrides: Partial<IRCalendarSearchContext> = {},
): IRCalendarSearchContext {
	return {
		app: {
			vault: {
				getAbstractFileByPath: () => null,
			},
			metadataCache: {
				getFileCache: () => null,
				getCache: () => null,
			},
		} as unknown as IRCalendarSearchContext["app"],
		readingMaterials: [
			{
				uuid: "mat-1",
				filePath: "Notes/old-note.md",
				created: "2020-01-01",
				modified: "2020-01-02",
			} as IRCalendarSearchContext["readingMaterials"][number],
		],
		irDecks: [
			{ id: "deck-a", name: "Alpha" } as IRCalendarSearchContext["irDecks"][number],
		],
		materialTagLabelsById: {},
		resolveCanonicalDeckId: (deckId: string) => deckId,
		...overrides,
	};
}

const emptySearchContext = makeContext();

describe("getScheduleItemCreatedDate", () => {
	it("uses reading-point createdAt, not source material/file creation", () => {
		const today = new Date();
		const todayKey = formatCalendarDateKey(today);
		const item = makeScheduleItem({
			id: "chunk-today",
			createdAt: today.getTime(),
			sourceFile: "Notes/old-note.md",
		});

		expect(getScheduleItemCreatedDate(item)).toBe(todayKey);
	});

	it("returns empty when point createdAt is missing", () => {
		const item = makeScheduleItem({ id: "chunk-missing" });
		expect(getScheduleItemCreatedDate(item)).toBe("");
	});
});

describe("getScheduleItemModifiedDate / dueDate", () => {
	it("uses point updatedAt for modified:", () => {
		const stamp = new Date(2026, 6, 16, 10, 0, 0).getTime();
		const item = makeScheduleItem({
			id: "chunk-mod",
			updatedAt: stamp,
		});
		expect(getScheduleItemModifiedDate(item)).toBe("2026-07-16");
	});

	it("uses local calendar day for due:", () => {
		const due = new Date(2026, 6, 16, 23, 30, 0);
		const item = makeScheduleItem({
			id: "chunk-due",
			nextRepDate: due.getTime(),
			nextReviewDate: due,
		});
		expect(getScheduleItemDueDate(item)).toBe("2026-07-16");
	});
});

describe("created: search filter", () => {
	it("matches points added today even when source note is old", () => {
		const today = new Date();
		const todayKey = formatCalendarDateKey(today);
		const todayItem = makeScheduleItem({
			id: "chunk-today",
			createdAt: today.getTime(),
			sourceFile: "Notes/old-note.md",
		});
		const olderItem = makeScheduleItem({
			id: "chunk-old",
			createdAt: new Date(2020, 0, 1).getTime(),
			sourceFile: "Notes/old-note.md",
		});
		const query = parseSearchQuery(`created:${todayKey}`);

		expect(
			matchesSearchQueryForMaterial(todayItem, query, emptySearchContext),
		).toBe(true);
		expect(
			matchesSearchQueryForMaterial(olderItem, query, emptySearchContext),
		).toBe(false);
	});

	it("filters two points on the same source independently by createdAt", () => {
		const early = makeScheduleItem({
			id: "chunk-a",
			createdAt: new Date(2026, 5, 1, 9, 0, 0).getTime(),
			sourceFile: "Notes/shared.md",
		});
		const late = makeScheduleItem({
			id: "chunk-b",
			createdAt: new Date(2026, 6, 16, 9, 0, 0).getTime(),
			sourceFile: "Notes/shared.md",
		});
		const query = parseSearchQuery("created:2026-07-16");

		expect(matchesSearchQueryForMaterial(early, query, emptySearchContext)).toBe(
			false,
		);
		expect(matchesSearchQueryForMaterial(late, query, emptySearchContext)).toBe(
			true,
		);
	});
});

describe("folder / tag / priority / due / state filters", () => {
	it("matches folder: against source path prefixes", () => {
		const inside = makeScheduleItem({
			id: "in",
			sourceFile: "Books/Fiction/a.md",
		});
		const outside = makeScheduleItem({
			id: "out",
			sourceFile: "Notes/a.md",
		});
		const query = parseSearchQuery('folder:"Books/Fiction"');

		expect(matchesFolderFilters("Books/Fiction/a.md", ["Books/Fiction"])).toBe(
			true,
		);
		expect(
			matchesSearchQueryForMaterial(inside, query, emptySearchContext),
		).toBe(true);
		expect(
			matchesSearchQueryForMaterial(outside, query, emptySearchContext),
		).toBe(false);
	});

	it("matches tags exactly (not accidental substrings)", () => {
		expect(matchesTagFilters(["apple", "fruit"], ["a"])).toBe(false);
		expect(matchesTagFilters(["apple", "fruit"], ["apple"])).toBe(true);
		expect(matchesTagFilters(["topic/math"], ["math"])).toBe(true);

		const ctx = makeContext({
			materialTagLabelsById: {
				"chunk-1": ["apple"],
				"chunk-2": ["pineapple"],
			},
		});
		const query = parseSearchQuery("tag:apple");
		expect(
			matchesSearchQueryForMaterial(
				makeScheduleItem({ id: "chunk-1" }),
				query,
				ctx,
			),
		).toBe(true);
		expect(
			matchesSearchQueryForMaterial(
				makeScheduleItem({ id: "chunk-2" }),
				query,
				ctx,
			),
		).toBe(false);
	});

	it("matches continuous priority floats", () => {
		expect(matchesPriorityValues(2.5, [2.5])).toBe(true);
		expect(matchesPriorityValues(2.5, [2])).toBe(false);

		const query = parseSearchQuery("priority:2.5");
		expect(query.priorities).toEqual([2.5]);
		expect(query.text).toEqual([]);
		expect(
			matchesSearchQueryForMaterial(
				makeScheduleItem({ id: "p", priority: 2.5 }),
				query,
				emptySearchContext,
			),
		).toBe(true);
		expect(
			matchesSearchQueryForMaterial(
				makeScheduleItem({ id: "p2", priority: 2 }),
				query,
				emptySearchContext,
			),
		).toBe(false);
	});

	it("treats overdue due:<today as exclusive of today", () => {
		const today = new Date(2026, 6, 16, 12, 0, 0);
		const todayKey = formatCalendarDateKey(today);
		const query = parseSearchQuery(`due:<${todayKey}`);
		expect(parseDateRange(`<${todayKey}`)).toEqual({ to: "2026-07-15" });

		const dueToday = makeScheduleItem({
			id: "today",
			nextRepDate: today.getTime(),
			nextReviewDate: today,
		});
		const overdue = makeScheduleItem({
			id: "old",
			nextRepDate: new Date(2026, 6, 15, 12, 0, 0).getTime(),
			nextReviewDate: new Date(2026, 6, 15, 12, 0, 0),
		});

		expect(
			matchesSearchQueryForMaterial(dueToday, query, emptySearchContext),
		).toBe(false);
		expect(
			matchesSearchQueryForMaterial(overdue, query, emptySearchContext),
		).toBe(true);
	});

	it("supports -state: exclusion and merges status/state includes", () => {
		const active = makeScheduleItem({
			id: "a",
			scheduleStatus: "active",
		});
		const suspended = makeScheduleItem({
			id: "s",
			scheduleStatus: "suspended",
		});

		const excludeQuery = parseSearchQuery("-state:suspended");
		expect(excludeQuery.excludeStatuses).toEqual(["suspended"]);
		expect(
			matchesSearchQueryForMaterial(active, excludeQuery, emptySearchContext),
		).toBe(true);
		expect(
			matchesSearchQueryForMaterial(
				suspended,
				excludeQuery,
				emptySearchContext,
			),
		).toBe(false);

		const includeQuery = parseSearchQuery("state:active");
		expect(
			matchesSearchQueryForMaterial(active, includeQuery, emptySearchContext),
		).toBe(true);
		expect(
			matchesSearchQueryForMaterial(
				suspended,
				includeQuery,
				emptySearchContext,
			),
		).toBe(false);
	});
});

describe("buildScheduleItemFromChunkData timestamps", () => {
	it("propagates chunk createdAt/updatedAt onto ScheduleItem", () => {
		const createdAt = new Date(2026, 6, 16, 8, 0, 0).getTime();
		const updatedAt = new Date(2026, 6, 16, 12, 0, 0).getTime();
		const item = buildScheduleItemFromChunkData({
			chunkId: "chunk-1",
			sourceId: "src-1",
			filePath: "Notes/a.md",
			priorityEff: 5,
			intervalDays: 1,
			nextRepDate: 0,
			scheduleStatus: "new",
			stats: {} as never,
			meta: {} as never,
			createdAt,
			updatedAt,
		});

		expect(item.createdAt).toBe(createdAt);
		expect(item.updatedAt).toBe(updatedAt);
		expect(getScheduleItemCreatedDate(item)).toBe("2026-07-16");
	});
});
