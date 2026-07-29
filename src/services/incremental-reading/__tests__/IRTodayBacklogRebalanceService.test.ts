import { describe, expect, it } from "vitest";
import type { IRChunkFileData } from "../../../types/ir-types";
import { DEFAULT_IR_BLOCK_META, DEFAULT_IR_BLOCK_STATS } from "../../../types/ir-types";
import { FOLDER_SUBSCRIPTION_PENDING_ADMISSION_NEXT_REP_DATE } from "../IRFolderSubscriptionAdmissionService";
import {
	applyTodayBacklogMoveToPending,
	selectTodayBacklogRebalancePlan,
} from "../IRTodayBacklogRebalanceService";

function makeChunk(
	partial: Partial<IRChunkFileData> & { chunkId: string },
): IRChunkFileData {
	return {
		chunkId: partial.chunkId,
		sourceId: partial.sourceId || `source-${partial.chunkId}`,
		filePath: partial.filePath || `Inbox/${partial.chunkId}.md`,
		deckIds: partial.deckIds || ["deck-a"],
		topicIds: partial.topicIds || ["deck-a"],
		deckTag: partial.deckTag || "#IR_deck_A",
		topicTag: partial.topicTag || "#IR_deck_A",
		scheduleStatus: partial.scheduleStatus || "new",
		nextRepDate: partial.nextRepDate ?? Date.parse("2026-07-28T00:00:00"),
		intervalDays: partial.intervalDays ?? 1,
		priorityUi: partial.priorityUi ?? 5,
		priorityEff: partial.priorityEff ?? 5,
		createdAt: partial.createdAt ?? 1,
		updatedAt: partial.updatedAt ?? 1,
		stats: partial.stats || { ...DEFAULT_IR_BLOCK_STATS },
		meta: {
			...DEFAULT_IR_BLOCK_META,
			...(partial.meta || {}),
		},
	};
}

describe("IRTodayBacklogRebalanceService", () => {
	const todayStartMs = Date.parse("2026-07-28T00:00:00");
	const todayDateKey = "2026-07-28";

	it("保留日容量内高优先级项，超额移入待放出，并保护手动钉住", () => {
		const chunks = [
			makeChunk({
				chunkId: "pinned",
				priorityUi: 1,
				meta: { manualSchedulePinnedDateKey: todayDateKey },
			}),
			makeChunk({ chunkId: "high", priorityUi: 9, createdAt: 1 }),
			makeChunk({ chunkId: "mid", priorityUi: 5, createdAt: 2 }),
			makeChunk({ chunkId: "low", priorityUi: 2, createdAt: 3 }),
			makeChunk({
				chunkId: "pending-already",
				nextRepDate: FOLDER_SUBSCRIPTION_PENDING_ADMISSION_NEXT_REP_DATE,
				meta: { pendingFolderAdmission: true },
			}),
		];

		// pinned 占 1 条/5 分钟；预算 15 分钟 → 还可放 2 条典型新材料；条数软顶 15
		const plan = selectTodayBacklogRebalancePlan({
			chunks,
			todayStartMs,
			todayDateKey,
			dailyTimeBudgetMinutes: 15,
			dailyReadingPointCap: 15,
			typicalNewItemMinutes: 5,
		});

		expect(plan.protectedPinned.map((c) => c.chunkId)).toEqual(["pinned"]);
		expect(plan.keep.map((c) => c.chunkId)).toEqual(["pinned", "high", "mid"]);
		expect(plan.moveToPending.map((c) => c.chunkId)).toEqual(["low"]);
		expect(plan.todayOccupiedBefore).toBe(4);
	});

	it("与月历同口径：序列锚在今天但 nextRepDate 已在未来的项仍计入今日积压", () => {
		const chunks = [
			makeChunk({
				chunkId: "due-today",
				priorityUi: 8,
				nextRepDate: todayStartMs,
			}),
			makeChunk({
				chunkId: "anchored-today-future-due",
				priorityUi: 3,
				nextRepDate: Date.parse("2026-08-05T00:00:00"),
				meta: {
					sourceSequenceLocked: true,
					sourceSequenceAnchorDateKey: todayDateKey,
				},
			}),
			makeChunk({
				chunkId: "future-only",
				priorityUi: 9,
				nextRepDate: Date.parse("2026-08-05T00:00:00"),
			}),
		];

		const plan = selectTodayBacklogRebalancePlan({
			chunks,
			todayStartMs,
			todayDateKey,
			dailyTimeBudgetMinutes: 5,
			dailyReadingPointCap: 1,
			typicalNewItemMinutes: 5,
		});

		expect(plan.todayOccupiedBefore).toBe(2);
		expect(plan.keep.map((c) => c.chunkId)).toEqual(["due-today"]);
		expect(plan.moveToPending.map((c) => c.chunkId)).toEqual([
			"anchored-today-future-due",
		]);
	});

	it("移入待放出时清除今日钉锁并标记 pending", () => {
		const moved = applyTodayBacklogMoveToPending(
			makeChunk({
				chunkId: "overflow",
				meta: {
					sourceSequenceLocked: true,
					sourceSequenceAnchorDateKey: todayDateKey,
				},
			}),
			{ sequenceGroup: "today-backlog-rebalance:2026-07-28", sequenceOrder: 1 },
		);

		expect(moved.meta.pendingFolderAdmission).toBe(true);
		expect(moved.meta.sourceSequenceLocked).toBeUndefined();
		expect(moved.meta.sourceSequenceAnchorDateKey).toBeUndefined();
		expect(moved.meta.manualSchedulePinnedDateKey).toBeUndefined();
		expect(moved.nextRepDate).toBe(
			FOLDER_SUBSCRIPTION_PENDING_ADMISSION_NEXT_REP_DATE,
		);
		expect(moved.meta.sourceSequenceOrder).toBe(1);
	});
});
