import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IRPointSnapshot } from "../../../types/ir-point-storage-types";

const listPointSnapshotsMock = vi.fn();
const syncLegacyPointMock = vi.fn();

vi.mock("../IRPointStorageService", () => ({
	getSharedIRPointStorageService: () => ({
		listPointSnapshots: listPointSnapshotsMock,
		syncLegacyPoint: syncLegacyPointMock,
	}),
}));

import { IRLegacyPointUnificationService } from "../IRLegacyPointUnificationService";

function createLegacyMarkdownSnapshot(id: string): IRPointSnapshot {
	return {
		topicId: "topic-1",
		topicName: "Topic 1",
		material: {
			id: "material-1",
			source: {
				path: "Notes/Source.md",
				type: "markdown",
			},
			bibliography: {
				title: "Source Title",
			},
		} as IRPointSnapshot["material"],
		point: {
			id,
			materialId: "material-1",
			pointType: "selection-entry",
			source: {
				type: "markdown",
				path: "Notes/Source.md",
				title: "Source Title",
			},
			trace: {
				locatorType: "markdown-selection",
				locator: {
					sourcePath: "Notes/Source.md",
					filePath: "Notes/Source.md",
				},
			},
			relations: {
				topicIds: ["topic-1"],
			},
			userData: {
				title: "Legacy point",
			},
			schedule: {
				status: "scheduled",
				manualPriority: 5,
				priorityScore: 5,
				intervalDays: 3,
			},
			stats: {
				totalReadingTimeMs: 0,
				impressionCount: 0,
				reviewCount: 0,
				extractCount: 0,
				cardCreatedCount: 0,
				noteCreatedCount: 0,
			},
			timestamps: {
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-02T00:00:00.000Z",
			},
		},
	} as IRPointSnapshot;
}

function createChunkSnapshot(id: string): IRPointSnapshot {
	return {
		topicId: "topic-1",
		topicName: "Topic 1",
		material: {
			id: "material-2",
			source: {
				path: "Notes/Source.md",
				type: "markdown",
			},
		} as IRPointSnapshot["material"],
		point: {
			id,
			materialId: "material-2",
			pointType: "chunk-entry",
			source: {
				type: "markdown",
				path: "Notes/Source.md",
				title: "Source Title",
			},
			trace: {
				locatorType: "markdown-chunk",
				locator: {
					sourcePath: "Notes/Source.md",
					filePath: "Notes/Source.md",
				},
			},
			schedule: {
				status: "scheduled",
			},
			timestamps: {
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-02T00:00:00.000Z",
			},
		},
	} as IRPointSnapshot;
}

describe("IRLegacyPointUnificationService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		syncLegacyPointMock.mockResolvedValue(undefined);
	});

	it("scanPointFormats 统计 legacy-block 数量", async () => {
		listPointSnapshotsMock.mockResolvedValue([
			createLegacyMarkdownSnapshot("legacy-1"),
			createChunkSnapshot("chunk-1"),
		]);

		const service = new IRLegacyPointUnificationService({} as any);
		const result = await service.scanPointFormats();

		expect(result.totalCount).toBe(2);
		expect(result.legacyBlockCount).toBe(1);
		expect(result.chunkCount).toBe(1);
	});

	it("migrateLegacyBlockPointsToChunkFormat 只升级 legacy-block", async () => {
		listPointSnapshotsMock.mockResolvedValue([
			createLegacyMarkdownSnapshot("legacy-1"),
			createChunkSnapshot("chunk-1"),
		]);

		const service = new IRLegacyPointUnificationService({} as any);
		const result = await service.migrateLegacyBlockPointsToChunkFormat();

		expect(result.migrated).toBe(1);
		expect(result.failed).toBe(0);
		expect(syncLegacyPointMock).toHaveBeenCalledTimes(1);
		expect(syncLegacyPointMock).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "legacy-1",
				pointType: "chunk-entry",
				sourceType: "ir-chunk",
			})
		);
	});
});
