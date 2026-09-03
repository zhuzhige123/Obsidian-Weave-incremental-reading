import { describe, expect, it } from "vitest";
import type { IRBlockV4 } from "../../../types/ir-types";
import type { ScheduleItem } from "../IRCalendarScheduleItem";
import {
	POSTPONE_MAX_COUNT,
	POSTPONE_MENU_DAYS,
	canPostponeBlock,
	computeAllScheduleMenuBlocks,
	computeManualRescheduleAdjustedBlock,
	computePostponeAdjustedBlock,
	computeScheduleModeAdjustedBlock,
	getManualPostponeCount,
	resolvePostponeBaseDate,
	scheduleItemToPreviewBlockV4,
} from "../IRScheduleModePreviewService";

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

function startOfToday(): Date {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return today;
}

function addDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
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

	it("postpone uses today + N when no calendar context is provided", () => {
		const absurd = addDays(startOfToday(), 26436);
		const block = createBlock({
			nextRepDate: absurd.getTime(),
			intervalDays: 9,
		});
		const postponed = computePostponeAdjustedBlock(block, POSTPONE_MENU_DAYS);
		expect(postponed.nextRepDate).toBe(
			addDays(startOfToday(), POSTPONE_MENU_DAYS).getTime(),
		);
		expect(postponed.intervalDays).toBe(9);
		expect(getManualPostponeCount(postponed)).toBe(1);
	});

	it("postpone uses max(today, calendar list day) and ignores stored due", () => {
		const today = startOfToday();
		const listDay = addDays(today, 5);
		const absurdDue = addDays(today, 26436);
		const block = createBlock({
			nextRepDate: absurdDue.getTime(),
			intervalDays: 11,
		});
		const postponed = computePostponeAdjustedBlock(block, 2, {
			contextDate: listDay,
			now: today,
		});
		expect(postponed.nextRepDate).toBe(addDays(listDay, 2).getTime());
		expect(postponed.intervalDays).toBe(11);
		expect(getManualPostponeCount(postponed)).toBe(1);
	});

	it("postpone floors past calendar context days to today", () => {
		const today = startOfToday();
		const pastListDay = addDays(today, -3);
		const block = createBlock({ intervalDays: 4 });
		const postponed = computePostponeAdjustedBlock(block, 2, {
			contextDate: pastListDay,
			now: today,
		});
		expect(postponed.nextRepDate).toBe(addDays(today, 2).getTime());
		expect(postponed.intervalDays).toBe(4);
	});

	it("increments postpone count and rejects after max", () => {
		let block = createBlock({ intervalDays: 5 });
		expect(canPostponeBlock(block)).toBe(true);

		block = computePostponeAdjustedBlock(block, 2);
		expect(getManualPostponeCount(block)).toBe(1);
		expect(canPostponeBlock(block)).toBe(true);

		block = computePostponeAdjustedBlock(block, 2);
		expect(getManualPostponeCount(block)).toBe(2);
		expect(canPostponeBlock(block)).toBe(false);
		expect(POSTPONE_MAX_COUNT).toBe(2);

		const rejected = computePostponeAdjustedBlock(block, 2);
		expect(rejected).toBe(block);
		expect(getManualPostponeCount(rejected)).toBe(2);
	});

	it("clears postpone count when schedule mode is applied", () => {
		const block = createBlock({
			intervalDays: 6,
			meta: { tagGroup: "default", manualPostponeCount: 2 },
		});
		const normal = computeScheduleModeAdjustedBlock(block, "normal", {
			block,
			advancedSettings: {
				enableTagGroupPrior: false,
				defaultIntervalFactor: 1.5,
				maxIntervalDays: 365,
			},
		});
		expect(getManualPostponeCount(normal)).toBe(0);
		expect(normal.meta?.manualPostponeCount).toBeUndefined();
	});

	it("clears postpone count on manual reschedule (arrange)", () => {
		const today = startOfToday();
		const target = addDays(today, 5);
		const block = createBlock({
			intervalDays: 6,
			meta: { tagGroup: "default", manualPostponeCount: 2 },
		});
		const arranged = computeManualRescheduleAdjustedBlock(block, {
			nextRepDate: target.getTime(),
			scheduleStatus: "queued",
		});
		expect(getManualPostponeCount(arranged)).toBe(0);
		expect(arranged.meta?.manualPostponeCount).toBeUndefined();
		expect(arranged.nextRepDate).toBe(target.getTime());
		expect(arranged.meta?.manualSchedulePinnedDateKey).toBe(
			`${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`,
		);
	});

	it("resolvePostponeBaseDate prefers future context and floors past days", () => {
		const today = startOfToday();
		const future = addDays(today, 7);
		const key = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`;
		expect(
			resolvePostponeBaseDate({ contextDate: key, now: today }).getTime(),
		).toBe(future.getTime());
		expect(
			resolvePostponeBaseDate({
				contextDate: addDays(today, -2),
				now: today,
			}).getTime(),
		).toBe(today.getTime());
	});

	it("returns all four menu blocks and keeps postpone interval intact", () => {
		const block = createBlock({ intervalDays: 6 });
		const all = computeAllScheduleMenuBlocks(block, {
			block,
			advancedSettings: {
				enableTagGroupPrior: false,
				defaultIntervalFactor: 1.5,
				maxIntervalDays: 365,
			},
			postponeContextDate: startOfToday(),
		});
		expect(all.intensive.status).toBe("queued");
		expect(all.normal.status).toBe("queued");
		expect(all.slow.status).toBe("queued");
		expect(all.postpone.status).toBe("queued");
		expect(all.postpone.intervalDays).toBe(6);
		expect(getManualPostponeCount(all.postpone)).toBe(1);
		expect(getManualPostponeCount(all.normal)).toBe(0);
		expect(all.intensive.intervalDays).not.toBe(6);
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
			manualPostponeCount: 1,
		};
		const block = scheduleItemToPreviewBlockV4(item);
		expect(getManualPostponeCount(block)).toBe(1);
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
		expect(getManualPostponeCount(normal)).toBe(0);
	});
});
