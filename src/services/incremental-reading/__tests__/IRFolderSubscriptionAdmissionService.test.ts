import { describe, expect, it } from "vitest";
import type { IRChunkFileData } from "../../../types/ir-types";
import { DEFAULT_IR_BLOCK_META, DEFAULT_IR_BLOCK_STATS } from "../../../types/ir-types";
import { resolveRemainingDailyAdmissionQuota } from "../IRDailyLoadAllocator";
import {
	FOLDER_SUBSCRIPTION_PENDING_ADMISSION_NEXT_REP_DATE,
	applyFolderSubscriptionAdmissionToChunk,
	selectFolderSubscriptionAdmissionCandidates,
} from "../IRFolderSubscriptionAdmissionService";

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
		nextRepDate:
			partial.nextRepDate ?? FOLDER_SUBSCRIPTION_PENDING_ADMISSION_NEXT_REP_DATE,
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

describe("resolveRemainingDailyAdmissionQuota", () => {
	it("takes the tighter of remaining minutes and remaining count", () => {
		const byMinutes = resolveRemainingDailyAdmissionQuota({
			dailyTimeBudgetMinutes: 40,
			dailyReadingPointCap: 15,
			todayOccupiedCount: 0,
			todayOccupiedMinutes: 0,
			typicalNewItemMinutes: 5,
		});
		expect(byMinutes.admitCountByMinutes).toBe(8);
		expect(byMinutes.remainingCountSlots).toBe(15);
		expect(byMinutes.admitCount).toBe(8);

		const byCount = resolveRemainingDailyAdmissionQuota({
			dailyTimeBudgetMinutes: 120,
			dailyReadingPointCap: 15,
			todayOccupiedCount: 12,
			todayOccupiedMinutes: 10,
			typicalNewItemMinutes: 5,
		});
		expect(byCount.remainingCountSlots).toBe(3);
		expect(byCount.admitCountByMinutes).toBe(22);
		expect(byCount.admitCount).toBe(3);
	});

	it("increasing time budget raises admit count when count soft-cap allows", () => {
		const low = resolveRemainingDailyAdmissionQuota({
			dailyTimeBudgetMinutes: 20,
			dailyReadingPointCap: 40,
			todayOccupiedCount: 0,
			todayOccupiedMinutes: 0,
			typicalNewItemMinutes: 5,
		});
		const high = resolveRemainingDailyAdmissionQuota({
			dailyTimeBudgetMinutes: 60,
			dailyReadingPointCap: 40,
			todayOccupiedCount: 0,
			todayOccupiedMinutes: 0,
			typicalNewItemMinutes: 5,
		});
		expect(low.admitCount).toBe(4);
		expect(high.admitCount).toBe(12);
	});
});

describe("IRFolderSubscriptionAdmissionService", () => {
	const todayStartMs = new Date("2026-07-28T00:00:00").getTime();
	const endOfTodayMs = new Date("2026-07-28T23:59:59.999").getTime();

	it("按时间∩条数选出待放出项，并保持 FIFO", () => {
		const chunks = [
			makeChunk({
				chunkId: "due-1",
				nextRepDate: todayStartMs,
				meta: { pendingFolderAdmission: false },
			}),
			makeChunk({
				chunkId: "due-2",
				nextRepDate: todayStartMs,
				scheduleStatus: "scheduled",
			}),
			makeChunk({
				chunkId: "pending-b",
				priorityUi: 5,
				meta: {
					pendingFolderAdmission: true,
					sourceSequenceOrder: 2,
					autoSubscribedAt: "2026-07-28T01:00:00.000Z",
				},
				createdAt: 2,
			}),
			makeChunk({
				chunkId: "pending-a",
				priorityUi: 5,
				meta: {
					pendingFolderAdmission: true,
					sourceSequenceOrder: 1,
					autoSubscribedAt: "2026-07-28T01:00:00.000Z",
				},
				createdAt: 1,
			}),
			makeChunk({
				chunkId: "pending-c",
				priorityUi: 5,
				meta: {
					pendingFolderAdmission: true,
					sourceSequenceOrder: 3,
					autoSubscribedAt: "2026-07-28T01:00:00.000Z",
				},
				createdAt: 3,
			}),
		];

		// 2 条已占用 × 默认 5 分钟 = 10 分钟；预算 40 → 剩余 30 分钟 / 5 = 6；条数软顶剩余 3 → 取 3
		const selected = selectFolderSubscriptionAdmissionCandidates({
			chunks,
			dailyReadingPointCap: 5,
			dailyTimeBudgetMinutes: 40,
			endOfTodayMs,
			typicalNewItemMinutes: 5,
		});

		expect(selected.todayOccupied).toBe(2);
		expect(selected.remainingSlots).toBe(3);
		expect(selected.toAdmit.map((chunk) => chunk.chunkId)).toEqual([
			"pending-a",
			"pending-b",
			"pending-c",
		]);
	});

	it("时间预算用尽时即使条数仍有空也不准入", () => {
		const chunks = [
			makeChunk({
				chunkId: "due-heavy",
				nextRepDate: todayStartMs,
				stats: {
					...DEFAULT_IR_BLOCK_STATS,
					impressions: 1,
					effectiveReadingTimeSec: 30 * 60,
				},
			}),
			makeChunk({
				chunkId: "pending-1",
				meta: { pendingFolderAdmission: true, sourceSequenceOrder: 1 },
			}),
		];

		const selected = selectFolderSubscriptionAdmissionCandidates({
			chunks,
			dailyReadingPointCap: 15,
			dailyTimeBudgetMinutes: 30,
			endOfTodayMs,
			maxEstimatedMinutesPerItem: 30,
			typicalNewItemMinutes: 5,
		});

		expect(selected.todayOccupiedMinutes).toBe(30);
		expect(selected.remainingSlots).toBe(0);
		expect(selected.toAdmit).toEqual([]);
		expect(selected.pendingCount).toBe(1);
	});

	it("今日条数已满时不再准入", () => {
		const chunks = [
			...Array.from({ length: 15 }, (_, index) =>
				makeChunk({
					chunkId: `due-${index}`,
					nextRepDate: todayStartMs,
				}),
			),
			makeChunk({
				chunkId: "pending-1",
				meta: { pendingFolderAdmission: true, sourceSequenceOrder: 1 },
			}),
		];

		const selected = selectFolderSubscriptionAdmissionCandidates({
			chunks,
			dailyReadingPointCap: 15,
			dailyTimeBudgetMinutes: 120,
			endOfTodayMs,
		});

		expect(selected.remainingSlots).toBe(0);
		expect(selected.toAdmit).toEqual([]);
		expect(selected.pendingCount).toBe(1);
	});

	it("准入后清除待放出并钉到今天", () => {
		const pending = makeChunk({
			chunkId: "pending-1",
			meta: {
				pendingFolderAdmission: true,
				sourceSequenceGroup: "folder-sub:rule-1",
				sourceSequenceOrder: 1,
			},
		});
		const admitted = applyFolderSubscriptionAdmissionToChunk(pending, {
			todayStartMs,
			todayDateKey: "2026-07-28",
			nowMs: todayStartMs + 1000,
		});

		expect(admitted.nextRepDate).toBe(todayStartMs);
		expect(admitted.scheduleStatus).toBe("new");
		expect(admitted.meta.pendingFolderAdmission).toBeUndefined();
		expect(admitted.meta.sourceSequenceLocked).toBe(true);
		expect(admitted.meta.sourceSequenceAnchorDateKey).toBe("2026-07-28");
	});
});
