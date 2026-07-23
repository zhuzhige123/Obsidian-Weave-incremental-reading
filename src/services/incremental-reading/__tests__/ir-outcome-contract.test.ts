import { describe, expect, it } from "vitest";
import {
	isIRLearningOutcomeKind,
	normalizeIRLearningOutcomeInput,
	resolveOutcomeStatDelta,
} from "../ir-outcome-contract";

describe("ir-outcome-contract", () => {
	it("accepts the three outcome kinds", () => {
		expect(isIRLearningOutcomeKind("extract")).toBe(true);
		expect(isIRLearningOutcomeKind("memory-card")).toBe(true);
		expect(isIRLearningOutcomeKind("note")).toBe(true);
		expect(isIRLearningOutcomeKind("clip")).toBe(false);
	});

	it("normalizes valid outcome input", () => {
		const normalized = normalizeIRLearningOutcomeInput({
			pointId: "  point-1  ",
			kind: "memory-card",
			artifactId: " card-9 ",
			count: 2.8,
			sourceAnchor: {
				sourceFile: "Notes/a.md",
				sourceBlock: "^abc",
			},
		});

		expect(normalized).toEqual({
			pointId: "point-1",
			kind: "memory-card",
			artifactId: "card-9",
			notePath: "",
			count: 2,
			sourceAnchor: {
				sourceFile: "Notes/a.md",
				sourceBlock: "^abc",
			},
		});
	});

	it("rejects missing pointId or kind", () => {
		expect(
			normalizeIRLearningOutcomeInput({
				pointId: "",
				kind: "extract",
			}),
		).toBeNull();
		expect(
			normalizeIRLearningOutcomeInput({
				pointId: "p1",
				kind: "clip" as "extract",
			}),
		).toBeNull();
	});

	it("maps kinds to the correct schedule/analytics deltas", () => {
		expect(resolveOutcomeStatDelta("extract", 1)).toEqual({
			extracts: 1,
			cardsCreated: 0,
			notesWritten: 0,
		});
		expect(resolveOutcomeStatDelta("memory-card", 3)).toEqual({
			extracts: 0,
			cardsCreated: 3,
			notesWritten: 0,
		});
		expect(resolveOutcomeStatDelta("note", 1)).toEqual({
			extracts: 0,
			cardsCreated: 0,
			notesWritten: 1,
		});
	});
});
