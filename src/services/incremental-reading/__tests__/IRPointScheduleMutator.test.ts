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

import { IRPointScheduleMutator } from "../IRPointScheduleMutator";

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
