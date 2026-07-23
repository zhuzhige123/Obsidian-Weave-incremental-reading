import { describe, expect, it, vi } from "vitest";
import { createDefaultChunkFileData } from "../../../../types/ir-types";
import { resolveReadingTargetSchedulePin } from "../IRReadingTargetScheduleDate";
import {
	ensureVaultReadingTargetScheduled,
	vaultChunkMatchesReadingTarget,
} from "../IRReadingTargetVaultChunk";

describe("vaultChunkMatchesReadingTarget", () => {
	it("matches block-ref chunks by file path and block id in resumeLink", () => {
		const chunk = createDefaultChunkFileData(
			"chunk-1",
			"vault-src",
			"Notes/Demo.md",
		);
		chunk.meta = {
			...(chunk.meta || {}),
			externalDocument: true,
			resumeLink: "[[Notes/Demo.md#^abc123|段落]]",
		};

		expect(
			vaultChunkMatchesReadingTarget(chunk, {
				sourcePath: "Notes/Demo.md",
				blockId: "abc123",
				resumeLink: "[[Notes/Demo.md#^abc123|段落]]",
			}),
		).toBe(true);
		expect(
			vaultChunkMatchesReadingTarget(chunk, {
				sourcePath: "Notes/Demo.md",
				blockId: "other",
				resumeLink: "[[Notes/Demo.md#^other]]",
			}),
		).toBe(false);
	});

	it("ignores canvas-node chunks on the same path", () => {
		const chunk = createDefaultChunkFileData(
			"chunk-1",
			"vault-src",
			"Boards/Topic.canvas",
		);
		chunk.meta = {
			...(chunk.meta || {}),
			externalDocument: true,
			canvasNodeId: "node-1",
			resumeLink: "[[Boards/Topic.canvas#^node-1]]",
		};

		expect(
			vaultChunkMatchesReadingTarget(chunk, {
				sourcePath: "Boards/Topic.canvas",
				resumeLink: "[[Boards/Topic.canvas]]",
			}),
		).toBe(false);
	});
});

describe("ensureVaultReadingTargetScheduled", () => {
	it("creates a scheduleable chunk with pin meta", async () => {
		const saveChunkData = vi.fn(async (chunk) => chunk);
		const storage = {
			getAllChunkData: vi.fn(async () => ({})),
			saveChunkData,
		};
		const schedulePin = resolveReadingTargetSchedulePin(
			new Date(2026, 6, 16),
		);

		const result = await ensureVaultReadingTargetScheduled({
			storage: storage as never,
			sourcePath: "Notes/Demo.md",
			resumeLink: "[[Notes/Demo.md#^abc123|段落]]",
			title: "段落",
			deckId: "deck-1",
			deckName: "Demo",
			schedulePin,
			blockId: "abc123",
			priorityUi: 7,
		});

		expect(result.result).toBe("created");
		expect(saveChunkData).toHaveBeenCalledTimes(1);
		const saved = saveChunkData.mock.calls[0][0];
		expect(saved.nextRepDate).toBe(schedulePin.nextRepDate);
		expect(saved.deckIds).toEqual(["deck-1"]);
		expect(saved.priorityUi).toBe(7);
		expect(saved.meta.externalDocument).toBe(true);
		expect(saved.meta.sourceSequenceLocked).toBe(true);
		expect(saved.meta.sourceSequenceAnchorDateKey).toBe(schedulePin.dateKey);
		expect(saved.meta.resumeLink).toContain("#^abc123");
	});

	it("pins first-read date when reusing an existing vault chunk", async () => {
		const existing = createDefaultChunkFileData(
			"chunk-1",
			"vault-src-demo",
			"Notes/Demo.md",
		);
		existing.deckIds = ["deck-1"];
		existing.topicIds = ["deck-1"];
		existing.topicTag = "#IR_deck_Demo";
		existing.deckTag = "#IR_deck_Demo";
		existing.scheduleStatus = "review";
		existing.nextRepDate = new Date(2026, 0, 1).getTime();
		existing.meta = {
			...(existing.meta || {}),
			externalDocument: true,
			resumeLink: "[[Notes/Demo.md#^abc123|旧标题]]",
			notes: "[[Notes/Demo.md#^abc123|旧标题]]",
			sourceSequenceLocked: true,
			sourceSequenceAnchorDateKey: "2026-01-01",
		};

		const saveChunkData = vi.fn(async (chunk) => chunk);
		const storage = {
			getAllChunkData: vi.fn(async () => ({
				[existing.chunkId]: existing,
			})),
			saveChunkData,
		};
		const schedulePin = resolveReadingTargetSchedulePin(
			new Date(2026, 6, 16),
		);

		const result = await ensureVaultReadingTargetScheduled({
			storage: storage as never,
			sourcePath: "Notes/Demo.md",
			resumeLink: "[[Notes/Demo.md#^abc123|新标题]]",
			title: "新标题",
			deckId: "deck-1",
			deckName: "Demo",
			schedulePin,
			blockId: "abc123",
		});

		expect(result.result).toBe("updated");
		expect(result.pointId).toBe("chunk-1");
		expect(saveChunkData).toHaveBeenCalledTimes(1);
		const saved = saveChunkData.mock.calls[0][0];
		expect(saved.nextRepDate).toBe(schedulePin.nextRepDate);
		expect(saved.scheduleStatus).toBe("new");
		expect(saved.meta.sourceSequenceAnchorDateKey).toBe(schedulePin.dateKey);
	});
});
