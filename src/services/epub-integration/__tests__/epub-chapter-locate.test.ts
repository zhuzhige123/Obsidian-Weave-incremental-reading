import { describe, expect, it } from "vitest";
import { EpubLinkService } from "../EpubLinkService";
import { EPUB_RUNTIME } from "../epub-runtime";

describe("buildEpubChapterResumeLink", () => {
	it("builds href-only protocol markdown links", async () => {
		const { buildEpubChapterResumeLink } = await import(
			"../epub-chapter-locate"
		);
		const app = {
			plugins: {
				getPlugin: () => null,
			},
		} as never;
		const markdown = buildEpubChapterResumeLink(
			app,
			"Books/demo.epub",
			"Text/chapter1.xhtml",
			"第一章",
			"epubsrc-demo",
		);

		expect(markdown).toMatch(/^\[[^\]]+\]\(obsidian:\/\//);
		expect(markdown).toContain(
			`obsidian://${EPUB_RUNTIME.protocol.primaryName}?`,
		);
		expect(markdown).toContain("href=Text%2Fchapter1.xhtml");
		expect(markdown).toContain("sid=epubsrc-demo");
	});
});

describe("EpubLinkService chapter protocol", () => {
	it("parses href-only protocol params", () => {
		expect(
			EpubLinkService.parseProtocolParams({
				file: "Books/demo.epub",
				href: "Text/chapter1.xhtml",
			}),
		).toMatchObject({
			filePath: "Books/demo.epub",
			tocHref: "Text/chapter1.xhtml",
			cfi: "",
		});
	});
});
