import { describe, expect, it } from "vitest";
import { shouldUseNativeReadingTargetNavigation } from "../IRReadingPointOpenNavigation";

describe("IRReadingPointOpenNavigation", () => {
	it("routes edited EPUB bookmark resume links to vault block navigation", () => {
		expect(
			shouldUseNativeReadingTargetNavigation({
				kind: "vault-block",
				rawInput: "Notes/demo.md#^weea92dv",
				resumeLink: "Notes/demo.md#^weea92dv",
				sourceFilePath: "Notes/demo.md",
				blockId: "weea92dv",
			})
		).toBe(true);
	});

	it("keeps original EPUB resume links on EPUB navigation path", () => {
		const parsed = {
			kind: "epub" as const,
			rawInput: "obsidian://weave-epub-reader?file=Books/demo.epub&cfi=abc",
			resumeLink: "obsidian://weave-epub-reader?file=Books/demo.epub&cfi=abc",
		};

		expect(shouldUseNativeReadingTargetNavigation(parsed)).toBe(false);
	});

	it("detects canvas targets from material source file", () => {
		expect(
			shouldUseNativeReadingTargetNavigation({
				kind: "vault-file",
				rawInput: "Boards/demo.canvas",
				resumeLink: "Boards/demo.canvas",
				sourceFilePath: "Boards/demo.canvas",
			})
		).toBe(true);
	});
});
