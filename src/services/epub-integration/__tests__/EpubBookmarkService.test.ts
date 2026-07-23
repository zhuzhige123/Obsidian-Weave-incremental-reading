vi.mock("obsidian", () => ({
	App: class MockApp {},
	TFile: class MockTFile {},
	normalizePath: (value: string) =>
		String(value || "")
			.replace(/\\/g, "/")
			.replace(/\/+/g, "/")
			.replace(/\/$/, ""),
	parseYaml: () => ({}),
}));

import { describe, expect, it, vi } from "vitest";
import { DEFAULT_IR_DATA_ROOT } from "../../../config/paths";
import { getObsidianPluginAs } from "../../../utils/obsidian-plugin-registry";
import {
	DEFAULT_EPUB_BOOKMARK_FOLDER,
	EpubBookmarkService,
} from "../EpubBookmarkService";

vi.mock("../../../utils/obsidian-plugin-registry", () => ({
	getObsidianPluginAs: vi.fn(),
}));

describe("EpubBookmarkService.getBookmarkFolder", () => {
	it("defaults under DEFAULT_IR_DATA_ROOT via paths.ts", () => {
		expect(DEFAULT_EPUB_BOOKMARK_FOLDER).toBe(
			`${DEFAULT_IR_DATA_ROOT}/epub-bookmarks`,
		);

		vi.mocked(getObsidianPluginAs).mockReturnValue({
			settings: { weaveParentFolder: "" },
		} as never);

		const app = {
			plugins: {
				getPlugin: () => ({ settings: { weaveParentFolder: "" } }),
			},
			vault: { configDir: ".obsidian" },
		};
		const service = new EpubBookmarkService(app as never);
		expect(service.getBookmarkFolder()).toBe(
			`${DEFAULT_IR_DATA_ROOT}/epub-bookmarks`,
		);
	});

	it("follows custom weaveParentFolder when bookmarkFolder is unset", () => {
		vi.mocked(getObsidianPluginAs).mockReturnValue({
			settings: { weaveParentFolder: "Archive/IR Data" },
		} as never);

		const app = {
			plugins: {
				getPlugin: (id: string) => {
					if (id === "weave-incremental-reading" || id === "weave") {
						return { settings: { weaveParentFolder: "Archive/IR Data" } };
					}
					return null;
				},
			},
			vault: { configDir: ".obsidian" },
		};
		const service = new EpubBookmarkService(app as never);
		expect(service.getBookmarkFolder()).toBe("Archive/IR Data/epub-bookmarks");
	});

	it("prefers explicit bookmarkFolder setting over data root", () => {
		vi.mocked(getObsidianPluginAs).mockReturnValue({
			settings: {
				weaveParentFolder: "Archive/IR Data",
				bookmarkFolder: "Notes/Bookmarks",
			},
		} as never);

		const app = {
			plugins: {
				getPlugin: () => ({
					settings: {
						weaveParentFolder: "Archive/IR Data",
						bookmarkFolder: "Notes/Bookmarks",
					},
				}),
			},
			vault: { configDir: ".obsidian" },
		};
		const service = new EpubBookmarkService(app as never);
		expect(service.getBookmarkFolder()).toBe("Notes/Bookmarks");
	});
});
