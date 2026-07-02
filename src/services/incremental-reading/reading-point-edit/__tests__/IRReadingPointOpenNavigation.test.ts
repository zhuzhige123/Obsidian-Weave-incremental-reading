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

	it("routes EPUB resume links through native link open path", () => {
		expect(
			shouldUseNativeReadingTargetNavigation({
				kind: "epub",
				rawInput: "obsidian://weave-epub-reader?file=Books/demo.epub&cfi=abc",
				resumeLink: "obsidian://weave-epub-reader?file=Books/demo.epub&cfi=abc",
			})
		).toBe(true);
	});

	it("still opens EPUB protocol links when vault file validation fails", () => {
		const protocolUrl =
			"obsidian://weave-epub-reader?file=Missing/book.epub&href=OEBPS/Text/part0017.xhtml&sid=epubsrc-demo";
		expect(
			shouldUseNativeReadingTargetNavigation({
				kind: "epub",
				rawInput: protocolUrl,
				resumeLink: protocolUrl,
				validationError: "epub file not found",
			})
		).toBe(true);
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
