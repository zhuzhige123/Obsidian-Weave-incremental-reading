import { beforeEach, describe, expect, it, vi } from "vitest";

const hasFreshProjectionMock = vi.fn();
const peekScheduleFingerprintMock = vi.fn();
const tryGetCalendarShellMock = vi.fn();
const tryGetTier0Mock = vi.fn();
const tryGetStaleDiskMock = vi.fn();
const tryHydrateMonthHeatmapMock = vi.fn();

vi.mock("../IRCalendarDayIndexService", () => ({
	getSharedIRCalendarDayIndexService: () => ({
		hasFreshProjectionForPriorityDates: hasFreshProjectionMock,
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
		warmDiskCache: vi.fn().mockResolvedValue(true),
		getScheduleSources: vi.fn().mockResolvedValue({ scheduleFingerprint: "schedule-fp" }),
	}),
}));

import { getSharedIRProjectionRuntime } from "../IRProjectionRuntime";

describe("IRProjectionRuntime", () => {
	const app = {} as import("obsidian").App;

	beforeEach(() => {
		vi.clearAllMocks();
		getSharedIRProjectionRuntime(app).markStale();
		hasFreshProjectionMock.mockResolvedValue(false);
		peekScheduleFingerprintMock.mockResolvedValue("schedule-fp");
	});

	it("skips background reconcile when projection fingerprints and slices are fresh", async () => {
		hasFreshProjectionMock.mockResolvedValue(true);

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

	it("ensureReady hydrates month heatmap and priority dates without duplicate preload", async () => {
		const materialsByDate = new Map([["2026-06-19", [{ id: "p1" } as never]]]);
		tryGetCalendarShellMock.mockResolvedValue({
			result: { materialsByDate },
			daySummaries: new Map([["2026-06-19", { totalCount: 1 }]]),
		});
		tryHydrateMonthHeatmapMock.mockResolvedValue(new Map([["2026-06", { "2026-06-19": 2 }]]));

		const runtime = getSharedIRProjectionRuntime(app);
		const result = await runtime.ensureReady({
			minLevel: "R1_day",
			priorityDateKeys: ["2026-06-19"],
			monthKeys: ["2026-06"],
		});

		expect(result.level).toBe("R2_month");
		expect(result.projection?.source).toBe("day_index");
		expect(result.monthHeatmap?.get("2026-06")).toEqual({ "2026-06-19": 2 });
	});
});
