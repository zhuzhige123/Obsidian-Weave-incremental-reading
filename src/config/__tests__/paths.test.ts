import { describe, expect, it } from "vitest";
import {
	DEFAULT_IR_DATA_ROOT,
	DEFAULT_IR_IMPORT_FOLDER,
	LEGACY_IR_DATA_ROOT,
	WEAVE_DATA,
	getLegacyIRDataRoot,
	getLegacyIRImportFolder,
	getReadableWeaveRoot,
	getV2Paths,
	normalizeWeaveParentFolder,
	resolveIRImportFolder,
	toVaultAdapterPath,
} from "../../config/paths";

describe("toVaultAdapterPath", () => {
	it("keeps vault-relative plugin paths unchanged", () => {
		expect(
			toVaultAdapterPath(
				{ vault: { configDir: ".obsidian" } },
				".obsidian/plugins/weave-epub-reader/cache/epub-paragraph-mode-positions.json",
			),
		).toBe(
			".obsidian/plugins/weave-epub-reader/cache/epub-paragraph-mode-positions.json",
		);
	});

	it("strips Windows absolute prefixes before adapter writes", () => {
		expect(
			toVaultAdapterPath(
				{ vault: { configDir: "C:/Vault/.obsidian" } },
				"C:/Vault/.obsidian/plugins/weave-epub-reader/cache/epub-paragraph-mode-positions.json",
			),
		).toBe(
			".obsidian/plugins/weave-epub-reader/cache/epub-paragraph-mode-positions.json",
		);
	});
});

describe("IR data parent folder paths", () => {
	it("defaults to weave Incremental reading without nesting weave/", () => {
		expect(normalizeWeaveParentFolder("")).toBe("");
		expect(normalizeWeaveParentFolder(DEFAULT_IR_DATA_ROOT)).toBe("");
		expect(getReadableWeaveRoot()).toBe(DEFAULT_IR_DATA_ROOT);
		expect(getReadableWeaveRoot("")).toBe(DEFAULT_IR_DATA_ROOT);

		const paths = getV2Paths();
		expect(paths.root).toBe(DEFAULT_IR_DATA_ROOT);
		expect(paths.ir.root).toBe(DEFAULT_IR_DATA_ROOT);
		expect(paths.ir.pointsDir).toBe(`${DEFAULT_IR_DATA_ROOT}/points`);
		expect(paths.ir.materials.root).toBe(`${DEFAULT_IR_DATA_ROOT}/materials`);
		expect(paths.ir.registry).toBe(`${DEFAULT_IR_DATA_ROOT}/registry`);
		expect(paths.ir.epub).toBe(`${DEFAULT_IR_DATA_ROOT}/epub-reading`);
		expect(paths.ir.epubBookmarks).toBe(
			`${DEFAULT_IR_DATA_ROOT}/epub-bookmarks`,
		);
		expect(DEFAULT_IR_IMPORT_FOLDER).toBe(`${DEFAULT_IR_DATA_ROOT}/IR`);
	});

	it("treats a custom parent folder as the data root itself", () => {
		expect(normalizeWeaveParentFolder("Archive/IR Data")).toBe(
			"Archive/IR Data",
		);
		expect(getReadableWeaveRoot("Archive/IR Data")).toBe("Archive/IR Data");

		const paths = getV2Paths("Archive/IR Data");
		expect(paths.ir.pointsDir).toBe("Archive/IR Data/points");
		expect(paths.ir.root).toBe("Archive/IR Data");
		expect(paths.ir.epubBookmarks).toBe("Archive/IR Data/epub-bookmarks");
		// Must not append weave or incremental-reading
		expect(paths.ir.pointsDir.includes(`/${WEAVE_DATA}/`)).toBe(false);
		expect(paths.ir.pointsDir.includes("/incremental-reading/")).toBe(false);
	});

	it("keeps legacy weave/incremental-reading as migration source only", () => {
		expect(LEGACY_IR_DATA_ROOT).toBe("weave/incremental-reading");
		expect(getLegacyIRDataRoot()).toBe(LEGACY_IR_DATA_ROOT);
		expect(getLegacyIRDataRoot("Archive")).toBe(
			"Archive/weave/incremental-reading",
		);
		expect(getLegacyIRDataRoot("Archive/weave/incremental-reading")).toBe(
			"Archive/weave/incremental-reading",
		);
	});

	it("resolves import folder defaults and redirects old weave paths", () => {
		expect(getLegacyIRImportFolder()).toBe(`${DEFAULT_IR_DATA_ROOT}/IR`);
		expect(resolveIRImportFolder()).toBe(`${DEFAULT_IR_DATA_ROOT}/IR`);
		expect(resolveIRImportFolder("weave/incremental-reading/IR")).toBe(
			`${DEFAULT_IR_DATA_ROOT}/IR`,
		);
		expect(resolveIRImportFolder("weave")).toBe(`${DEFAULT_IR_DATA_ROOT}/IR`);
		expect(resolveIRImportFolder("Notes/Clippings")).toBe("Notes/Clippings");
	});
});
