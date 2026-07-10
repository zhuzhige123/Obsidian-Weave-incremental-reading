import { describe, expect, it, vi } from "vitest";
import {
	isObsidianProtocolUrl,
	openResumeLink,
	resolveResumeLinkForOpen,
} from "../obsidian-open-protocol-url";

describe("obsidian-open-protocol-url", () => {
	it("detects weave epub reader protocol links", () => {
		expect(
			isObsidianProtocolUrl(
				"obsidian://weave-epub-reader?file=Books/demo.epub&href=OEBPS/Text/part0017.xhtml&chapter=3&sid=epubsrc-demo",
			),
		).toBe(true);
	});

	it("rejects vault file paths", () => {
		expect(isObsidianProtocolUrl("附件/如何学习.epub")).toBe(false);
	});

	it("extracts protocol URLs from markdown resume links", () => {
		const protocolUrl =
			"obsidian://weave-epub-reader?file=Books/demo.epub&href=OEBPS/Text/part0017.xhtml&chapter=3&sid=epubsrc-demo";
		expect(
			resolveResumeLinkForOpen(`[如何学习 · 第三部分](${protocolUrl})`),
		).toBe(protocolUrl);
	});

	it("opens obsidian protocol links without workspace.openLinkText", async () => {
		const protocolUrl =
			"obsidian://weave-epub-reader?file=Books/demo.epub&href=OEBPS/Text/part0017.xhtml&chapter=3&sid=epubsrc-demo";
		const openLinkText = vi.fn(async () => undefined);
		const click = vi.fn();
		const anchor = {
			href: "",
			classList: { add: vi.fn() },
			style: {} as CSSStyleDeclaration,
			click,
			remove: vi.fn(),
		};
		vi.spyOn(document, "createElement").mockReturnValue(
			anchor as unknown as HTMLAnchorElement,
		);
		vi.spyOn(document.body, "appendChild").mockImplementation(
			() => anchor as unknown as Node,
		);

		const app = {
			workspace: { openLinkText, getActiveFile: () => null },
		} as never;

		await expect(openResumeLink(app, protocolUrl)).resolves.toBe(true);
		expect(openLinkText).not.toHaveBeenCalled();
		expect(anchor.href).toBe(protocolUrl);
		expect(click).toHaveBeenCalled();
	});
});
