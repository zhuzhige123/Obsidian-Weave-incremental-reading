import { beforeEach, describe, expect, it, vi } from "vitest";
import { IRReadingPointTopicMigrationService } from "../IRReadingPointTopicMigrationService";

const pointReadSpies = {
	getPointTopicIds: vi.fn(),
	getPointStorage: vi.fn(),
};

const pointStorageSpies = {
	initialize: vi.fn(),
	updatePointTopicIds: vi.fn(),
	getPointSnapshotById: vi.fn(),
};

const storageSpies = {
	initialize: vi.fn(),
	getAllDecks: vi.fn(),
	getChunkData: vi.fn(),
	getBlock: vi.fn(),
	updateChunkDecks: vi.fn(),
	saveBlock: vi.fn(),
};

const pdfSpies = {
	initialize: vi.fn(),
	getTask: vi.fn(),
	updateTask: vi.fn(),
};

const epubSpies = {
	initialize: vi.fn(),
	getTask: vi.fn(),
	updateTask: vi.fn(),
};

const pointWriteSpies = {
	updateDecks: vi.fn(),
};

vi.mock("../../IRPointDataReadService", () => ({
	IRPointDataReadService: class {
		getPointTopicIds = pointReadSpies.getPointTopicIds;
		getPointStorage = () => pointStorageSpies;
	},
}));

vi.mock("../../IRPointStorageService", () => ({
	IRPointStorageService: class {
		initialize = pointStorageSpies.initialize;
		updatePointTopicIds = pointStorageSpies.updatePointTopicIds;
		getPointSnapshotById = pointStorageSpies.getPointSnapshotById;
	},
}));

vi.mock("../../IRStorageService", () => ({
	IRStorageService: class {
		initialize = storageSpies.initialize;
		getAllDecks = storageSpies.getAllDecks;
		getChunkData = storageSpies.getChunkData;
		getBlock = storageSpies.getBlock;
		updateChunkDecks = storageSpies.updateChunkDecks;
		saveBlock = storageSpies.saveBlock;
	},
}));

vi.mock("../../IRPdfBookmarkTaskService", () => ({
	isPdfBookmarkTaskId: (id: string) => id.startsWith("pdfbm-"),
	IRPdfBookmarkTaskService: class {
		initialize = pdfSpies.initialize;
		getTask = pdfSpies.getTask;
		updateTask = pdfSpies.updateTask;
	},
}));

vi.mock("../../IREpubBookmarkTaskService", () => ({
	isEpubBookmarkTaskId: (id: string) => id.startsWith("epubbm-"),
	IREpubBookmarkTaskService: class {
		initialize = epubSpies.initialize;
		getTask = epubSpies.getTask;
		updateTask = epubSpies.updateTask;
	},
}));

vi.mock("../../IRPointWriteService", () => ({
	IRPointWriteService: class {
		updateDecks = pointWriteSpies.updateDecks;
	},
}));

describe("IRReadingPointTopicMigrationService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		storageSpies.initialize.mockResolvedValue(undefined);
		pointStorageSpies.initialize.mockResolvedValue(undefined);
		pdfSpies.initialize.mockResolvedValue(undefined);
		epubSpies.initialize.mockResolvedValue(undefined);
		storageSpies.getAllDecks.mockResolvedValue({
			"deck-a": { id: "deck-a", name: "Topic A" },
			"deck-b": { id: "deck-b", name: "Topic B" },
		});
		pointReadSpies.getPointTopicIds.mockResolvedValue(["deck-a"]);
		pointStorageSpies.updatePointTopicIds.mockResolvedValue(true);
	});

	it("moves pdf points via task update and point storage without duplicate deck writes", async () => {
		pdfSpies.getTask.mockResolvedValue({
			id: "pdfbm-1",
			pdfPath: "Docs/Test.pdf",
			topicId: "deck-a",
			deckId: "deck-a",
		});
		pdfSpies.updateTask.mockResolvedValue({
			id: "pdfbm-1",
			pdfPath: "Docs/Test.pdf",
			topicId: "deck-b",
			deckId: "deck-b",
		});
		storageSpies.getChunkData.mockResolvedValue(null);
		storageSpies.getBlock.mockResolvedValue(null);
		pointStorageSpies.getPointSnapshotById.mockResolvedValue(null);

		const service = new IRReadingPointTopicMigrationService({} as any);
		const result = await service.movePointToTopic({
			pointId: "pdfbm-1",
			targetDeckId: "deck-b",
			sourceTypeHint: "pdf",
		});

		expect(result.changed).toBe(true);
		expect(result.kind).toBe("pdf");
		expect(pdfSpies.updateTask).toHaveBeenCalledTimes(1);
		expect(pointStorageSpies.updatePointTopicIds).toHaveBeenCalledWith(
			"pdfbm-1",
			["deck-b"],
			expect.any(Object),
		);
		expect(pointWriteSpies.updateDecks).not.toHaveBeenCalled();
	});

	it("moves chunk points via updateChunkDecks and skips redundant point sync when already aligned", async () => {
		storageSpies.getChunkData.mockResolvedValue({
			chunkId: "chunk-1",
			filePath: "Notes/chunk.md",
			topicIds: ["deck-a"],
		});
		storageSpies.getBlock.mockResolvedValue(null);
		pointStorageSpies.getPointSnapshotById.mockResolvedValue(null);
		pointReadSpies.getPointTopicIds
			.mockResolvedValueOnce(["deck-a"])
			.mockResolvedValueOnce(["deck-b"]);

		const service = new IRReadingPointTopicMigrationService({} as any);
		const result = await service.movePointToTopic({
			pointId: "chunk-1",
			targetDeckId: "deck-b",
			sourceTypeHint: "chunk",
		});

		expect(result.changed).toBe(true);
		expect(result.kind).toBe("chunk");
		expect(storageSpies.updateChunkDecks).toHaveBeenCalledWith("chunk-1", [
			"deck-b",
		]);
		expect(pointStorageSpies.updatePointTopicIds).not.toHaveBeenCalled();
	});

	it("supports point-only records without legacy chunk/block/pdf backing", async () => {
		storageSpies.getChunkData.mockResolvedValue(null);
		storageSpies.getBlock.mockResolvedValue(null);
		pointStorageSpies.getPointSnapshotById.mockResolvedValue({
			topicId: "deck-a",
			point: { id: "point-only-1", relations: { topicIds: ["deck-a"] } },
		});

		const service = new IRReadingPointTopicMigrationService({} as any);
		const result = await service.movePointToTopic({
			pointId: "point-only-1",
			targetDeckId: "deck-b",
		});

		expect(result.changed).toBe(true);
		expect(result.kind).toBe("point");
		expect(pointStorageSpies.updatePointTopicIds).toHaveBeenCalledWith(
			"point-only-1",
			["deck-b"],
			expect.any(Object),
		);
	});
});
