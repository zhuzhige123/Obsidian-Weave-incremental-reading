import { afterEach, describe, expect, it } from "vitest";
import {
	DEFAULT_IR_DATA_ROOT,
	clearActiveWeaveParentFolder,
	setActiveWeaveParentFolder,
} from "../../../config/paths";
import {
	getPluginEditorTempDir,
	getVaultEditorTempDir,
	isDetachedEditorTempFilePath,
	isLegacyModalEditorPermanentFilePath,
	isPluginCacheModalEditorPermanentFilePath,
	resolveDetachedEditorTempFolder,
} from "../editor-temp-file-policy";

describe("editor-temp-file-policy", () => {
	afterEach(() => {
		clearActiveWeaveParentFolder();
	});

	it("detects detached editor temp files by path", () => {
		expect(isDetachedEditorTempFilePath("weave-editor-123.md")).toBe(true);
		expect(isDetachedEditorTempFilePath("notes/weave-editor-session.md")).toBe(
			true,
		);
		expect(isDetachedEditorTempFilePath("notes/weave-editor-session.txt")).toBe(
			false,
		);
		expect(isDetachedEditorTempFilePath("notes/real-note.md")).toBe(false);
	});

	it("always resolves detached editor temp folders under the IR data root editor dir", () => {
		const defaultApp = {
			vault: { configDir: ".obsidian" },
		} as any;
		const customApp = {
			vault: { configDir: "custom-config" },
			plugins: {
				getPlugin: () => ({
					settings: { weaveParentFolder: "My IR Data" },
				}),
			},
		} as any;
		const vaultEditorDir = `${DEFAULT_IR_DATA_ROOT}/editor`;

		expect(getPluginEditorTempDir(defaultApp)).toBe(
			".obsidian/plugins/weave-incremental-reading/cache/editor-temp",
		);
		expect(getPluginEditorTempDir(customApp)).toBe(
			"custom-config/plugins/weave-incremental-reading/cache/editor-temp",
		);
		expect(getVaultEditorTempDir(defaultApp)).toBe(vaultEditorDir);
		expect(getVaultEditorTempDir(customApp)).toBe("My IR Data/editor");
		expect(resolveDetachedEditorTempFolder(defaultApp)).toBe(vaultEditorDir);
		expect(
			resolveDetachedEditorTempFolder(defaultApp, "notes/ch1/source.md"),
		).toBe(vaultEditorDir);
		expect(
			resolveDetachedEditorTempFolder(defaultApp, "library/book.pdf"),
		).toBe(vaultEditorDir);
		expect(
			resolveDetachedEditorTempFolder(defaultApp, "library/book.epub"),
		).toBe(vaultEditorDir);
		expect(resolveDetachedEditorTempFolder(defaultApp, "notes/ch1")).toBe(
			vaultEditorDir,
		);
		expect(resolveDetachedEditorTempFolder(defaultApp, "source.md")).toBe(
			vaultEditorDir,
		);
		expect(
			resolveDetachedEditorTempFolder(customApp, "notes/ch1/source.md"),
		).toBe("My IR Data/editor");
	});

	it("uses explicit parentFolder without needing app.plugins", () => {
		const bareApp = {
			vault: { configDir: ".obsidian" },
		} as any;

		expect(getVaultEditorTempDir(bareApp, "自定义IR")).toBe("自定义IR/editor");
		expect(
			resolveDetachedEditorTempFolder(bareApp, "notes/a.md", "自定义IR"),
		).toBe("自定义IR/editor");
	});

	it("prefers registered weaveParentFolder over missing getPlugin", () => {
		setActiveWeaveParentFolder("Registered IR");
		const bareApp = {
			vault: { configDir: ".obsidian" },
		} as any;

		expect(getVaultEditorTempDir(bareApp)).toBe("Registered IR/editor");
	});

	it("resolves weaveParentFolder via plugins.plugins map", () => {
		const app = {
			vault: { configDir: ".obsidian" },
			plugins: {
				plugins: {
					"weave-incremental-reading": {
						settings: { weaveParentFolder: "Map IR Root" },
					},
				},
			},
		} as any;

		expect(getVaultEditorTempDir(app)).toBe("Map IR Root/editor");
	});


	it("keeps invalid source paths on the IR editor directory", () => {
		const app = {
			vault: { configDir: ".obsidian" },
		} as any;
		const vaultEditorDir = `${DEFAULT_IR_DATA_ROOT}/editor`;

		expect(
			resolveDetachedEditorTempFolder(
				app,
				"obsidian://weave-epub?vault=Vault&file=Books%2Fdemo.epub",
			),
		).toBe(vaultEditorDir);
		expect(
			resolveDetachedEditorTempFolder(app, "C:/Users/lihua/Desktop/book.md"),
		).toBe(vaultEditorDir);
		expect(resolveDetachedEditorTempFolder(app, "../outside/note.md")).toBe(
			vaultEditorDir,
		);
		expect(resolveDetachedEditorTempFolder(app, ".")).toBe(vaultEditorDir);
	});

	it("distinguishes plugin cache modal buffers from legacy modal buffers", () => {
		const app = {
			vault: { configDir: ".obsidian" },
		} as any;

		expect(
			isPluginCacheModalEditorPermanentFilePath(
				app,
				".obsidian/plugins/weave-incremental-reading/cache/editor-temp/modal-editor-permanent-2.md",
			),
		).toBe(true);
		expect(
			isLegacyModalEditorPermanentFilePath(
				"weave/editor/modal-editor-permanent.md",
			),
		).toBe(false);
		expect(
			isLegacyModalEditorPermanentFilePath(
				"weave/temp/modal-editor-permanent.md",
			),
		).toBe(true);
		expect(
			isLegacyModalEditorPermanentFilePath(
				"projects/weave/temp/modal-editor-permanent-4.md",
			),
		).toBe(true);
		expect(
			isLegacyModalEditorPermanentFilePath(
				".tuanki/temp/modal-editor-permanent.md",
			),
		).toBe(true);
		expect(
			isLegacyModalEditorPermanentFilePath(
				"notes/temp/modal-editor-permanent.md",
			),
		).toBe(false);
	});
});
