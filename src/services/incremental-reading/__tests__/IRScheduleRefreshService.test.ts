
const invalidateScheduleCacheMock = vi.fn();
const recomputeScheduleForDeckMock = vi.fn();
const workspaceInvalidateMock = vi.fn();
const calendarInvalidateMock = vi.fn();
const scheduleIndexInvalidateMock = vi.fn();
const projectionSyncMock = vi.fn();

vi.mock("../IRScheduleKernel", () => ({
	getSharedIRScheduleKernel: () => ({
		invalidateScheduleCache: invalidateScheduleCacheMock,
		recomputeScheduleForDeck: recomputeScheduleForDeckMock,
	}),
}));

vi.mock("../IRWorkspaceSnapshotService", () => ({
	getSharedIRWorkspaceSnapshotService: () => ({
		invalidate: workspaceInvalidateMock,
		getWorkspaceData: vi.fn().mockResolvedValue({
			generatedAt: 1,
			decksRecord: {},
			blocksRecord: {},
			chunksRecord: {},
			sourcesRecord: {},
			history: {},
			pdfTasks: [],
			epubTasks: [],
		}),
	}),
}));

vi.mock("../IRCalendarQueryService", () => ({
	getSharedIRCalendarQueryService: () => ({
		invalidate: calendarInvalidateMock,
		getSettingsFingerprint: () => "settings-fp",
		buildQueryCacheKeyForDeckIds: () => "__all__::__default__",
	}),
}));

vi.mock("../IRScheduleIndexService", () => ({
	getSharedIRScheduleIndexService: () => ({
		invalidate: scheduleIndexInvalidateMock,
	}),
}));

vi.mock("../IRCalendarDayIndexService", () => ({
	getSharedIRCalendarDayIndexService: () => ({
		syncFromMaterialsByDate: projectionSyncMock,
	}),
}));

vi.mock("../../../utils/logger", () => ({
	logger: {
		error: vi.fn(),
		debug: vi.fn(),
	},
}));

import {
	broadcastIRDataUpdated,
	IR_DATA_UPDATED_EVENT,
	recomputeAndBroadcastIRData,
} from "../IRScheduleRefreshService";

const originalWindow = (globalThis as any).window;
const originalCustomEvent = (globalThis as any).CustomEvent;

class TestCustomEvent<T = unknown> {
	type: string;
	detail: T;

	constructor(type: string, init?: { detail?: T }) {
		this.type = type;
		this.detail = init?.detail as T;
	}
}

describe("IRScheduleRefreshService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		recomputeScheduleForDeckMock.mockResolvedValue({
			generatedAt: 123456,
			deckIds: ["deck-1"],
			days: [],
			itemsByDate: new Map(),
		});
		(globalThis as any).window = {
			dispatchEvent: vi.fn(),
		};
		(globalThis as any).CustomEvent = TestCustomEvent;
	});

	afterEach(() => {
		(globalThis as any).window = originalWindow;
		(globalThis as any).CustomEvent = originalCustomEvent;
	});

	it("invalidates schedule cache before recomputing and broadcasts the fresh detail", async () => {
		recomputeScheduleForDeckMock.mockResolvedValue({
			generatedAt: 123456,
			deckIds: ["deck-1"],
			days: [{ dateKey: "2026-05-29", items: [{ id: "a", title: "A", sourceFile: "a.md", priority: 1, intervalDays: 1, scheduleStatus: "scheduled", nextRepDate: 0, nextReviewDate: null, topicKey: "t", estimatedMinutes: 1, explanation: {} as any }] }],
			itemsByDate: new Map([
				[
					"2026-05-29",
					[
						{
							id: "a",
							title: "A",
							sourceFile: "a.md",
							priority: 1,
							intervalDays: 1,
							scheduleStatus: "scheduled",
							nextRepDate: 0,
							nextReviewDate: null,
							topicKey: "t",
							estimatedMinutes: 1,
							explanation: {} as any,
						},
					],
				],
			]),
		});
		const detail = await recomputeAndBroadcastIRData({} as any, "import_materials", {
			deckIds: ["deck-1"],
			priorityDateKeys: ["2026-05-29"],
		});

		expect(workspaceInvalidateMock).toHaveBeenCalledTimes(1);
		expect(scheduleIndexInvalidateMock).toHaveBeenCalledTimes(1);
		expect(calendarInvalidateMock).toHaveBeenCalledTimes(1);
		expect(invalidateScheduleCacheMock).toHaveBeenCalledTimes(1);
		expect(recomputeScheduleForDeckMock).toHaveBeenCalledWith("import_materials", {
			deckIds: ["deck-1"],
			priorityDateKeys: ["2026-05-29"],
		});
		expect(invalidateScheduleCacheMock.mock.invocationCallOrder[0]).toBeLessThan(
			recomputeScheduleForDeckMock.mock.invocationCallOrder[0]
		);
		expect(detail.reason).toBe("import_materials");
		expect(detail.generatedAt).toBe(123456);
		expect(detail.deckIds).toEqual(["deck-1"]);
		expect(detail.priorityDateKeys).toContain("2026-05-29");
		expect(projectionSyncMock).toHaveBeenCalled();
		expect((globalThis as any).window.dispatchEvent).toHaveBeenCalledTimes(1);
		const [event] = (globalThis as any).window.dispatchEvent.mock.calls[0];
		expect(event.type).toBe(IR_DATA_UPDATED_EVENT);
		expect(event.detail).toEqual(detail);
	});

	it("broadcasts a lightweight IR update while invalidating caches", () => {
		const detail = broadcastIRDataUpdated({} as any, {
			reason: "ui_refresh",
			deckIds: ["deck-2"],
		});

		expect(workspaceInvalidateMock).toHaveBeenCalledTimes(1);
		expect(scheduleIndexInvalidateMock).toHaveBeenCalledTimes(1);
		expect(calendarInvalidateMock).toHaveBeenCalledTimes(1);
		expect(invalidateScheduleCacheMock).toHaveBeenCalledTimes(1);
		expect(detail.reason).toBe("ui_refresh");
		expect(detail.deckIds).toEqual(["deck-2"]);
		expect(typeof detail.generatedAt).toBe("number");
	});

	it("uses calendar-only invalidation when priorityDateKeys are provided", () => {
		broadcastIRDataUpdated({} as any, {
			reason: "metadata_changed",
			priorityDateKeys: ["2026-05-29"],
		});

		expect(workspaceInvalidateMock).not.toHaveBeenCalled();
		expect(scheduleIndexInvalidateMock).not.toHaveBeenCalled();
		expect(calendarInvalidateMock).toHaveBeenCalledWith({
			priorityDateKeys: ["2026-05-29"],
		});
		expect(invalidateScheduleCacheMock).toHaveBeenCalledTimes(1);
	});

	it("can skip schedule cache invalidation for lightweight UI-only broadcasts", () => {
		const detail = broadcastIRDataUpdated({} as any, {
			reason: "ui_refresh",
			invalidateScheduleCache: false,
		});

		expect(workspaceInvalidateMock).toHaveBeenCalledTimes(1);
		expect(invalidateScheduleCacheMock).not.toHaveBeenCalled();
		expect(detail.reason).toBe("ui_refresh");
	});
});
