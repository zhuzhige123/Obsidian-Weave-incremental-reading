
vi.mock("obsidian", () => ({
	normalizePath: (path: string) => path.replace(/\\/g, "/").replace(/\/{2,}/g, "/"),
}));

import {
	getPointAssociatedNotePath,
	getVisibleAssociatedNotePath,
	hasPointAssociatedNote,
	hasVisibleAssociatedNote,
} from "../IRAssociatedNoteVisibility";

describe("IRAssociatedNoteVisibility", () => {
	it("在 PDF/EPUB 阅读点且存在 point 关联时显示入口", () => {
		const material = {
			sourceType: "pdf",
			associatedNotePath: "Folder\\Linked Note.md",
			associatedNoteScope: "point" as const,
		};

		expect(getVisibleAssociatedNotePath(material)).toBe("Folder/Linked Note.md");
		expect(getPointAssociatedNotePath(material)).toBe("Folder/Linked Note.md");
		expect(hasVisibleAssociatedNote(material)).toBe(true);
		expect(hasPointAssociatedNote(material)).toBe(true);
	});

	it("Markdown/Canvas 阅读点不显示关联笔记入口", () => {
		const material = {
			sourceType: "chunk",
			associatedNotePath: "Folder/Legacy.md",
			associatedNoteScope: "point" as const,
		};

		expect(getVisibleAssociatedNotePath(material)).toBe("Folder/Legacy.md");
		expect(hasVisibleAssociatedNote(material)).toBe(false);
		expect(hasPointAssociatedNote(material)).toBe(false);
	});

	it("在缺少 scope 的兼容数据下仍然显示并允许打开", () => {
		const material = {
			sourceType: "epub",
			associatedNotePath: "Folder\\Legacy.md",
		};

		expect(getVisibleAssociatedNotePath(material)).toBe("Folder/Legacy.md");
		expect(getPointAssociatedNotePath(material)).toBe("Folder/Legacy.md");
		expect(hasVisibleAssociatedNote(material)).toBe(true);
		expect(hasPointAssociatedNote(material)).toBe(true);
	});

	it("material 级关联应保留显示能力，但不伪装成 point 级关联", () => {
		const material = {
			sourceType: "pdf",
			associatedNotePath: "Folder\\Material.md",
			associatedNoteScope: "material" as const,
		};

		expect(getVisibleAssociatedNotePath(material)).toBe("Folder/Material.md");
		expect(getPointAssociatedNotePath(material)).toBe("");
		expect(hasVisibleAssociatedNote(material)).toBe(true);
		expect(hasPointAssociatedNote(material)).toBe(false);
	});

	it("没有路径时不显示关联笔记入口", () => {
		expect(getVisibleAssociatedNotePath({ associatedNoteScope: "point" })).toBe("");
		expect(getPointAssociatedNotePath({ associatedNoteScope: "point" })).toBe("");
		expect(hasVisibleAssociatedNote({ associatedNoteScope: "point" })).toBe(false);
		expect(hasPointAssociatedNote({ associatedNoteScope: "point" })).toBe(false);
	});

	it("缺少 sourceType 但 id 为 EPUB 书签时仍显示关联笔记", () => {
		const material = {
			id: "epubbm-demo",
			sourceFile: "Books/demo.epub",
			associatedNotePath: "Notes/EPUB Notes.md",
			associatedNoteScope: "point" as const,
		};

		expect(hasVisibleAssociatedNote(material)).toBe(true);
		expect(hasPointAssociatedNote(material)).toBe(true);
	});
});
