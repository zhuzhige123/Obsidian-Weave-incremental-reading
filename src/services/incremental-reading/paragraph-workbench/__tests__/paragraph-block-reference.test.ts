import { describe, expect, it } from "vitest";
import {
	blockReferencesObsidianId,
	buildCanvasNodeEmbedWikiLink,
	buildObsidianBlockResumeLink,
	buildObsidianBlockWikiLink,
	buildObsidianEmbedBlockWikiLink,
	cleanParagraphBlockTitle,
	deriveSegmentTitleDraft,
	extractObsidianBlockIdFromText,
	extractWikiLinkTarget,
	findDuplicateBlockForSegment,
	formatObsidianBlockId,
	generateObsidianBlockId,
	resolveLegacyBlockResumeLink,
} from "../paragraph-block-reference";

describe("paragraph-block-reference", () => {
	it("derives title from segment heading", () => {
		const draft = deriveSegmentTitleDraft({
			id: "1",
			index: 0,
			title: "4. 记忆在语言表达中的作用",
			text: "## 4. 记忆在语言表达中的作用\n\n正文",
		});
		expect(draft.titleDetected).toBe(true);
		expect(draft.title).toBe("4. 记忆在语言表达中的作用");
	});

	it("derives title from markdown heading line when title missing", () => {
		const draft = deriveSegmentTitleDraft({
			id: "1",
			index: 0,
			text: "## 小节标题\n\n正文内容",
		});
		expect(draft.titleDetected).toBe(true);
		expect(draft.title).toBe("小节标题");
	});

	it("builds obsidian block wiki links", () => {
		expect(buildObsidianBlockWikiLink("Notes/demo.md", "abc123", "别名")).toBe(
			"[[Notes/demo.md#^abc123|别名]]"
		);
		expect(buildObsidianEmbedBlockWikiLink("Notes/demo.md", "abc123")).toBe(
			"![[Notes/demo.md#^abc123]]"
		);
	});

	it("extracts obsidian block id from text", () => {
		expect(extractObsidianBlockIdFromText("段落末尾 ^ir_abc12345")).toBe("ir_abc12345");
		expect(formatObsidianBlockId("ir_abc12345")).toBe("^ir_abc12345");
	});

	it("generates ir_ prefixed block ids", () => {
		const blockId = generateObsidianBlockId();
		expect(blockId.startsWith("ir_")).toBe(true);
		expect(blockId.length).toBeGreaterThan(4);
	});

	it("resolves resume links from legacy block notes", () => {
		expect(
			resolveLegacyBlockResumeLink({
				filePath: "Notes/demo.md",
				notes: "![[Notes/demo.md#^ir_d420d8|标题]]",
			})
		).toBe("Notes/demo.md#^ir_d420d8");
		expect(extractWikiLinkTarget("![[Notes/demo.md#^ir_d420d8]]")).toBe("Notes/demo.md#^ir_d420d8");
		expect(buildObsidianBlockResumeLink("Notes/demo.md", "ir_d420d8", "标题")).toBe(
			"[[Notes/demo.md#^ir_d420d8|标题]]"
		);
	});

	it("cleans markdown heading prefixes from titles", () => {
		expect(cleanParagraphBlockTitle("## 标题")).toBe("标题");
	});

	it("builds canvas node embed links", () => {
		expect(buildCanvasNodeEmbedWikiLink("Boards/demo.canvas", "node-1", "节点")).toBe(
			"![[Boards/demo.canvas?node=node-1|节点]]"
		);
	});

	it("detects duplicate blocks by obsidian block id in notes", () => {
		const blocks = [
			{
				id: "ir-abc",
				startLine: 9,
				endLine: 12,
				notes: "![[Notes/demo.md#^ir-block-1|标题]]",
			},
		];
		const duplicate = findDuplicateBlockForSegment(
			blocks,
			{
				id: "ir-block-1",
				index: 0,
				text: "段落 ^ir-block-1",
				metadata: { startLine: 20, endLine: 22 },
			},
			"ir-block-1"
		);
		expect(duplicate?.id).toBe("ir-abc");
		expect(blockReferencesObsidianId(blocks[0], "ir-block-1")).toBe(true);
	});
});
