import { describe, expect, test } from "vitest";
import {
	buildPriorityChangePreviewDetails,
	readStoredPriorityFromWorkspaceSnapshot,
} from "../IRSchedulePriorityPatch";
import type { IRWorkspaceDataSnapshot } from "../IRWorkspaceSnapshotService";

describe("IRSchedulePriorityPatch", () => {
	test("buildPriorityChangePreviewDetails 不改变复习日期文案", () => {
		const nextRepDate = new Date("2026-06-18T08:00:00").getTime();
		const preview = buildPriorityChangePreviewDetails({
			beforePriorityUi: 5,
			afterPriorityUi: 8.5,
			beforePriorityEff: 5,
			afterPriorityEff: 8.5,
			nextRepDate,
		});

		expect(preview.headline).toContain("P5");
		expect(preview.headline).toContain("P8.5");
		expect(preview.beforeDateText).toBe(preview.afterDateText);
		expect(preview.changedItemCount).toBe(0);
		expect(preview.impactedDays).toBe(0);
	});

	test("readStoredPriorityFromWorkspaceSnapshot 读取 chunk 优先级", () => {
		const snapshot = {
			chunksRecord: {
				"chunk-1": {
					chunkId: "chunk-1",
					priorityUi: 6.5,
					priorityEff: 7.2,
				},
			},
			blocksRecord: {},
			pdfTasks: [],
			epubTasks: [],
		} as unknown as IRWorkspaceDataSnapshot;

		expect(
			readStoredPriorityFromWorkspaceSnapshot(snapshot, "chunk-1"),
		).toEqual({
			priorityUi: 6.5,
			priorityEff: 7.2,
		});
	});
});
