import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { scheduleDebouncedRecomputeAndBroadcastIRData } from "../IRScheduleRecomputeCoordinator";

describe("IRScheduleRecomputeCoordinator", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		recomputeScheduleForDeckMock.mockResolvedValue({
			generatedAt: 999,
			deckIds: ["deck-1"],
			days: [],
			itemsByDate: new Map(),
		});
		(globalThis as any).window = {
			dispatchEvent: vi.fn(),
		};
		(globalThis as any).CustomEvent = class TestCustomEvent<T = unknown> {
			type: string;
			detail: T;
			constructor(type: string, init?: { detail?: T }) {
				this.type = type;
				this.detail = init?.detail as T;
			}
		};
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("merges multiple complete_block requests into one recompute", async () => {
		const app = {} as any;
		const first = scheduleDebouncedRecomputeAndBroadcastIRData(app, "complete_block", {
			deckIds: ["deck-1"],
			priorityDateKeys: ["2026-06-18"],
			leanSchedule: true,
		});
		const second = scheduleDebouncedRecomputeAndBroadcastIRData(app, "complete_block", {
			deckIds: ["deck-1"],
			priorityDateKeys: ["2026-06-19"],
			leanSchedule: true,
		});

		await vi.advanceTimersByTimeAsync(750);

		const [firstDetail, secondDetail] = await Promise.all([first, second]);
		expect(recomputeScheduleForDeckMock).toHaveBeenCalledTimes(1);
		expect(recomputeScheduleForDeckMock).toHaveBeenCalledWith(
			"complete_block",
			expect.objectContaining({
				deckIds: ["deck-1"],
				priorityDateKeys: expect.arrayContaining(["2026-06-18", "2026-06-19"]),
				leanSchedule: true,
			})
		);
		expect(firstDetail.generatedAt).toBe(999);
		expect(secondDetail.generatedAt).toBe(999);
	});

	it("does not debounce import_materials", async () => {
		const app = {} as any;
		await scheduleDebouncedRecomputeAndBroadcastIRData(app, "import_materials", {
			deckIds: ["deck-2"],
		});
		expect(recomputeScheduleForDeckMock).toHaveBeenCalledTimes(1);
	});
});
