import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	cleanupIRDeckGhostPoints,
	resetIRDeckGhostPointCleanupSessionStateForTests,
} from "../IRDeckGhostPointCleanup";

const initializeMock = vi.fn();
const listPointSnapshotsMock = vi.fn();
const deletePointByLegacyIdMock = vi.fn();

vi.mock("../IRPointStorageService", () => ({
	getSharedIRPointStorageService: () => ({
		initialize: initializeMock,
		listPointSnapshots: listPointSnapshotsMock,
		deletePointByLegacyId: deletePointByLegacyIdMock,
	}),
}));

describe("IRDeckGhostPointCleanup", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetIRDeckGhostPointCleanupSessionStateForTests();
		initializeMock.mockResolvedValue(undefined);
		deletePointByLegacyIdMock.mockResolvedValue(true);
	});

	it("deletes snapshots whose title or source path is an .irdeck file", async () => {
		listPointSnapshotsMock.mockResolvedValue([
			{
				point: {
					id: "ghost-title",
					source: { path: "", title: "五月份的书籍阅读.irdeck" },
					userData: { title: "五月份的书籍阅读.irdeck" },
					metadata: {},
					trace: { locator: {} },
				},
				material: null,
			},
			{
				point: {
					id: "ghost-path",
					source: {
						path: "Topics/五月份的书籍阅读.irdeck",
						title: "Book",
					},
					userData: { title: "Book" },
					metadata: {},
					trace: { locator: {} },
				},
				material: null,
			},
			{
				point: {
					id: "keep",
					source: { path: "Books/novel.md", title: "Novel" },
					userData: { title: "Novel" },
					metadata: {},
					trace: { locator: {} },
				},
				material: null,
			},
		]);

		const result = await cleanupIRDeckGhostPoints({} as any);

		expect(result.deleted).toBe(2);
		expect(result.deletedIds).toEqual(["ghost-title", "ghost-path"]);
		expect(deletePointByLegacyIdMock).toHaveBeenCalledWith("ghost-title");
		expect(deletePointByLegacyIdMock).toHaveBeenCalledWith("ghost-path");
		expect(deletePointByLegacyIdMock).not.toHaveBeenCalledWith("keep");
	});

	it("does not retry the same point id twice in one session", async () => {
		deletePointByLegacyIdMock.mockResolvedValue(true);

		const first = await cleanupIRDeckGhostPoints({} as any, {
			pointIds: ["ghost-1"],
		});
		const second = await cleanupIRDeckGhostPoints({} as any, {
			pointIds: ["ghost-1"],
		});

		expect(first.deleted).toBe(1);
		expect(second.deleted).toBe(0);
		expect(deletePointByLegacyIdMock).toHaveBeenCalledTimes(1);
	});
});
