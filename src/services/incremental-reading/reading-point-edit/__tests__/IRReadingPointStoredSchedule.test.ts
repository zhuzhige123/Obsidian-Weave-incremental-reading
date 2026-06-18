import { describe, expect, it, vi } from "vitest";
import { resolveReadingPointStoredSchedule } from "../IRReadingPointStoredSchedule";

const storageSpies = {
	initialize: vi.fn(),
	getChunkData: vi.fn(),
	getBlock: vi.fn(),
};

const pointStorageSpies = {
	initialize: vi.fn(),
	getPointSnapshotById: vi.fn(),
};

const pointReadSpies = {
	getPointTopicIds: vi.fn(),
	getPointStorage: vi.fn(),
};

vi.mock("../../IRStorageService", () => ({
	IRStorageService: class {
		initialize = storageSpies.initialize;
		getChunkData = storageSpies.getChunkData;
		getBlock = storageSpies.getBlock;
	},
}));

vi.mock("../../IRPointDataReadService", () => ({
	IRPointDataReadService: class {
		getPointTopicIds = pointReadSpies.getPointTopicIds;
		getPointStorage = () => pointStorageSpies;
	},
}));

vi.mock("../../IRPdfBookmarkTaskService", () => ({
	isPdfBookmarkTaskId: () => false,
	IRPdfBookmarkTaskService: class {},
}));

vi.mock("../../IREpubBookmarkTaskService", () => ({
	isEpubBookmarkTaskId: () => false,
	IREpubBookmarkTaskService: class {},
}));

describe("resolveReadingPointStoredSchedule", () => {
	it("prefers chunk storage over projected calendar values", async () => {
		storageSpies.initialize.mockResolvedValue(undefined);
		pointStorageSpies.initialize.mockResolvedValue(undefined);
		pointReadSpies.getPointTopicIds.mockResolvedValue(["deck-a"]);
		pointStorageSpies.getPointSnapshotById.mockResolvedValue({
			topicId: "deck-a",
			point: {
				schedule: {
					manualPriority: 8,
					nextReviewAt: "2026-06-20T00:00:00.000Z",
				},
			},
		});
		storageSpies.getChunkData.mockResolvedValue({
			chunkId: "chunk-1",
			topicIds: ["deck-a"],
			priorityUi: 5,
			nextRepDate: Date.parse("2026-06-14T00:00:00.000Z"),
		});
		storageSpies.getBlock.mockResolvedValue(null);

		const schedule = await resolveReadingPointStoredSchedule({} as any, "chunk-1");

		expect(schedule).toEqual({
			priority: 5,
			nextRepDate: Date.parse("2026-06-14T00:00:00.000Z"),
			deckId: "deck-a",
		});
	});
});
