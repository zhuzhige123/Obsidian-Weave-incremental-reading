import {
	editorPositionToOffset,
	replaceSelectionInMarkdownContent,
} from "../SelectionQuickCreateSourceTransform";

describe("SelectionQuickCreateSourceTransform", () => {
	it("replaces the original selection in place", () => {
		const content = "# 标题\n\n这是第一句。\n这是第二句。\n";
		const next = replaceSelectionInMarkdownContent(
			content,
			{
				from: { line: 2, ch: 2 },
				to: { line: 2, ch: 5 },
			},
			"[[阅读点]]"
		);

		expect(next).toBe("# 标题\n\n这是[[阅读点]]。\n这是第二句。\n");
	});

	it("supports reversed selection ranges", () => {
		const content = "Alpha Beta Gamma";
		const next = replaceSelectionInMarkdownContent(
			content,
			{
				from: { line: 0, ch: 10 },
				to: { line: 0, ch: 6 },
			},
			"[[IR]]"
		);

		expect(next).toBe("Alpha [[IR]] Gamma");
	});

	it("collapses extra blank lines when a whole markdown block is replaced", () => {
		const content =
			"# 标题\n\n## 小节\n这是第一段。\n\n这是第二段。\n\n## 下个小节\n继续内容\n";
		const next = replaceSelectionInMarkdownContent(
			content,
			{
				from: { line: 2, ch: 0 },
				to: { line: 5, ch: 6 },
			},
			"[[小节]]"
		);

		expect(next).toBe("# 标题\n\n[[小节]]\n## 下个小节\n继续内容\n");
	});

	it("keeps the original indentation for whole-line replacements", () => {
		const content = "- 列表项\n  这是原文第一行\n  这是原文第二行\n- 另一个条目\n";
		const next = replaceSelectionInMarkdownContent(
			content,
			{
				from: { line: 1, ch: 0 },
				to: { line: 2, ch: 9 },
			},
			"[[阅读点]]"
		);

		expect(next).toBe("- 列表项\n  [[阅读点]]\n- 另一个条目\n");
	});

	it("keeps content unchanged when the selection location is unavailable", () => {
		const content = "预览模式下无法回写";
		expect(replaceSelectionInMarkdownContent(content, null, "[[阅读点]]")).toBe(content);
	});

	it("calculates offsets against normalized line endings", () => {
		const content = "第一行\r\n第二行";
		expect(editorPositionToOffset(content, { line: 1, ch: 2 })).toBe(6);
	});
});
