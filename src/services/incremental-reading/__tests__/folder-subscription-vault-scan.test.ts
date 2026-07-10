import { TFile, TFolder } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { collectMarkdownFilesForFolderSubscriptionRules } from "../folder-subscription-vault-scan";

function createMarkdownFile(path: string): TFile {
	const file = Object.create(TFile.prototype) as TFile;
	Object.assign(file, {
		path,
		extension: "md",
		name: path.split("/").pop() ?? path,
	});
	return file;
}

function createFolder(children: Array<TFile | TFolder>): TFolder {
	const folder = Object.create(TFolder.prototype) as TFolder;
	Object.assign(folder, { children });
	return folder;
}

describe("collectMarkdownFilesForFolderSubscriptionRules", () => {
	it("only scans markdown files under subscribed folders", () => {
		const folders: Record<string, TFolder> = {
			"Notes/Inbox": createFolder([createMarkdownFile("Notes/Inbox/a.md")]),
			Archive: createFolder([createMarkdownFile("Archive/old.md")]),
			Other: createFolder([createMarkdownFile("Other/outside.md")]),
		};

		const app = {
			vault: {
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
});
