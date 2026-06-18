import { beforeEach, describe, expect, it, vi } from "vitest";

const hydrateMonthMock = vi.fn();
const hydratePriorityMock = vi.fn();
const shouldSkipMock = vi.fn();
const getCalendarQueryResultMock = vi.fn();
const tryGetTier0Mock = vi.fn();
const runHeavyLoadMock = vi.fn();

vi.mock("../IRProjectionRuntime", () => ({
	getSharedIRProjectionRuntime: () => ({
		ensureReady: vi.fn(async () => ({
			level: "R2_month",
			monthHeatmap: new Map([["2026-06", { "2026-06-19": 3 }]]),
			projection: {
				materialsByDate: new Map([["2026-06-19", [{ id: "p1" } as never]]]),
				daySummaries: new Map([["2026-06-19", { totalCount: 1 }]]),
				source: "day_index",
			},
		})),
		hydrateMonthHeatmapFromProjection: hydrateMonthMock,
		hydratePriorityDatesFromProjection: hydratePriorityMock,
		shouldSkipBackgroundReconcile: shouldSkipMock,
		preloadColdStartCaches: vi.fn().mockResolvedValue(undefined),
		markStale: vi.fn(),
	}),
}));

vi.mock("../IRCalendarQueryService", () => ({
	getSharedIRCalendarQueryService: () => ({
		tryGetTier0CalendarResult: tryGetTier0Mock,
		getCalendarQueryResult: getCalendarQueryResultMock,
	}),
}));

vi.mock("../IRCalendarBackgroundLoadCoordinator", () => ({
	getSharedIRCalendarBackgroundLoadCoordinator: () => ({
		runHeavyLoad: runHeavyLoadMock,
	}),
}));

import {
	hydrateIRCalendarMonthHeatmap,
	loadIRCalendarView,
} from "../IRCalendarViewLoadService";

describe("IRCalendarViewLoadService", () => {
	const app = {} as import("obsidian").App;

	beforeEach(() => {
		vi.clearAllMocks();
		hydrateMonthMock.mockResolvedValue(new Map([["2026-06", { "2026-06-19": 3 }]]));
		hydratePriorityMock.mockResolvedValue({
			materialsByDate: new Map([["2026-06-19", [{ id: "p1" } as never]]]),
			daySummaries: new Map([["2026-06-19", { totalCount: 1 }]]),
			source: "day_index",
		});
		shouldSkipMock.mockResolvedValue(true);
		tryGetTier0Mock.mockResolvedValue(null);
		runHeavyLoadMock.mockImplementation(async (_owner: string, task: () => Promise<unknown>) => task());
	});

	it("returns shell_only when projection exists even if reconcile is not skipped", async () => {
		shouldSkipMock.mockResolvedValue(false);

		const result = await loadIRCalendarView(app, {
			priorityDateKeys: ["2026-06-19"],
			monthKeys: ["2026-06"],
		});

		expect(result.phase).toBe("shell_only");
		expect(result.projectionHydrate?.source).toBe("day_index");
		expect(shouldSkipMock).toHaveBeenCalled();
		expect(tryGetTier0Mock).not.toHaveBeenCalled();
		expect(getCalendarQueryResultMock).not.toHaveBeenCalled();
	});

	it("returns shell_only when projection and skip reconcile", async () => {
		const result = await loadIRCalendarView(app, {
			priorityDateKeys: ["2026-06-19"],
			monthKeys: ["2026-06"],
		});

		expect(result.phase).toBe("shell_only");
		expect(result.projectionHydrate?.source).toBe("day_index");
		expect(result.fastQuery).toBeNull();
		expect(result.tier0).toBeNull();
		expect(shouldSkipMock).toHaveBeenCalled();
		expect(tryGetTier0Mock).not.toHaveBeenCalled();
	});

	it("hydrates month heatmap via projection runtime", async () => {
		const heatmap = await hydrateIRCalendarMonthHeatmap(app, undefined, ["2026-06"]);
		expect(heatmap?.get("2026-06")).toEqual({ "2026-06-19": 3 });
		expect(hydrateMonthMock).toHaveBeenCalledWith(undefined, ["2026-06"]);
	});
});
