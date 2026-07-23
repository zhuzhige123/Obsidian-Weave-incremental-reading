import { describe, expect, test } from "vitest";
import {
	buildReadingTargetPreviewMarkdown,
	getCurrentEditorReadingTargetContext,
} from "../IRReadingTargetCurrentLocation";
import type { ParsedReadingTarget } from "../IRReadingTargetTypes";

describe("buildReadingTargetPreviewMarkdown", () => {
	test("PDF 链接预览保留嵌入以显示选区片段", () => {
		const target: ParsedReadingTarget = {
			kind: "pdf",
			rawInput: "![[附件/book.pdf#page=203&rect=1,2,3,4|人格心理学, p.188]]",
			resumeLink: "附件/book.pdf#page=203&rect=1,2,3,4",
			displayLink: "[[附件/book.pdf#page=203&rect=1,2,3,4|人格心理学, p.188]]",
			sourceFilePath: "附件/book.pdf",
			pdfPath: "附件/book.pdf",
			alias: "人格心理学, p.188",
		};

		const preview = buildReadingTargetPreviewMarkdown(target, "人格心理学");

		expect(preview).toContain("![[");
		expect(preview).toContain("page=203");
		expect(preview).toContain("rect=");
	});
});

describe("getCurrentEditorReadingTargetContext", () => {
	test("选区无块 ID 时使用行锚点，不写入 ^pending", () => {
		const editor = {
			getSelection: () => "选中的一段文字",
			getCursor: () => ({ line: 4, ch: 0 }),
			getLine: (line: number) => (line === 4 ? "选中的一段文字" : ""),
		};
		const file = { path: "Notes/demo.md", extension: "md" };
		const app = {
			workspace: {
				getActiveViewOfType: () => ({ file, editor }),
			},
			metadataCache: {
				getFileCache: () => ({ blocks: {} }),
				getCache: () => ({ blocks: {} }),
				getFirstLinkpathDest: (linkPath: string) => {
					const normalized = linkPath.endsWith(".md")
						? linkPath
						: `${linkPath}.md`;
					return normalized === "Notes/demo.md" ? file : null;
				},
			},
			vault: {
				getAbstractFileByPath: (path: string) =>
					path === "Notes/demo.md" ? file : null,
			},
		};

		const context = getCurrentEditorReadingTargetContext(app as never);
		expect(context).not.toBeNull();
		expect(context?.sourceLink).not.toContain("^pending");
		expect(context?.sourceLink).toContain("#5");
		expect(context?.target.kind).toBe("vault-link");
		expect(context?.target.validationError).toBeUndefined();
	});
});
