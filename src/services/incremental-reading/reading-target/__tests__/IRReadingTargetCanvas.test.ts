import { describe, expect, it, vi } from "vitest";
import { createDefaultChunkFileData } from "../../../../types/ir-types";
import { ensureCanvasReadingTargetScheduled } from "../IRReadingTargetCanvas";
import { resolveReadingTargetSchedulePin } from "../IRReadingTargetScheduleDate";

describe("ensureCanvasReadingTargetScheduled", () => {
	it("pins first-read date when reusing an active canvas node", async () => {
		const existing = createDefaultChunkFileData(
			"chunk-1",
			"canvas-src-demo",
			"Boards/Topic.canvas",
		);
		existing.deckIds = ["deck-1"];
		existing.topicIds = ["deck-1"];
		existing.topicTag = "#IR_deck_Demo";
		existing.deckTag = "#IR_deck_Demo";
		existing.scheduleStatus = "review";
		existing.nextRepDate = new Date(2026, 0, 1).getTime();
		existing.intervalDays = 3;
		existing.meta = {
			...(existing.meta || {}),
			externalDocument: true,
			canvasNodeId: "node-1",
			pointTitle: "旧标题",
			resumeLink: "[[Boards/Topic.canvas#^node-1]]",
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
		const result = await ensureCanvasReadingTargetScheduled({
			storage: storage as never,
			canvasPath: "Boards/Topic.canvas",
			nodeId: "node-1",
			resumeLink: "[[Boards/Topic.canvas#^node-1|节点]]",
			title: "新标题",
			deckId: "deck-1",
			deckName: "Demo",
			schedulePin,
		});

		expect(result.result).toBe("updated");
		expect(saveChunkData).toHaveBeenCalledTimes(1);
		const saved = saveChunkData.mock.calls[0][0];
		expect(saved.nextRepDate).toBe(schedulePin.nextRepDate);
		expect(saved.scheduleStatus).toBe("new");
		expect(saved.meta.sourceSequenceAnchorDateKey).toBe(schedulePin.dateKey);
	});
});
