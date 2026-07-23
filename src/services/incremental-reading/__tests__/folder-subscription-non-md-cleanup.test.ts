import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	cleanupFolderSubscriptionNonMarkdownAutoSubscribedEntries,
	collectFolderSubscriptionNonMarkdownAutoSubscribedChunks,
	isFolderSubscriptionNonMarkdownAutoSubscribedChunk,
	resetFolderSubscriptionNonMarkdownCleanupSessionStateForTests,
	type FolderSubscriptionNonMarkdownCleanupDeps,
} from "../folder-subscription-non-md-cleanup";

describe("isFolderSubscriptionNonMarkdownAutoSubscribedChunk", () => {
	it("matches auto-subscribed image chunks", () => {
		expect(
			isFolderSubscriptionNonMarkdownAutoSubscribedChunk({
				chunkId: "img-1",
				filePath: "Inbox/cover.png",
				meta: {
					externalDocument: true,
					autoSubscribedAt: "2026-07-01T00:00:00.000Z",
					autoSubscribedFolderPath: "Inbox",
					readingMaterialId: "mat-1",
				},
			}),
		).toBe(true);
	});

	it("keeps markdown auto-subscribed chunks", () => {
		expect(
			isFolderSubscriptionNonMarkdownAutoSubscribedChunk({
				chunkId: "md-1",
				filePath: "Inbox/article.md",
				meta: {
					externalDocument: true,
					autoSubscribedAt: "2026-07-01T00:00:00.000Z",
				},
			}),
		).toBe(false);
	});

	it("keeps non-md chunks without auto-subscription markers", () => {
		expect(
			isFolderSubscriptionNonMarkdownAutoSubscribedChunk({
				chunkId: "pdf-1",
				filePath: "Books/manual.pdf",
				meta: { externalDocument: true },
			}),
		).toBe(false);
	});

	it("keeps explicitly non-external documents even with markers", () => {
		expect(
			isFolderSubscriptionNonMarkdownAutoSubscribedChunk({
				chunkId: "x-1",
				filePath: "Inbox/photo.jpg",
				meta: {
					externalDocument: false,
					autoSubscribedAt: "2026-07-01T00:00:00.000Z",
				},
			}),
		).toBe(false);
	});
});

describe("collectFolderSubscriptionNonMarkdownAutoSubscribedChunks", () => {
	it("collects only matching chunk ids", () => {
		const collected = collectFolderSubscriptionNonMarkdownAutoSubscribedChunks({
			"img-1": {
				chunkId: "img-1",
				filePath: "Inbox/a.png",
				meta: { autoSubscribedFolderPath: "Inbox", externalDocument: true },
			},
			"md-1": {
				chunkId: "md-1",
				filePath: "Inbox/a.md",
				meta: { autoSubscribedFolderPath: "Inbox", externalDocument: true },
			},
			"pdf-manual": {
				chunkId: "pdf-manual",
				filePath: "Inbox/b.pdf",
				meta: { externalDocument: true },
			},
		});
		expect(collected.map((entry) => entry.chunkId)).toEqual(["img-1"]);
	});
});

describe("cleanupFolderSubscriptionNonMarkdownAutoSubscribedEntries", () => {
	beforeEach(() => {
		resetFolderSubscriptionNonMarkdownCleanupSessionStateForTests();
	});

	function createDeps(
		chunks: Record<string, any>,
	): FolderSubscriptionNonMarkdownCleanupDeps & {
		deleteChunk: ReturnType<typeof vi.fn>;
		deleteMaterial: ReturnType<typeof vi.fn>;
		getAllChunks: ReturnType<typeof vi.fn>;
	} {
		return {
			getAllChunks: vi.fn(async () => chunks),
			deleteChunk: vi.fn(async () => undefined),
			resolveMaterialIdForChunk: (chunk) =>
				String(chunk.meta?.readingMaterialId || "").trim() || null,
			deleteMaterial: vi.fn(async () => true),
		};
	}

	it("deletes matching chunks and linked materials once per session", async () => {
		const deps = createDeps({
			"img-1": {
				chunkId: "img-1",
				filePath: "Inbox/cover.png",
				meta: {
					externalDocument: true,
					autoSubscribedAt: "2026-07-01T00:00:00.000Z",
					readingMaterialId: "mat-img",
				},
			},
			"keep-md": {
				chunkId: "keep-md",
				filePath: "Inbox/note.md",
				meta: {
					externalDocument: true,
					autoSubscribedAt: "2026-07-01T00:00:00.000Z",
					readingMaterialId: "mat-md",
				},
			},
		});

		const first = await cleanupFolderSubscriptionNonMarkdownAutoSubscribedEntries(
			{} as any,
			{ deps },
		);
		const second =
			await cleanupFolderSubscriptionNonMarkdownAutoSubscribedEntries(
				{} as any,
				{ deps },
			);

		expect(first.deletedChunks).toBe(1);
		expect(first.deletedChunkIds).toEqual(["img-1"]);
		expect(first.deletedMaterialIds).toEqual(["mat-img"]);
		expect(second.skippedAsSessionComplete).toBe(true);
		expect(second.deletedChunks).toBe(0);
		expect(deps.getAllChunks).toHaveBeenCalledTimes(1);
		expect(deps.deleteChunk).toHaveBeenCalledTimes(1);
		expect(deps.deleteChunk).toHaveBeenCalledWith("img-1");
		expect(deps.deleteMaterial).toHaveBeenCalledWith("mat-img");
		expect(deps.deleteMaterial).not.toHaveBeenCalledWith("mat-md");
	});

	it("retries later in the session when a delete fails", async () => {
		const deps = createDeps({
			"img-1": {
				chunkId: "img-1",
				filePath: "Inbox/cover.png",
				meta: {
					externalDocument: true,
					autoSubscribedAt: "2026-07-01T00:00:00.000Z",
					readingMaterialId: "mat-img",
				},
			},
		});
		deps.deleteChunk
			.mockRejectedValueOnce(new Error("transient"))
			.mockResolvedValueOnce(undefined);

		const first = await cleanupFolderSubscriptionNonMarkdownAutoSubscribedEntries(
			{} as any,
			{ deps },
		);
		const second =
			await cleanupFolderSubscriptionNonMarkdownAutoSubscribedEntries(
				{} as any,
				{ deps },
			);

		expect(first.deletedChunks).toBe(0);
		expect(second.deletedChunks).toBe(1);
		expect(deps.deleteChunk).toHaveBeenCalledTimes(2);
	});
});
