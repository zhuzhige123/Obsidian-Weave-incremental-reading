import { describe, expect, it } from "vitest";
import { estimateSegmentReadingSeconds } from "../paragraph-workbench-queue";

describe("paragraph-workbench-queue", () => {
	it("estimates reading seconds with a sensible minimum", () => {
		expect(estimateSegmentReadingSeconds("")).toBe(30);
		const longText = "这是一段用于估算阅读时长的中文测试文本。".repeat(20);
		expect(estimateSegmentReadingSeconds(longText)).toBeGreaterThan(30);
	});
});
