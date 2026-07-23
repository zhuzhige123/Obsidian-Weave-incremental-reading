import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	hasFreshProjectionMock,
	tryHydrateDateKeysMock,
	peekScheduleFingerprintMock,
	tryGetCalendarShellMock,
	tryGetTier0Mock,
	tryGetStaleDiskMock,
	tryHydrateMonthHeatmapMock,
	getPointIdsForDateMock,
	mergeDueIndexMock,
	getCalendarProgressMock,
} = vi.hoisted(() => ({
	hasFreshProjectionMock: vi.fn(),
	tryHydrateDateKeysMock: vi.fn(),
	peekScheduleFingerprintMock: vi.fn(),
	tryGetCalendarShellMock: vi.fn(),
	tryGetTier0Mock: vi.fn(),
	tryGetStaleDiskMock: vi.fn(),
	tryHydrateMonthHeatmapMock: vi.fn(),
	getPointIdsForDateMock: vi.fn(),
	mergeDueIndexMock: vi.fn(),
	getCalendarProgressMock: vi.fn(),
}));

vi.mock("../IRCalendarDayIndexService", () => ({
	getSharedIRCalendarDayIndexService: () => ({
		hasFreshProjectionForPriorityDates: hasFreshProjectionMock,
		tryHydrateDateKeys: tryHydrateDateKeysMock,
		tryHydrateMonthHeatmap: tryHydrateMonthHeatmapMock,
		warmDiskCache: vi.fn().mockResolvedValue(true),
	}),
}));

vi.mock("../IRCalendarQueryService", () => ({
	getSharedIRCalendarQueryService: () => ({
		getSettingsFingerprint: () => "settings-fp",
		buildQueryCacheKeyForDeckIds: () => "__all__::__default__",
		tryGetCalendarShellFromDayIndex: tryGetCalendarShellMock,
		tryGetTier0CalendarResult: tryGetTier0Mock,
		tryGetStaleDiskCalendarResult: tryGetStaleDiskMock,
	}),
}));

vi.mock("../IRPointStorageService", () => ({
	getSharedIRPointStorageService: () => ({
		initialize: vi.fn().mockResolvedValue(undefined),
		getPointFilesIndexRevision: vi.fn().mockResolvedValue("revision"),
	}),
}));

vi.mock("../IRScheduleIndexService", () => ({
	getSharedIRScheduleIndexService: () => ({
		peekScheduleFingerprint: peekScheduleFingerprintMock,
		peekWarmScheduleSources: vi.fn().mockResolvedValue(null),
		warmDiskCache: vi.fn().mockResolvedValue(true),
		getScheduleSources: vi
			.fn()
			.mockResolvedValue({ scheduleFingerprint: "schedule-fp" }),
	}),
}));

vi.mock("../IRStorageService", () => ({
	IRStorageService: class {
		initialize = vi.fn().mockResolvedValue(undefined);
		getCalendarProgress = getCalendarProgressMock;
	},
}));

vi.mock("../IRDueDateIndexService", () => ({
	getSharedIRDueDateIndexService: () => ({
		getPointIdsForDate: getPointIdsForDateMock,
		getCalendarDuePointIdsForDate: getPointIdsForDateMock,
		warmDiskCache: vi.fn().mockResolvedValue(true),
		isMemoryStoreEmpty: vi.fn().mockReturnValue(false),
		rebuildFromWarmScheduleSources: vi.fn().mockResolvedValue(undefined),
	}),
}));

vi.mock("../IRDueDateDayHydrateService", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../IRDueDateDayHydrateService")>();
	return {
		...actual,
		mergeDueIndexIntoPriorityProjection: mergeDueIndexMock,
	};
});

import { getSharedIRProjectionRuntime } from "../IRProjectionRuntime";

describe("IRProjectionRuntime", () => {
	const app = {} as import("obsidian").App;

	beforeEach(() => {
		vi.clearAllMocks();
		getSharedIRProjectionRuntime(app).markStale();
		hasFreshProjectionMock.mockResolvedValue(false);
		peekScheduleFingerprintMock.mockResolvedValue("schedule-fp");
		getPointIdsForDateMock.mockResolvedValue([]);
		getCalendarProgressMock.mockResolvedValue({});
		tryHydrateDateKeysMock.mockResolvedValue({
			materialsByDate: new Map([["2026-06-19", [{ id: "p1" }]]]),
			daySummaries: new Map([["2026-06-19", { totalCount: 1 }]]),
		});
		mergeDueIndexMock.mockImplementation(
			async (
				_app: unknown,
				input: {
					materialsByDate: Map<string, unknown>;
					daySummaries: Map<string, unknown>;
				},
			) => ({
				materialsByDate: input.materialsByDate,
				daySummaries: input.daySummaries,
				filledDateKeys: [],
			}),
		);
	});

	it("tracks L1 day-queue freshness and clears it on markStale", () => {
		const runtime = getSharedIRProjectionRuntime(app);
		runtime.markL1DayQueueFresh(["2026-06-19"]);
		expect(runtime.isL1DayQueueFresh("2026-06-19")).toBe(true);
		expect(runtime.filterOutL1FreshDateKeys(["2026-06-19", "2026-06-20"])).toEqual([
			"2026-06-20",
		]);
		runtime.markStale();
		expect(runtime.isL1DayQueueFresh("2026-06-19")).toBe(false);
	});

	it("skips background reconcile when projection fingerprints and slices are fresh", async () => {
		hasFreshProjectionMock.mockResolvedValue(true);
		getPointIdsForDateMock.mockResolvedValue(["p1"]);

		const runtime = getSharedIRProjectionRuntime(app);
		const skip = await runtime.shouldSkipBackgroundReconcile({
			priorityDateKeys: ["2026-06-19"],
		});

		expect(skip).toBe(true);
		expect(hasFreshProjectionMock).toHaveBeenCalledWith({
			cacheKey: "__all__::__default__",
			settingsFingerprint: "settings-fp",
			scheduleFingerprint: "schedule-fp",
			dateKeys: ["2026-06-19"],
		});
	});

	it("does not skip when due index has more points than projection slices", async () => {
		hasFreshProjectionMock.mockResolvedValue(true);
		getPointIdsForDateMock.mockResolvedValue(["p1", "p2"]);
		tryHydrateDateKeysMock.mockResolvedValue({
			materialsByDate: new Map([["2026-06-19", [{ id: "p1" }]]]),
			daySummaries: new Map([["2026-06-19", { totalCount: 1 }]]),
		});

		const runtime = getSharedIRProjectionRuntime(app);
		const skip = await runtime.shouldSkipBackgroundReconcile({
			priorityDateKeys: ["2026-06-19"],
		});

		expect(skip).toBe(false);
	});

	it("does not skip when slice IDs equal count but differ from due IDs", async () => {
		hasFreshProjectionMock.mockResolvedValue(true);
		getPointIdsForDateMock.mockResolvedValue(["due-a", "due-b"]);
		tryHydrateDateKeysMock.mockResolvedValue({
			materialsByDate: new Map([
				["2026-06-19", [{ id: "plan-x" }, { id: "plan-y" }]],
			]),
			daySummaries: new Map([["2026-06-19", { totalCount: 2 }]]),
		});

		const runtime = getSharedIRProjectionRuntime(app);
		const skip = await runtime.shouldSkipBackgroundReconcile({
			priorityDateKeys: ["2026-06-19"],
		});

		expect(skip).toBe(false);
	});

	it("skips when slice contains completed sunk items absent from due index", async () => {
		hasFreshProjectionMock.mockResolvedValue(true);
		getPointIdsForDateMock.mockResolvedValue(["due-open"]);
		getCalendarProgressMock.mockResolvedValue({
			"2026-06-19": ["done-sunk"],
		});
		tryHydrateDateKeysMock.mockResolvedValue({
			materialsByDate: new Map([
				["2026-06-19", [{ id: "due-open" }, { id: "done-sunk" }]],
			]),
			daySummaries: new Map([["2026-06-19", { totalCount: 2 }]]),
		});

		const runtime = getSharedIRProjectionRuntime(app);
		const skip = await runtime.shouldSkipBackgroundReconcile({
			priorityDateKeys: ["2026-06-19"],
		});

		expect(skip).toBe(true);
	});

	it("does not skip when forceRecompute is requested", async () => {
		hasFreshProjectionMock.mockResolvedValue(true);

		const runtime = getSharedIRProjectionRuntime(app);
		const skip = await runtime.shouldSkipBackgroundReconcile({
			priorityDateKeys: ["2026-06-19"],
			forceRecompute: true,
		});

		expect(skip).toBe(false);
		expect(hasFreshProjectionMock).not.toHaveBeenCalled();
	});

	it("session-skips only when schedule fingerprint matches exactly", async () => {
		hasFreshProjectionMock.mockResolvedValue(true);
		getPointIdsForDateMock.mockResolvedValue(["p1"]);
		const runtime = getSharedIRProjectionRuntime(app);
		runtime.markBackgroundReconcileComplete(
			{ priorityDateKeys: ["2026-06-19"] },
			"schedule-fp",
		);

		const skipHit = await runtime.shouldSkipBackgroundReconcile({
			priorityDateKeys: ["2026-06-19"],
		});
		expect(skipHit).toBe(true);
		expect(hasFreshProjectionMock).not.toHaveBeenCalled();

		hasFreshProjectionMock.mockClear();
		runtime.markBackgroundReconcileComplete(
			{ priorityDateKeys: ["2026-06-19"] },
			"schedule-fp-old",
		);
		const skipMiss = await runtime.shouldSkipBackgroundReconcile({
			priorityDateKeys: ["2026-06-19"],
		});
		// 指纹变了：不得 startsWith 误命中，须重新走 freshness / due 对账。
		expect(hasFreshProjectionMock).toHaveBeenCalled();
		expect(skipMiss).toBe(true);
	});

	it("ensureReady hydrates month heatmap and priority dates without duplicate preload", async () => {
		const materialsByDate = new Map([["2026-06-19", [{ id: "p1" } as never]]]);
		tryGetCalendarShellMock.mockResolvedValue({
			result: { materialsByDate },
			daySummaries: new Map([["2026-06-19", { totalCount: 1 }]]),
		});
		tryHydrateMonthHeatmapMock.mockResolvedValue(
			new Map([["2026-06", { "2026-06-19": 2 }]]),
		);

		const runtime = getSharedIRProjectionRuntime(app);
		const result = await runtime.ensureReady({
			minLevel: "R1_day",
			priorityDateKeys: ["2026-06-19"],
			monthKeys: ["2026-06"],
		});

		expect(result.level).toBe("R2_month");
		expect(result.projection?.source).toBe("day_index");
		expect(result.monthHeatmap?.get("2026-06")).toEqual({ "2026-06-19": 2 });
		// 有壳也要 warm-only due 补洞，避免今日切片为空时只剩历史回顾。
		expect(mergeDueIndexMock).toHaveBeenCalledWith(
			app,
			expect.objectContaining({
				allowPointSnapshotFallback: false,
			}),
		);
	});
});
