import { beforeEach, describe, expect, it, vi } from "vitest";

const updateChunkScheduleMock = vi.fn();
const initializeMock = vi.fn();
const getChunkDataMock = vi.fn();

vi.mock("../IRStorageService", () => ({
	IRStorageService: class MockIRStorageService {
		initialize = initializeMock.mockResolvedValue(undefined);
		getChunkData = getChunkDataMock;
		getBlock = vi.fn();
		invalidateScheduleRuntimeCaches = vi.fn();
	},
}));

vi.mock("../IRChunkScheduleAdapter", () => ({
	IRChunkScheduleAdapter: class MockChunkAdapter {
		updateChunkSchedule = updateChunkScheduleMock;
	},
}));

vi.mock("../IRStorageAdapterV4", () => ({
	IRStorageAdapterV4: class MockAdapterV4 {},
}));

vi.mock("../IRPdfBookmarkTaskService", () => ({
	IRPdfBookmarkTaskService: class MockPdf {
		initialize = vi.fn().mockResolvedValue(undefined);
		updateTaskFromBlock = vi.fn();
	},
	isPdfBookmarkTaskId: () => false,
}));

vi.mock("../IREpubBookmarkTaskService", () => ({
	IREpubBookmarkTaskService: class MockEpub {
		initialize = vi.fn().mockResolvedValue(undefined);
		updateTaskFromBlock = vi.fn();
	},
	isEpubBookmarkTaskId: () => false,
}));

vi.mock("../IRDueDateIndexService", () => ({
	getSharedIRDueDateIndexService: () => ({
		updatePointDueDate: vi.fn().mockResolvedValue(undefined),
		flushPendingWrites: vi.fn().mockResolvedValue(undefined),
	}),
}));

vi.mock("../IRCalendarQueryService", () => ({
	getSharedIRCalendarQueryService: () => ({
		invalidate: vi.fn(),
	}),
}));

vi.mock("../IRWorkspaceSnapshotService", () => ({
	getSharedIRWorkspaceSnapshotService: () => ({
		invalidate: vi.fn(),
	}),
}));

vi.mock("../IRScheduleIndexService", () => ({
	getSharedIRScheduleIndexService: () => ({
		invalidate: vi.fn(),
		getScheduleSources: vi.fn().mockResolvedValue({
			scheduleFingerprint: "fp-test",
			chunks: [],
			blocks: [],
			pdfTasks: [],
			epubTasks: [],
			generatedAt: Date.now(),
			fromCache: true,
		}),
	}),
}));

import { IRPointScheduleMutator, applyScheduleMutationToBlock } from "../IRPointScheduleMutator";

describe("applyScheduleMutationToBlock", () => {
	it("keeps postpone/pin fields in meta only", () => {
		const next = applyScheduleMutationToBlock(
			{
				id: "pdf::bookmark::1",
				nextRepDate: 1000,
				intervalDays: 3,
				status: "queued",
				priorityUi: 5,
				priorityEff: 5,
				meta: { tagGroup: "default" },
			} as any,
			{
				nextRepDate: 2000,
				scheduleStatus: "queued",
				manualSchedulePinnedDateKey: "2026-09-05",
				manualPostponeCount: 1,
			},
		);

		expect(next.nextRepDate).toBe(2000);
		expect(next.status).toBe("queued");
		expect(next.meta?.manualSchedulePinnedDateKey).toBe("2026-09-05");
		expect(next.meta?.manualPostponeCount).toBe(1);
		expect((next as any).manualPostponeCount).toBeUndefined();
		expect((next as any).manualSchedulePinnedDateKey).toBeUndefined();
		expect((next as any).scheduleStatus).toBeUndefined();
	});

	it("clears postpone count when set to 0", () => {
		const next = applyScheduleMutationToBlock(
			{
				id: "chunk-1",
				nextRepDate: 1000,
				meta: { tagGroup: "default", manualPostponeCount: 2 },
			} as any,
			{ manualPostponeCount: 0 },
		);
		expect(next.meta?.manualPostponeCount).toBeUndefined();
	});
});

describe("IRPointScheduleMutator", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeMock.mockResolvedValue(undefined);
		getChunkDataMock.mockResolvedValue({ chunkId: "chunk-1" });
		updateChunkScheduleMock.mockResolvedValue(undefined);
	});

	it("writes chunk schedule via chunk adapter", async () => {
		const service = new IRPointScheduleMutator({} as any);
		await service.mutateFromBlock(
			{
				id: "chunk-1",
				nextRepDate: 1000,
			} as any,
			{ nextRepDate: 2000, scheduleStatus: "scheduled" },
		);

		expect(updateChunkScheduleMock).toHaveBeenCalledWith(
			"chunk-1",
			expect.objectContaining({
				nextRepDate: 2000,
				scheduleStatus: "scheduled",
			}),
			expect.objectContaining({ skipScheduleCacheInvalidate: true }),
		);
	});
});
