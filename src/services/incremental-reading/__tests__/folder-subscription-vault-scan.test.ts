import { TFile, TFolder } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import {
	collectMarkdownFilesForFolderSubscriptionRules,
	isFolderSubscriptionMarkdownFile,
	isFolderSubscriptionMarkdownPath,
	resolveMarkdownFilesForFolderSubscriptionPaths,
} from "../folder-subscription-vault-scan";

function createFile(path: string, extension: string): TFile {
	const file = Object.create(TFile.prototype) as TFile;
	Object.assign(file, {
		path,
		extension,
		name: path.split("/").pop() ?? path,
	});
	return file;
}

function createMarkdownFile(path: string): TFile {
	return createFile(path, "md");
}

function createFolder(children: Array<TFile | TFolder>): TFolder {
	const folder = Object.create(TFolder.prototype) as TFolder;
	Object.assign(folder, { children });
	return folder;
}

describe("isFolderSubscriptionMarkdownPath", () => {
	it("accepts markdown paths case-insensitively", () => {
		expect(isFolderSubscriptionMarkdownPath("Inbox/a.md")).toBe(true);
		expect(isFolderSubscriptionMarkdownPath("Inbox/A.MD")).toBe(true);
	});

	it("rejects images and other attachments", () => {
		expect(isFolderSubscriptionMarkdownPath("Inbox/photo.png")).toBe(false);
		expect(isFolderSubscriptionMarkdownPath("Inbox/scan.JPG")).toBe(false);
		expect(isFolderSubscriptionMarkdownPath("Inbox/doc.pdf")).toBe(false);
		expect(isFolderSubscriptionMarkdownPath("Inbox/board.canvas")).toBe(false);
		expect(isFolderSubscriptionMarkdownPath("Inbox/note.md.backup")).toBe(
			false,
		);
	});
});

describe("isFolderSubscriptionMarkdownFile", () => {
	it("requires both TFile shape and md extension", () => {
		expect(isFolderSubscriptionMarkdownFile(createMarkdownFile("a.md"))).toBe(
			true,
		);
		expect(isFolderSubscriptionMarkdownFile(createFile("a.png", "png"))).toBe(
			false,
		);
		expect(isFolderSubscriptionMarkdownFile(createFile("a.jpg", "jpg"))).toBe(
			false,
		);
	});
});

describe("collectMarkdownFilesForFolderSubscriptionRules", () => {
	it("only scans markdown files under subscribed folders", () => {
		const folders: Record<string, TFolder> = {
			"Notes/Inbox": createFolder([createMarkdownFile("Notes/Inbox/a.md")]),
			Archive: createFolder([createMarkdownFile("Archive/old.md")]),
			Other: createFolder([createMarkdownFile("Other/outside.md")]),
		};

		const app = {
			vault: {
				configDir: ".obsidian",
				getAbstractFileByPath: vi.fn((path: string) => folders[path] || null),
				getRoot: vi.fn(() => createFolder([createMarkdownFile("root.md")])),
			},
		} as any;

		const files = collectMarkdownFilesForFolderSubscriptionRules(app, [
			{
				id: "rule-1",
				enabled: true,
				folderPath: "Notes/Inbox",
				deckId: "deck-1",
			},
		]);

		expect(files.map((file) => file.path)).toEqual(["Notes/Inbox/a.md"]);
	});

	it("excludes images and non-markdown attachments mixed into subscribed folders", () => {
		const folders: Record<string, TFolder> = {
			Inbox: createFolder([
				createMarkdownFile("Inbox/article.md"),
				createFile("Inbox/cover.png", "png"),
				createFile("Inbox/photo.JPG", "JPG"),
				createFile("Inbox/slides.pdf", "pdf"),
				createFile("Inbox/drawing.canvas", "canvas"),
				createFolder([
					createMarkdownFile("Inbox/Nested/nested.md"),
					createFile("Inbox/Nested/figure.webp", "webp"),
				]),
			]),
		};
		Object.assign(folders.Inbox.children[5], { path: "Inbox/Nested" });

		const app = {
			vault: {
				configDir: ".obsidian",
				getAbstractFileByPath: vi.fn((path: string) => folders[path] || null),
				getRoot: vi.fn(() => createFolder([])),
			},
		} as any;

		const files = collectMarkdownFilesForFolderSubscriptionRules(app, [
			{
				id: "rule-1",
				enabled: true,
				folderPath: "Inbox",
				deckId: "deck-1",
			},
		]);

		expect(files.map((file) => file.path).sort()).toEqual([
			"Inbox/Nested/nested.md",
			"Inbox/article.md",
		]);
	});

	it("excludes vault configDir even when scanning from vault root", () => {
		const configFolder = createFolder([
			createMarkdownFile(".obsidian/plugins/demo/readme.md"),
		]);
		Object.assign(configFolder, { path: ".obsidian" });
		const root = createFolder([
			createMarkdownFile("note.md"),
			configFolder,
		]);
		Object.assign(root, { path: "/" });

		const app = {
			vault: {
				configDir: ".obsidian",
				getAbstractFileByPath: vi.fn(),
				getRoot: vi.fn(() => root),
			},
		} as any;

		const files = collectMarkdownFilesForFolderSubscriptionRules(app, [
			{
				id: "rule-root",
				enabled: true,
				folderPath: "/",
				deckId: "deck-1",
			},
		]);

		expect(files.map((file) => file.path)).toEqual(["note.md"]);
	});
});

describe("resolveMarkdownFilesForFolderSubscriptionPaths", () => {
	it("resolves existing markdown paths and ignores missing or non-md", () => {
		const article = createMarkdownFile("Inbox/article.md");
		const image = createFile("Inbox/cover.png", "png");
		const byPath: Record<string, TFile> = {
			"Inbox/article.md": article,
			"Inbox/cover.png": image,
		};

		const app = {
			vault: {
				configDir: ".obsidian",
				getAbstractFileByPath: vi.fn((path: string) => byPath[path] || null),
			},
		} as any;

		const files = resolveMarkdownFilesForFolderSubscriptionPaths(app, [
			"Inbox/article.md",
			"Inbox/article.md",
			"Inbox/cover.png",
			"Inbox/missing.md",
			".obsidian/plugins/x/readme.md",
		]);

		expect(files.map((file) => file.path)).toEqual(["Inbox/article.md"]);
	});
});
