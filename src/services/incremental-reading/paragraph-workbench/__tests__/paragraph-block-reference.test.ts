import { describe, expect, it } from "vitest";
import {
	applyObsidianBlockIdToLines,
	blockReferencesObsidianId,
	buildCanvasNodeEmbedWikiLink,
	buildObsidianBlockResumeLink,
	buildObsidianBlockWikiLink,
	buildObsidianEmbedBlockWikiLink,
	cleanParagraphBlockTitle,
	deriveSegmentTitleDraft,
	ensureBlockIdOnMarkdownSelection,
	extractObsidianBlockIdFromText,
	extractWikiLinkTarget,
	findDuplicateBlockForSegment,
	findSegmentLastContentLineIndex,
	formatObsidianBlockId,
	generateObsidianBlockId,
	resolveLegacyBlockResumeLink,
	resolveObsidianBlockRangeAroundLines,
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
			"[[Notes/demo.md#^abc123|别名]]",
		);
		expect(buildObsidianEmbedBlockWikiLink("Notes/demo.md", "abc123")).toBe(
			"![[Notes/demo.md#^abc123]]",
		);
	});

	it("extracts obsidian block id from text", () => {
		expect(extractObsidianBlockIdFromText("段落末尾 ^IR-abc12345")).toBe(
			"IR-abc12345",
		);
		expect(formatObsidianBlockId("IR-abc12345")).toBe("^IR-abc12345");
	});

	it("generates IR- prefixed block ids", () => {
		const blockId = generateObsidianBlockId();
		expect(blockId.startsWith("IR-")).toBe(true);
		expect(blockId.length).toBeGreaterThan(4);
	});

	it("resolves resume links from legacy block notes", () => {
		expect(
			resolveLegacyBlockResumeLink({
				filePath: "Notes/demo.md",
				notes: "![[Notes/demo.md#^IR-d420d8|标题]]",
			}),
		).toBe("Notes/demo.md#^IR-d420d8");
		expect(extractWikiLinkTarget("![[Notes/demo.md#^IR-d420d8]]")).toBe(
			"Notes/demo.md#^IR-d420d8",
		);
		expect(
			buildObsidianBlockResumeLink("Notes/demo.md", "IR-d420d8", "标题"),
		).toBe("[[Notes/demo.md#^IR-d420d8|标题]]");
	});

	it("expands selection to enclosing blank-line block", () => {
		const lines = [
			"其他段落",
			"",
			"第一行",
			"第二行",
			"",
			"下一段",
		];
		expect(resolveObsidianBlockRangeAroundLines(lines, 2, 2)).toEqual({
			startLine: 2,
			endLine: 3,
		});
		expect(resolveObsidianBlockRangeAroundLines(lines, 3, 3)).toEqual({
			startLine: 2,
			endLine: 3,
		});
	});

	it("ensures block id on markdown selection and reuses existing", () => {
		const content = "前言\n\n选中这段话。\n\n下一段";
		const first = ensureBlockIdOnMarkdownSelection(content, 2, 2);
		expect(first.alreadyExisted).toBe(false);
		expect(first.changed).toBe(true);
		expect(first.blockId.startsWith("IR-")).toBe(true);
		expect(first.nextContent).toContain(`选中这段话。 ^${first.blockId}`);

		const second = ensureBlockIdOnMarkdownSelection(first.nextContent, 2, 2);
		expect(second.alreadyExisted).toBe(true);
		expect(second.blockId).toBe(first.blockId);
		expect(second.changed).toBe(false);
	});

	it("cleans markdown heading prefixes from titles", () => {
		expect(cleanParagraphBlockTitle("## 标题")).toBe("标题");
	});

	it("builds canvas node embed links", () => {
		expect(
			buildCanvasNodeEmbedWikiLink("Boards/demo.canvas", "node-1", "节点"),
		).toBe("![[Boards/demo.canvas?node=node-1|节点]]");
	});

	it("appends block id to the last content line and ensures a trailing blank line", () => {
		const lines = [
			"前言",
			"",
			"在处理语言信息时，一般人在短期记忆阶段主要依赖声码，而在长期记忆阶段，意码则变得更为重要。",
			"下一段开头",
		];
		const result = applyObsidianBlockIdToLines(
			lines,
			{ startLine: 2, endLine: 2 },
			"IR-d420d8",
		);
		expect(result.alreadyExisted).toBe(false);
		expect(result.lines[2]).toBe(
			"在处理语言信息时，一般人在短期记忆阶段主要依赖声码，而在长期记忆阶段，意码则变得更为重要。 ^IR-d420d8",
		);
		expect(result.lines[3]).toBe("");
		expect(result.lines[4]).toBe("下一段开头");
		expect(result.insertedTrailingBlank).toBe(true);
	});

	it("does not put block id on a blank endLine; uses last non-empty line instead", () => {
		const lines = ["第一行", "最后一句。", "", "下一段"];
		expect(
			findSegmentLastContentLineIndex(lines, { startLine: 0, endLine: 2 }),
		).toBe(1);
		const result = applyObsidianBlockIdToLines(
			lines,
			{ startLine: 0, endLine: 2 },
			"IR-abc12345",
		);
		expect(result.lines[1]).toBe("最后一句。 ^IR-abc12345");
		expect(result.lines[2]).toBe("");
		expect(result.lines[3]).toBe("下一段");
		expect(result.insertedTrailingBlank).toBe(false);
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
			"ir-block-1",
		);
		expect(duplicate?.id).toBe("ir-abc");
		expect(blockReferencesObsidianId(blocks[0], "ir-block-1")).toBe(true);
	});
});
