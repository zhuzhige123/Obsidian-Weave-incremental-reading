import { describe, expect, it } from "vitest";
import {
	buildCalendarMaterialsByCommittedDue,
	resolveCalendarDisplayDateKey,
	resolveCommittedCalendarDateKey,
	scheduleItemBelongsOnCalendarDate,
} from "../IRCalendarCommittedDueMaterials";
import type {
	IRProjectedScheduleItem,
	IRProjectedScheduleSummary,
} from "../IRProjectedScheduleSummary";
import type { IRPlannedSchedule } from "../IRScheduleKernel";

function createItem(
	partial: Partial<IRProjectedScheduleItem> &
		Pick<IRProjectedScheduleItem, "id">,
): IRProjectedScheduleItem {
	const nextRepDate = partial.nextRepDate ?? Date.parse("2026-07-20T00:00:00");
	return {
		id: partial.id,
		title: partial.title ?? partial.id,
		sourceFile: partial.sourceFile ?? "notes/a.md",
		topicKey: partial.topicKey ?? "source:notes/a.md",
		priority: partial.priority ?? 5,
		intervalDays: partial.intervalDays ?? 1,
		scheduleStatus: partial.scheduleStatus ?? "queued",
		nextRepDate,
		nextReviewDate: partial.nextReviewDate ?? new Date(nextRepDate),
		committedNextRepDate: partial.committedNextRepDate,
		estimatedMinutes: partial.estimatedMinutes ?? 2,
		deckId: partial.deckId ?? "deck-1",
		sourceType: partial.sourceType ?? "chunk",
		manualSchedulePinnedDateKey: partial.manualSchedulePinnedDateKey,
		sourceSequenceLocked: partial.sourceSequenceLocked,
		sourceSequenceAnchorDateKey: partial.sourceSequenceAnchorDateKey,
		explanation: partial.explanation,
	};
}

describe("IRCalendarCommittedDueMaterials", () => {
	it("resolveCommittedCalendarDateKey prefers pin, then committed due over plan slot", () => {
		expect(
			resolveCommittedCalendarDateKey(
				createItem({
					id: "a",
					manualSchedulePinnedDateKey: "2026-07-18",
					committedNextRepDate: Date.parse("2026-07-14T00:00:00"),
					nextRepDate: Date.parse("2026-07-20T00:00:00"),
				}),
			),
		).toBe("2026-07-18");

		expect(
			resolveCommittedCalendarDateKey(
				createItem({
					id: "b",
					committedNextRepDate: Date.parse("2026-07-14T00:00:00"),
					nextRepDate: Date.parse("2026-07-20T00:00:00"),
				}),
			),
		).toBe("2026-07-14");
	});

	it("rolls open overdue committed due into today for display", () => {
		expect(
			resolveCalendarDisplayDateKey(
				createItem({
					id: "overdue",
					scheduleStatus: "queued",
					committedNextRepDate: Date.parse("2026-07-10T00:00:00"),
					nextRepDate: Date.parse("2026-07-20T00:00:00"),
				}),
				"2026-07-14",
			),
		).toBe("2026-07-14");

		expect(
			resolveCalendarDisplayDateKey(
				createItem({
					id: "done-past",
					scheduleStatus: "done",
					committedNextRepDate: Date.parse("2026-07-10T00:00:00"),
				}),
				"2026-07-14",
			),
		).toBe("2026-07-10");
	});

	it("buildCalendarMaterialsByCommittedDue buckets by committed due not plan day", () => {
		const committed = Date.parse("2026-07-14T00:00:00");
		const planSlot = Date.parse("2026-07-20T00:00:00");
		const item = createItem({
			id: "chunk-1",
			committedNextRepDate: committed,
			nextRepDate: planSlot,
			nextReviewDate: new Date(planSlot),
		});

		const schedule: IRPlannedSchedule = {
			generatedAt: Date.now(),
			version: 1,
			days: [
				{
					dateKey: "2026-07-20",
					items: [item],
					totalEstimatedMinutes: 2,
					overloadLevel: "normal",
				},
			],
			itemsByDate: new Map([["2026-07-20", [item]]]),
			deckIds: ["deck-1"],
			triggerReason: "ui_refresh",
		};

		const summary: IRProjectedScheduleSummary = {
			schedule,
			dayLoadsByDate: new Map([
				[
					"2026-07-20",
					{
						dateKey: "2026-07-20",
						items: [item],
						totalEstimatedMinutes: 2,
					},
				],
			]),
			dayLoadsByDeckId: new Map(),
		};

		const materials = buildCalendarMaterialsByCommittedDue(summary, {
			todayKey: "2026-07-14",
		});
		expect(materials.get("2026-07-20")).toBeUndefined();
		expect(materials.get("2026-07-14")?.map((entry) => entry.id)).toEqual([
			"chunk-1",
		]);
		expect(materials.get("2026-07-14")?.[0]?.nextRepDate).toBe(committed);
	});

	it("puts overdue open items on todayKey in materials map", () => {
		const overdueItem = createItem({
			id: "overdue-1",
			scheduleStatus: "queued",
			committedNextRepDate: Date.parse("2026-07-01T00:00:00"),
			nextRepDate: Date.parse("2026-07-20T00:00:00"),
		});
		const schedule: IRPlannedSchedule = {
			generatedAt: Date.now(),
			version: 1,
			days: [
				{
					dateKey: "2026-07-20",
					items: [overdueItem],
					totalEstimatedMinutes: 2,
					overloadLevel: "normal",
				},
			],
			itemsByDate: new Map([["2026-07-20", [overdueItem]]]),
			deckIds: ["deck-1"],
			triggerReason: "ui_refresh",
		};
		const summary: IRProjectedScheduleSummary = {
			schedule,
			dayLoadsByDate: new Map([
				[
					"2026-07-20",
					{
						dateKey: "2026-07-20",
						items: [overdueItem],
						totalEstimatedMinutes: 2,
					},
				],
			]),
			dayLoadsByDeckId: new Map(),
		};

		const materials = buildCalendarMaterialsByCommittedDue(summary, {
			todayKey: "2026-07-14",
		});
		expect(materials.get("2026-07-01")).toBeUndefined();
		expect(materials.get("2026-07-14")?.map((entry) => entry.id)).toEqual([
			"overdue-1",
		]);
	});

	it("scheduleItemBelongsOnCalendarDate keeps open overdue off past days", () => {
		const overdue = createItem({
			id: "overdue-past",
			scheduleStatus: "queued",
			committedNextRepDate: Date.parse("2026-07-19T00:00:00"),
			nextRepDate: Date.parse("2026-07-19T00:00:00"),
		});
		expect(
			scheduleItemBelongsOnCalendarDate(overdue, "2026-07-19", "2026-07-23"),
		).toBe(false);
		expect(
			scheduleItemBelongsOnCalendarDate(overdue, "2026-07-23", "2026-07-23"),
		).toBe(true);
		expect(
			scheduleItemBelongsOnCalendarDate(
				overdue,
				"2026-07-19",
				"2026-07-23",
				new Set(["overdue-past"]),
			),
		).toBe(true);
	});
});
