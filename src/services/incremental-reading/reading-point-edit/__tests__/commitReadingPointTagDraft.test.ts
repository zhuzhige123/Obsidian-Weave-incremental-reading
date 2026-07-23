import { describe, expect, it } from "vitest";
import {
	commitReadingPointTagDraft,
	hasReadingPointTagDraft,
} from "../commitReadingPointTagDraft";

describe("commitReadingPointTagDraft", () => {
	it("adds a typed draft that was never confirmed with Enter", () => {
		expect(commitReadingPointTagDraft([], "测试标签")).toEqual(["测试标签"]);
		expect(commitReadingPointTagDraft(["alpha"], "#beta")).toEqual([
			"alpha",
			"beta",
		]);
	});

	it("ignores blank drafts and duplicate tags", () => {
		expect(commitReadingPointTagDraft(["Paper"], "   ")).toEqual(["Paper"]);
		expect(commitReadingPointTagDraft(["Paper"], "#paper")).toEqual(["Paper"]);
	});
});

describe("hasReadingPointTagDraft", () => {
	it("detects saveable draft text", () => {
		expect(hasReadingPointTagDraft("测试标签")).toBe(true);
		expect(hasReadingPointTagDraft("  #x  ")).toBe(true);
		expect(hasReadingPointTagDraft("")).toBe(false);
		expect(hasReadingPointTagDraft("   ")).toBe(false);
	});
});
