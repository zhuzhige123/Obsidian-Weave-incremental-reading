import { describe, expect, it } from "vitest";
import { parseReadingTargetInput } from "../IRReadingTargetParser";
import { resolveInitialReadingTargetDeckId } from "../IRReadingTargetPreferences";

function createMockApp(options?: {
	files?: Record<string, true>;
	blocks?: Record<
		string,
		Record<
			string,
			{ position: { start: { line: number }; end: { line: number } } }
		>
	>;
}) {
	const files = options?.files ?? {};
	const blocks = options?.blocks ?? {};
	return {
		metadataCache: {
			getFirstLinkpathDest: (linkPath: string) => {
				const normalized = linkPath.endsWith(".md")
					? linkPath
					: `${linkPath}.md`;
				if (files[normalized] || files[linkPath]) {
					return { path: files[normalized] ? normalized : linkPath };
				}
				return null;
			},
			getCache: (filePath: string) => ({
				blocks: blocks[filePath] || {},
			}),
		},
		vault: {
			getAbstractFileByPath: (filePath: string) =>
				files[filePath] ? { path: filePath } : null,
		},
	} as never;
}

describe("IRReadingTargetParser", () => {
	it("parses http urls", () => {
		const parsed = parseReadingTargetInput(
			createMockApp(),
			"https://example.com/article",
		);
		expect(parsed.kind).toBe("web");
		expect(parsed.webUrl).toBe("https://example.com/article");
	});

	it("parses markdown http links", () => {
		const parsed = parseReadingTargetInput(
			createMockApp(),
			"[示例文章](https://example.com/article)",
		);
		expect(parsed.kind).toBe("web");
		expect(parsed.webUrl).toBe("https://example.com/article");
		expect(parsed.titleHint).toBe("示例文章");
	});

	it("parses vault block references", () => {
		const app = createMockApp({
			files: { "Notes/demo.md": true },
			blocks: {
				"Notes/demo.md": {
					weea92dv: { position: { start: { line: 2 }, end: { line: 4 } } },
				},
			},
		});
		const parsed = parseReadingTargetInput(
			app,
			"![[Notes/demo.md#^weea92dv|记忆机制]]",
		);
		expect(parsed.kind).toBe("vault-block");
		expect(parsed.blockId).toBe("weea92dv");
		expect(parsed.alias).toBe("记忆机制");
		expect(parsed.sourceFilePath).toBe("Notes/demo.md");
	});

	it("reports missing block ids", () => {
		const app = createMockApp({ files: { "Notes/demo.md": true } });
		const parsed = parseReadingTargetInput(app, "[[Notes/demo.md#^missing]]");
		expect(parsed.kind).toBe("vault-block");
		expect(parsed.validationError).toContain("块引用");
	});

	it("parses heading links", () => {
		const app = createMockApp({ files: { "Notes/demo.md": true } });
		const parsed = parseReadingTargetInput(
			app,
			"[[Notes/demo.md#章节一|章节一]]",
		);
		expect(parsed.kind).toBe("vault-link");
		expect(parsed.titleHint).toBe("章节一");
	});

	it("parses weave-epub-reader markdown links", () => {
		const epubPath = "附件/demo.epub";
		const app = createMockApp({ files: { [epubPath]: true } });
		const raw = `[遥远的向日葵地 · 十九 天](obsidian://weave-epub-reader?file=${encodeURIComponent(
			epubPath,
		)}&cfi=epubcfi(/6/28!/4/18,/1:0,/1:45)&chapter=13&sid=epubsrc-demo)`;
		const parsed = parseReadingTargetInput(app, raw);
		expect(parsed.kind).toBe("epub");
		expect(parsed.titleHint).toBe("遥远的向日葵地 · 十九 天");
		expect(parsed.epubCfi).toContain("epubcfi(");
		expect(parsed.epubSourceId).toBe("epubsrc-demo");
		expect(parsed.validationError).toBeUndefined();
	});

	it("rejects bare epub file wikilinks without reader locator", () => {
		const app = createMockApp({ files: { "Books/demo.epub": true } });
		const parsed = parseReadingTargetInput(app, "[[Books/demo.epub]]");
		expect(parsed.validationError).toContain("EPUB 阅读器");
	});

	it("parses canvas node links with query params", () => {
		const app = createMockApp({ files: { "Boards/Topic.canvas": true } });
		const parsed = parseReadingTargetInput(
			app,
			"[[Boards/Topic.canvas#^node-1?x=10&y=20&w=300&h=180|节点标题]]",
		);
		expect(parsed.kind).toBe("canvas");
		expect(parsed.canvasNodeId).toBe("node-1");
		expect(parsed.sourceFilePath).toBe("Boards/Topic.canvas");
		expect(parsed.alias).toBe("节点标题");
		expect(parsed.resumeLink).toContain("#^node-1?");
		expect(parsed.validationError).toBeUndefined();
	});

	it("rejects bare canvas file links without node id", () => {
		const app = createMockApp({ files: { "Boards/Topic.canvas": true } });
		const parsed = parseReadingTargetInput(app, "[[Boards/Topic.canvas]]");
		expect(parsed.kind).toBe("unknown");
		expect(parsed.validationError).toContain("Canvas");
	});
});

describe("markdownContentHasObsidianBlockId", () => {
	it("detects end-of-line block ids even when metadata cache is empty", async () => {
		const { markdownContentHasObsidianBlockId } = await import(
			"../IRReadingTargetParser"
		);
		expect(
			markdownContentHasObsidianBlockId(
				"在处理语言信息时，意码则变得更为重要。 ^IR-763dnuzp\n\n下一段",
				"IR-763dnuzp",
			),
		).toBe(true);
		expect(
			markdownContentHasObsidianBlockId(
				"在处理语言信息时，意码则变得更为重要。 ^IR-other\n",
				"IR-763dnuzp",
			),
		).toBe(false);
	});

	it("clears validation error when vault content has the block id", async () => {
		const { TFile } = await import("obsidian");
		const { refineParsedReadingTargetValidation } = await import(
			"../IRReadingTargetParser"
		);
		const content =
			"在处理语言信息时，意码则变得更为重要。 ^IR-763dnuzp\n\n下一段";
		const file = new TFile("notes/demo.md");
		const app = {
			metadataCache: {
				getCache: () => ({ blocks: {} }),
			},
			vault: {
				getAbstractFileByPath: () => file,
				cachedRead: async () => content,
			},
		} as never;

		const refined = await refineParsedReadingTargetValidation(app, {
			kind: "vault-block",
			rawInput: "![[notes/demo.md#^IR-763dnuzp]]",
			resumeLink: "notes/demo.md#^IR-763dnuzp",
			sourceFilePath: "notes/demo.md",
			blockId: "IR-763dnuzp",
			validationError: "未在「notes/demo.md」中找到块引用 ^IR-763dnuzp",
		});
		expect(refined.validationError).toBeUndefined();
	});
});

describe("resolveInitialReadingTargetDeckId", () => {
	it("prefers active deck over inbox", () => {
		expect(
			resolveInitialReadingTargetDeckId({
				activeDeckId: "deck-a",
				inboxDeckId: "deck-b",
				lastDeckId: "deck-c",
				deckIds: ["deck-a", "deck-b", "deck-c"],
			}),
		).toBe("deck-a");
	});
});
