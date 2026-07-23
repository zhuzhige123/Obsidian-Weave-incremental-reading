vi.mock("obsidian", () => ({
	normalizePath: (path: string) =>
		path.replace(/\\/g, "/").replace(/\/{2,}/g, "/"),
	TFile: class TFile {},
}));

import {
	getLinkableVaultNoteIcon,
	isLinkableVaultNotePath,
	isVaultNoteCarrierSourcePath,
	resolveAssociatedNoteRelationMode,
	resolveExternalBookmarkTaskKind,
	supportsDerivedOutlinkNotesForScheduleItem,
	supportsPointLinkedNotes,
	supportsPointLinkedNotesForScheduleItem,
	supportsPointLinkedNotesForSourcePath,
} from "../IRLinkedNotePolicy";

describe("IRLinkedNotePolicy", () => {
	it("仅 PDF/EPUB 阅读点支持精选关联笔记写路径", () => {
		expect(supportsPointLinkedNotes("pdf")).toBe(true);
		expect(supportsPointLinkedNotes("epub")).toBe(true);
		expect(supportsPointLinkedNotes("pdf-bookmark")).toBe(true);
		expect(supportsPointLinkedNotes("epub-bookmark")).toBe(true);
		expect(supportsPointLinkedNotes("chunk")).toBe(false);
		expect(supportsPointLinkedNotes("legacy-block")).toBe(false);
		expect(supportsPointLinkedNotes("ir-chunk")).toBe(false);
	});

	it("按源文件扩展名识别外部文档", () => {
		expect(supportsPointLinkedNotesForSourcePath("Books/Deep Work.pdf")).toBe(
			true,
		);
		expect(
			supportsPointLinkedNotesForSourcePath("Books/Atomic Habits.epub"),
		).toBe(true);
		expect(supportsPointLinkedNotesForSourcePath("Notes/Topic.md")).toBe(false);
		expect(supportsPointLinkedNotesForSourcePath("Boards/Topic.canvas")).toBe(
			false,
		);
	});

	it("允许 Markdown、无扩展名笔记与 Canvas 作为关联目标", () => {
		expect(isLinkableVaultNotePath("Notes/Topic.md")).toBe(true);
		expect(isLinkableVaultNotePath("Notes/Topic")).toBe(true);
		expect(isLinkableVaultNotePath("Boards/Topic.canvas")).toBe(true);
		expect(isLinkableVaultNotePath("Draw/Sketch.excalidraw.md")).toBe(true);
		expect(isLinkableVaultNotePath("Books/Reference.pdf")).toBe(false);
	});

	it("为不同关联目标返回合适图标", () => {
		expect(getLinkableVaultNoteIcon("Notes/Topic.md")).toBe("file-text");
		expect(getLinkableVaultNoteIcon("Boards/Topic.canvas")).toBe("layout-grid");
		expect(getLinkableVaultNoteIcon("Draw/Sketch.excalidraw.md")).toBe(
			"pencil",
		);
	});

	it("在缺少 sourceType 时仍可通过 id 或源文件识别 PDF/EPUB", () => {
		expect(
			supportsPointLinkedNotesForScheduleItem({
				id: "epubbm-abc",
				sourceFile: "Books/demo.epub",
			}),
		).toBe(true);
		expect(
			supportsPointLinkedNotesForScheduleItem({
				id: "pdfbm-abc",
				sourceFile: "Papers/demo.pdf",
			}),
		).toBe(true);
		expect(
			supportsPointLinkedNotesForScheduleItem({
				id: "chunk-abc",
				sourceFile: "Notes/demo.md",
			}),
		).toBe(false);
		expect(resolveExternalBookmarkTaskKind({ id: "epubbm-abc" })).toBe("epub");
		expect(
			resolveExternalBookmarkTaskKind({ sourceFile: "Books/demo.epub" }),
		).toBe("epub");
	});

	it("按载体分流关联笔记关系模式", () => {
		expect(isVaultNoteCarrierSourcePath("Notes/Topic.md")).toBe(true);
		expect(isVaultNoteCarrierSourcePath("Boards/Map.canvas")).toBe(true);
		expect(isVaultNoteCarrierSourcePath("Books/a.pdf")).toBe(false);

		expect(
			resolveAssociatedNoteRelationMode({
				sourceType: "pdf",
				sourceFile: "Books/a.pdf",
			}),
		).toBe("curated");
		expect(
			resolveAssociatedNoteRelationMode({
				sourceType: "chunk",
				sourceFile: "Notes/a.md",
			}),
		).toBe("derived-outlinks");
		expect(
			supportsDerivedOutlinkNotesForScheduleItem({
				sourceType: "chunk",
				sourceFile: "Notes/web-stub.md",
			}),
		).toBe(true);
		expect(
			supportsDerivedOutlinkNotesForScheduleItem({
				sourceType: "chunk",
			}),
		).toBe(false);
		expect(
			supportsDerivedOutlinkNotesForScheduleItem({
				sourceType: "chunk",
				resumeLink: "https://example.com/article",
			}),
		).toBe(true);
		expect(
			supportsDerivedOutlinkNotesForScheduleItem({
				sourceType: "pdf",
				sourceFile: "Books/a.pdf",
			}),
		).toBe(false);
		expect(
			resolveAssociatedNoteRelationMode({
				id: "unknown",
				sourceFile: "Books/audio.mp3",
			}),
		).toBe("unavailable");
	});
});
