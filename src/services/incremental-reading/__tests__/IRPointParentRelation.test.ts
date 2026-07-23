import { describe, expect, it } from "vitest";
import {
	buildParentRelationIndex,
	computeParentCompletionProgress,
	isPointCompletedForParentProgress,
	normalizeParentPointId,
	resolveContinuousReadingRelatedIds,
	wouldCreateParentCycle,
} from "../IRPointParentRelation";

describe("IRPointParentRelation", () => {
	it("normalizes parent ids", () => {
		expect(normalizeParentPointId("  a  ")).toBe("a");
		expect(normalizeParentPointId("")).toBeNull();
		expect(normalizeParentPointId(null)).toBeNull();
	});

	it("detects completed children for parent progress", () => {
		expect(isPointCompletedForParentProgress("done")).toBe(true);
		expect(isPointCompletedForParentProgress("archived")).toBe(true);
		expect(
			isPointCompletedForParentProgress("active", "completed"),
		).toBe(true);
		expect(isPointCompletedForParentProgress("learning")).toBe(false);
	});

	it("computes parent completion percent from active children", () => {
		expect(
			computeParentCompletionProgress([
				{ status: "done" },
				{ status: "learning" },
				{ status: "removed" },
				{ status: "active", doneReason: "completed" },
			]),
		).toEqual({
			totalChildren: 3,
			completedChildren: 2,
			percent: 67,
		});
		expect(computeParentCompletionProgress([])).toEqual({
			totalChildren: 0,
			completedChildren: 0,
			percent: 0,
		});
	});

	it("detects parent cycles including self-parent", () => {
		const parents = new Map<string, string | null>([
			["b", "c"],
			["c", "a"],
		]);
		expect(wouldCreateParentCycle("a", "a", parents)).toBe(true);
		expect(wouldCreateParentCycle("a", "b", parents)).toBe(true);
		expect(wouldCreateParentCycle("a", "d", parents)).toBe(false);
		expect(wouldCreateParentCycle("a", null, parents)).toBe(false);
	});

	it("builds parent/child index and continuous-reading related ids", () => {
		const index = buildParentRelationIndex([
			{ id: "parent", parentPointId: null },
			{ id: "c1", parentPointId: "parent" },
			{ id: "c2", parentPointId: "parent" },
			{ id: "orphan", parentPointId: null },
		]);

		expect(index.childrenByParentId.get("parent")).toEqual(["c1", "c2"]);
		expect(index.parentByChildId.get("c1")).toBe("parent");

		expect(resolveContinuousReadingRelatedIds("parent", index)).toEqual({
			kind: "children",
			ids: ["c1", "c2"],
		});
		expect(resolveContinuousReadingRelatedIds("c1", index)).toEqual({
			kind: "siblings",
			ids: ["c2"],
		});
		expect(resolveContinuousReadingRelatedIds("orphan", index)).toEqual({
			kind: "none",
			ids: [],
		});
	});
});
