import { describe, expect, it } from "vitest";
import {
	extractSegmentTextFromContent,
	replaceSegmentRangeInContent,
} from "../paragraph-segment-source-sync";

describe("paragraph-segment-source-sync", () => {
	it("replaces an inclusive segment range and reports line delta", () => {
		const source = ["a", "b", "c", "d", "e"].join("\n");
		const { content, result } = replaceSegmentRangeInContent(
			source,
			{ startLine: 1, endLine: 2 },
			"B1\nB2\nB3",
		);
		expect(content).toBe(["a", "B1", "B2", "B3", "d", "e"].join("\n"));
		expect(result).toEqual({
			startLine: 1,
			endLine: 3,
			text: "B1\nB2\nB3",
			lineDelta: 1,
		});
	});

	it("preserves CRLF when rewriting a segment", () => {
		const source = ["one", "two", "three"].join("\r\n");
		const { content, result } = replaceSegmentRangeInContent(
			source,
			{ startLine: 1, endLine: 1 },
			"TWO ^IR-abc12345",
		);
		expect(content).toBe(["one", "TWO ^IR-abc12345", "three"].join("\r\n"));
		expect(result.text).toBe("TWO ^IR-abc12345");
		expect(result.lineDelta).toBe(0);
	});

	it("extracts the current segment text from source content", () => {
		const source = ["alpha", "beta", "gamma"].join("\n");
		expect(
			extractSegmentTextFromContent(source, { startLine: 0, endLine: 1 }),
		).toBe("alpha\nbeta");
	});
});
