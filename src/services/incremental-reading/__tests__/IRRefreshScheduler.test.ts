import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const shouldSkipMock = vi.fn();
const getCalendarQueryResultMock = vi.fn();
const runHeavyLoadMock = vi.fn();
const notifyMock = vi.fn();
const markCompleteMock = vi.fn();

vi.mock("../IRScheduleIndexService", () => ({
	getSharedIRScheduleIndexService: () => ({
		peekScheduleFingerprint: vi.fn().mockResolvedValue("schedule-test"),
	}),
}));

vi.mock("../IRProjectionRuntime", () => ({
	getSharedIRProjectionRuntime: () => ({
		shouldSkipBackgroundReconcile: shouldSkipMock,
		preloadColdStartCaches: vi.fn().mockResolvedValue(undefined),
		notify: notifyMock,
		markBackgroundReconcileComplete: markCompleteMock,
	}),
}));

vi.mock("../IRCalendarQueryService", () => ({
	getSharedIRCalendarQueryService: () => ({
		getCalendarQueryResult: getCalendarQueryResultMock,
	}),
}));

vi.mock("../IRCalendarBackgroundLoadCoordinator", () => ({
	getSharedIRCalendarBackgroundLoadCoordinator: () => ({
		runHeavyLoad: runHeavyLoadMock,
	}),
}));

vi.mock("../../../utils/logger", () => ({
	logger: {
		debug: vi.fn(),
		warn: vi.fn(),
	},
}));

import { getSharedIRRefreshScheduler } from "../IRRefreshScheduler";

describe("IRRefreshScheduler", () => {
	const app = {} as import("obsidian").App;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		shouldSkipMock.mockResolvedValue(false);
		getCalendarQueryResultMock.mockResolvedValue({
			materialsByDate: new Map([["2026-06-19", [{ id: "chunk-1" }]]]),
		});
		runHeavyLoadMock.mockImplementation(
			async (_owner: string, task: () => Promise<unknown>) => task(),
		);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("debounces calendar-reconcile and runs lean query", async () => {
		const scheduler = getSharedIRRefreshScheduler(app);
		scheduler.scheduleCalendarReconcile({
			priorityDateKeys: ["2026-06-19"],
			reason: "test",
		});

		await vi.advanceTimersByTimeAsync(1999);
		expect(getCalendarQueryResultMock).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		await vi.runAllTimersAsync();

		expect(getCalendarQueryResultMock).toHaveBeenCalledWith(
			expect.objectContaining({
				includeReadingMaterials: false,
				priorityDateKeys: ["2026-06-19"],
			}),
		);
		expect(markCompleteMock).toHaveBeenCalled();
		expect(notifyMock).toHaveBeenCalledWith(
			expect.objectContaining({
				reconciledMaterialsByDate: expect.any(Map),
			}),
		);
	});

	it("does not enqueue reconcile when projection is already fresh", async () => {
		shouldSkipMock.mockResolvedValue(true);
		const scheduler = getSharedIRRefreshScheduler(app);

		scheduler.scheduleCalendarReconcile({
			priorityDateKeys: ["2026-06-19"],
		});
		await vi.runAllTimersAsync();

		expect(getCalendarQueryResultMock).not.toHaveBeenCalled();
	});

	it("notifies reconcileFailed when background query throws", async () => {
		getCalendarQueryResultMock.mockRejectedValue(new Error("query failed"));
		const scheduler = getSharedIRRefreshScheduler(app);

		scheduler.scheduleCalendarReconcile({
			priorityDateKeys: ["2026-06-19"],
			reason: "test-failure",
		});
		await vi.runAllTimersAsync();

		expect(notifyMock).toHaveBeenCalledWith(
			expect.objectContaining({
				reconcileFailed: true,
				reason: "test-failure",
			}),
		);
	});
});
