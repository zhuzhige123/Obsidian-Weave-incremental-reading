import { beforeEach, describe, expect, test, vi } from "vitest";

const {
	getPointIdsForDateMock,
	peekWarmScheduleSourcesMock,
	getPointSnapshotByIdMock,
	isMemoryStoreEmptyMock,
} = vi.hoisted(() => ({
	getPointIdsForDateMock: vi.fn(),
	peekWarmScheduleSourcesMock: vi.fn(),
	getPointSnapshotByIdMock: vi.fn(),
	isMemoryStoreEmptyMock: vi.fn(),
}));

vi.mock("../IRDueDateIndexService", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("../IRDueDateIndexService")>();
	return {
		...actual,
		getSharedIRDueDateIndexService: () => ({
			getPointIdsForDate: getPointIdsForDateMock,
			getCalendarDuePointIdsForDate: getPointIdsForDateMock,
			warmDiskCache: vi.fn().mockResolvedValue(true),
			isMemoryStoreEmpty: isMemoryStoreEmptyMock,
		}),
	};
});

vi.mock("../IRScheduleIndexService", () => ({
	getSharedIRScheduleIndexService: () => ({
		peekWarmScheduleSources: peekWarmScheduleSourcesMock,
	}),
}));

vi.mock("../IRPointStorageService", () => ({
	getSharedIRPointStorageService: () => ({
		initialize: vi.fn().mockResolvedValue(undefined),
		getPointSnapshotById: getPointSnapshotByIdMock,
	}),
}));

import {
	hydratePriorityDatesFromDueIndex,
	mergeDueIndexIntoPriorityProjection,
} from "../IRDueDateDayHydrateService";
import type { ScheduleItem } from "../IRCalendarScheduleItem";

describe("IRDueDateDayHydrateService", () => {
	const app = {} as import("obsidian").App;

	beforeEach(() => {
		vi.clearAllMocks();
		getPointIdsForDateMock.mockResolvedValue([]);
		peekWarmScheduleSourcesMock.mockResolvedValue(null);
		getPointSnapshotByIdMock.mockResolvedValue(null);
		isMemoryStoreEmptyMock.mockReturnValue(false);
	});

	test("hydrates day list from warm schedule index via due ids", async () => {
		getPointIdsForDateMock.mockImplementation(async (dateKey: string) =>
			dateKey === "2026-07-14" ? ["chunk-a", "chunk-b"] : [],
		);
		peekWarmScheduleSourcesMock.mockResolvedValue({
			chunks: [
				{
					chunkId: "chunk-a",
					filePath: "notes/a.md",
					nextRepDate: Date.parse("2026-07-14T00:00:00"),
					priorityUi: 7,
					priorityEff: 7,
					intervalDays: 1,
					scheduleStatus: "queued",
					meta: {},
				},
				{
					chunkId: "chunk-b",
					filePath: "notes/b.md",
					nextRepDate: Date.parse("2026-07-14T00:00:00"),
					priorityUi: 3,
					priorityEff: 3,
					intervalDays: 1,
					scheduleStatus: "queued",
					meta: {},
				},
			],
			blocks: [],
			pdfTasks: [],
			epubTasks: [],
			scheduleFingerprint: "fp",
			generatedAt: Date.now(),
			fromCache: true,
		});

		const result = await hydratePriorityDatesFromDueIndex(app, {
			dateKeys: ["2026-07-14"],
			todayKey: "2026-07-14",
		});

		expect(result.hydratedDateKeys).toEqual(["2026-07-14"]);
		expect(result.materialsByDate.get("2026-07-14")).toHaveLength(2);
		expect(result.daySummaries.get("2026-07-14")?.totalCount).toBe(2);
		expect(getPointSnapshotByIdMock).not.toHaveBeenCalled();
	});

	test("mergeDueIndex fills empty projection when due has points", async () => {
		getPointIdsForDateMock.mockResolvedValue(["chunk-a"]);
		peekWarmScheduleSourcesMock.mockResolvedValue({
			chunks: [
				{
					chunkId: "chunk-a",
					filePath: "notes/a.md",
					nextRepDate: Date.parse("2026-07-14T00:00:00"),
					priorityUi: 5,
					priorityEff: 5,
					intervalDays: 1,
					scheduleStatus: "queued",
					meta: {},
				},
			],
			blocks: [],
			pdfTasks: [],
			epubTasks: [],
			scheduleFingerprint: "fp",
			generatedAt: Date.now(),
			fromCache: true,
		});

		const merged = await mergeDueIndexIntoPriorityProjection(app, {
			dateKeys: ["2026-07-14"],
			materialsByDate: new Map([["2026-07-14", [] as ScheduleItem[]]]),
			daySummaries: new Map([["2026-07-14", { totalCount: 0 }]]),
			todayKey: "2026-07-14",
		});

		expect(merged.filledDateKeys).toEqual(["2026-07-14"]);
		expect(merged.materialsByDate.get("2026-07-14")).toHaveLength(1);
	});

	test("empty due store does not wipe existing shell materials", async () => {
		isMemoryStoreEmptyMock.mockReturnValue(true);
		getPointIdsForDateMock.mockResolvedValue([]);
		const existing = [
			{
				id: "shell-a",
				title: "keep",
			} as ScheduleItem,
		];

		const merged = await mergeDueIndexIntoPriorityProjection(app, {
			dateKeys: ["2026-07-14"],
			materialsByDate: new Map([["2026-07-14", existing]]),
			daySummaries: new Map([["2026-07-14", { totalCount: 1 }]]),
		});

		expect(merged.filledDateKeys).toEqual([]);
		expect(merged.materialsByDate.get("2026-07-14")).toEqual(existing);
	});

	test("allowPointSnapshotFallback false skips per-point irdeck reads", async () => {
		getPointIdsForDateMock.mockResolvedValue(["missing-a", "missing-b"]);
		peekWarmScheduleSourcesMock.mockResolvedValue({
			chunks: [],
			blocks: [],
			pdfTasks: [],
			epubTasks: [],
			scheduleFingerprint: "fp",
			generatedAt: Date.now(),
			fromCache: true,
		});
		getPointSnapshotByIdMock.mockResolvedValue({
			point: { id: "missing-a" },
		});

		const result = await hydratePriorityDatesFromDueIndex(app, {
			dateKeys: ["2026-07-14"],
			allowPointSnapshotFallback: false,
			todayKey: "2026-07-14",
		});

		expect(result.hydratedDateKeys).toEqual([]);
		expect(getPointSnapshotByIdMock).not.toHaveBeenCalled();
	});

	test("warm-only partial hydrate keeps existing due ids instead of shrinking", async () => {
		getPointIdsForDateMock.mockResolvedValue(["warm-a", "cold-b"]);
		peekWarmScheduleSourcesMock.mockResolvedValue({
			chunks: [
				{
					chunkId: "warm-a",
					filePath: "notes/a.md",
					nextRepDate: Date.parse("2026-07-14T00:00:00"),
					priorityUi: 5,
					priorityEff: 5,
					intervalDays: 1,
					scheduleStatus: "queued",
					meta: {},
				},
			],
			blocks: [],
			pdfTasks: [],
			epubTasks: [],
			scheduleFingerprint: "fp",
			generatedAt: Date.now(),
			fromCache: true,
		});

		const existing = [
			{
				id: "warm-a",
				title: "warm",
			} as ScheduleItem,
			{
				id: "cold-b",
				title: "keep-me",
			} as ScheduleItem,
		];

		const merged = await mergeDueIndexIntoPriorityProjection(app, {
			dateKeys: ["2026-07-14"],
			materialsByDate: new Map([["2026-07-14", existing]]),
			daySummaries: new Map([["2026-07-14", { totalCount: 2 }]]),
			allowPointSnapshotFallback: false,
			todayKey: "2026-07-14",
		});

		const ids = (merged.materialsByDate.get("2026-07-14") || []).map(
			(item) => item.id,
		);
		expect(ids).toContain("warm-a");
		expect(ids).toContain("cold-b");
		expect(ids).toHaveLength(2);
	});

	test("past-day merge strips open overdue that belong on today", async () => {
		getPointIdsForDateMock.mockImplementation(async (dateKey: string) =>
			dateKey === "2026-07-19" ? ["overdue-open"] : [],
		);
		peekWarmScheduleSourcesMock.mockResolvedValue({
			chunks: [
				{
					chunkId: "overdue-open",
					filePath: "notes/overdue.md",
					nextRepDate: Date.parse("2026-07-19T00:00:00"),
					priorityUi: 5,
					priorityEff: 5,
					intervalDays: 1,
					scheduleStatus: "queued",
					meta: {},
				},
			],
			blocks: [],
			pdfTasks: [],
			epubTasks: [],
			scheduleFingerprint: "fp",
			generatedAt: Date.now(),
			fromCache: true,
		});

		const existing = [
			{
				id: "overdue-open",
				title: "should leave past day",
				nextRepDate: Date.parse("2026-07-19T00:00:00"),
				scheduleStatus: "queued",
			} as ScheduleItem,
		];

		const merged = await mergeDueIndexIntoPriorityProjection(app, {
			dateKeys: ["2026-07-19"],
			materialsByDate: new Map([["2026-07-19", existing]]),
			daySummaries: new Map([["2026-07-19", { totalCount: 1 }]]),
			todayKey: "2026-07-23",
			allowPointSnapshotFallback: false,
		});

		expect(merged.materialsByDate.get("2026-07-19") || []).toEqual([]);
		expect(merged.filledDateKeys).toContain("2026-07-19");
	});
});
