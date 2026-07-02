import { describe, expect, it } from "vitest";
import type { IRBlockV4 } from "../../../types/ir-types";
import {
	computeAllScheduleMenuBlocks,
	computePostponeAdjustedBlock,
	computeScheduleModeAdjustedBlock,
	scheduleItemToPreviewBlockV4,
} from "../IRScheduleModePreviewService";
import type { ScheduleItem } from "../IRCalendarScheduleItem";

function createBlock(overrides: Partial<IRBlockV4> = {}): IRBlockV4 {
	return {
		id: "chunk-1",
		sourcePath: "notes/test.md",
		blockId: "chunk-1",
		contentHash: "",
		status: "queued",
		priorityUi: 5,
		priorityEff: 5,
		intervalDays: 3,
		nextRepDate: Date.parse("2026-06-19"),
		stats: {},
		meta: { tagGroup: "default" },
		updatedAt: Date.now(),
		...overrides,
	};
}

describe("IRScheduleModePreviewService", () => {
	it("computes distinct next dates for intensive/normal/slow", () => {
		const block = createBlock();
		const settings = {
			enableTagGroupPrior: false,
			defaultIntervalFactor: 1.5,
			maxIntervalDays: 365,
		};

		const intensive = computeScheduleModeAdjustedBlock(block, "intensive", {
			block,
			advancedSettings: settings,
		});
		const normal = computeScheduleModeAdjustedBlock(block, "normal", {
			block,
			advancedSettings: settings,
		});
		const slow = computeScheduleModeAdjustedBlock(block, "slow", {
			block,
			advancedSettings: settings,
		});

		expect(intensive.nextRepDate).toBeGreaterThan(0);
		expect(normal.nextRepDate).toBeGreaterThan(0);
		expect(slow.nextRepDate).toBeGreaterThan(0);
		expect(intensive.nextRepDate).toBeLessThanOrEqual(normal.nextRepDate);
		expect(normal.nextRepDate).toBeLessThanOrEqual(slow.nextRepDate);
	});

	it("postpone moves due date forward by requested days", () => {
		const base = new Date(2026, 5, 19);
		base.setHours(0, 0, 0, 0);
		const block = createBlock({ nextRepDate: base.getTime() });
		const postponed = computePostponeAdjustedBlock(block, 2);
		const expected = new Date(base);
		expected.setDate(expected.getDate() + 2);
		expect(postponed.nextRepDate).toBe(expected.getTime());
	});

	it("returns all four menu blocks in one call", () => {
		const block = createBlock();
		const all = computeAllScheduleMenuBlocks(block, {
			block,
			advancedSettings: {
				enableTagGroupPrior: false,
				defaultIntervalFactor: 1.5,
				maxIntervalDays: 365,
			},
		});
		expect(all.intensive.status).toBe("queued");
		expect(all.normal.status).toBe("queued");
		expect(all.slow.status).toBe("queued");
		expect(all.postpone.status).toBe("queued");
	});

	it("builds preview block synchronously from schedule list item", () => {
		const item: ScheduleItem = {
			id: "chunk-9",
			title: "测试阅读点",
			sourceFile: "notes/test.md",
			priority: 6,
			intervalDays: 4,
			scheduleStatus: "queued",
			nextRepDate: Date.now(),
			nextReviewDate: new Date(),
		};
		const block = scheduleItemToPreviewBlockV4(item);
		const normal = computeScheduleModeAdjustedBlock(block, "normal", {
			block,
			advancedSettings: {
				enableTagGroupPrior: false,
				defaultIntervalFactor: 1.5,
				maxIntervalDays: 365,
			},
		});
		expect(block.id).toBe("chunk-9");
		expect(normal.nextRepDate).toBeGreaterThan(0);
	});
});
