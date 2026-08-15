vi.mock("obsidian", () => {
	class TFile {
		path: string;
		name: string;
		extension: string;

		constructor(path: string) {
			this.path = path;
			this.name = path.split("/").pop() || "";
			this.extension = this.name.includes(".")
				? this.name.split(".").pop() || ""
				: "";
		}
	}

	class Component {}
	class MarkdownView {}
	class WorkspaceLeaf {}
	class Scope {
		parent: unknown;

		constructor(parent?: unknown) {
			this.parent = parent;
		}

		register = vi.fn();
	}

	return {
		App: class App {},
		Component,
		MarkdownView,
		TFile,
		WorkspaceLeaf,
		Platform: {
			isMobile: false,
		},
		Scope,
		normalizePath: (path: string) =>
			path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, ""),
	};
});

import { TFile } from "obsidian";
import {
	clearActiveWeaveParentFolder,
	setActiveWeaveParentFolder,
} from "../../../config/paths";
import { DetachedLeafEditor } from "../DetachedLeafEditor";

function normalizeTestPath(path: string): string {
	return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function parentPath(path: string): string {
	const normalized = normalizeTestPath(path);
	const index = normalized.lastIndexOf("/");
	return index >= 0 ? normalized.slice(0, index) : "";
}

function createMockTFile(path: string): TFile {
	const name = path.split("/").pop() || "";

	return {
		path,
		name,
		extension: name.includes(".") ? name.split(".").pop() || "" : "",
	} as unknown as TFile;
}

function createMemoryApp(options?: {
	initialFiles?: Record<string, string>;
	weaveParentFolder?: string;
}) {
	const initialFiles = options?.initialFiles ?? {};
	const files = new Map<string, string>();
	const folders = new Set<string>([
		"",
		".obsidian",
		".obsidian/plugins",
		".obsidian/plugins/weave",
	]);

	const ensureDir = (dir: string) => {
		const normalized = normalizeTestPath(dir);
		if (!normalized) return;

		const parts = normalized.split("/");
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			folders.add(current);
		}
	};

	const writeFile = (path: string, content: string) => {
		const normalized = normalizeTestPath(path);
		ensureDir(parentPath(normalized));
		files.set(normalized, content);
	};

	for (const [path, content] of Object.entries(initialFiles)) {
		writeFile(path, content);
	}

	const adapter = {
		exists: async (path: string) => {
			const normalized = normalizeTestPath(path);
			return files.has(normalized) || folders.has(normalized);
		},
		mkdir: async (path: string) => {
			ensureDir(path);
		},
	};

	const vault = {
		configDir: ".obsidian",
		adapter,
		getAbstractFileByPath: (path: string) => {
			const normalized = normalizeTestPath(path);
			if (!files.has(normalized)) return null;
			return createMockTFile(normalized);
		},
		create: async (path: string, content: string) => {
			const normalized = normalizeTestPath(path);
			writeFile(normalized, content);
			return createMockTFile(normalized);
		},
		modify: async (file: { path: string }, content: string) => {
			writeFile(file.path, content);
		},
	};

	const weaveParentFolder = options?.weaveParentFolder;
	const plugins = weaveParentFolder
		? {
				getPlugin: () => ({
					settings: { weaveParentFolder },
				}),
			}
		: undefined;

	return {
		app: {
			scope: {},
			vault,
			...(plugins ? { plugins } : {}),
		} as any,
		files,
	};
}

afterEach(() => {
	vi.restoreAllMocks();
	clearActiveWeaveParentFolder();
});

describe("DetachedLeafEditor temp file placement", () => {
	it("uses the IR data root editor folder when no sourcePath is provided", async () => {
		const { app, files } = createMemoryApp();
		const editor = new DetachedLeafEditor(app, document.createElement("div"), {
			sessionId: "session-1",
			value: "cache",
		});

		await (editor as any).prepareTempFile();

		const { DEFAULT_IR_DATA_ROOT } = await import("../../../config/paths");
		const expectedPath = `${DEFAULT_IR_DATA_ROOT}/editor/weave-editor-session-1.md`;
		expect(files.get(normalizeTestPath(expectedPath))).toBe("cache");
		expect((editor as any).tempFile?.path).toBe(
			normalizeTestPath(expectedPath),
		);
	});

	it("keeps temp files under the IR editor folder even when sourcePath is nested", async () => {
		const { app, files } = createMemoryApp({
			initialFiles: {
				"notes/ch1/source.md": "# source",
			},
		});
		const editor = new DetachedLeafEditor(app, document.createElement("div"), {
			sessionId: "session-2",
			sourcePath: "notes/ch1/source.md",
			value: "nested",
		});

		await (editor as any).prepareTempFile();

		const { DEFAULT_IR_DATA_ROOT } = await import("../../../config/paths");
		const expectedPath = `${DEFAULT_IR_DATA_ROOT}/editor/weave-editor-session-2.md`;
		expect(files.get(normalizeTestPath(expectedPath))).toBe("nested");
		expect((editor as any).tempFile?.path).toBe(
			normalizeTestPath(expectedPath),
		);
	});

	it("keeps temp files under the IR editor folder for root-level source files", async () => {
		const { app, files } = createMemoryApp({
			initialFiles: {
				"source.md": "# root source",
			},
		});
		const editor = new DetachedLeafEditor(app, document.createElement("div"), {
			sessionId: "session-3",
			sourcePath: "source.md",
			value: "root",
		});

		await (editor as any).prepareTempFile();

		const { DEFAULT_IR_DATA_ROOT } = await import("../../../config/paths");
		const expectedPath = `${DEFAULT_IR_DATA_ROOT}/editor/weave-editor-session-3.md`;
		expect(files.get(normalizeTestPath(expectedPath))).toBe("root");
		expect((editor as any).tempFile?.path).toBe(
			normalizeTestPath(expectedPath),
		);
	});

	it("respects a custom IR parent folder from settings", async () => {
		const { app, files } = createMemoryApp({
			initialFiles: {
				"library/book.pdf": "pdf-placeholder",
			},
			weaveParentFolder: "Custom IR Root",
		});
		const editor = new DetachedLeafEditor(app, document.createElement("div"), {
			sessionId: "ir-paragraph-workbench-4",
			sourcePath: "library/book.pdf",
			value: "pdf-note",
		});

		await (editor as any).prepareTempFile();

		const expectedPath =
			"Custom IR Root/editor/weave-editor-ir-paragraph-workbench-4.md";
		expect(files.get(normalizeTestPath(expectedPath))).toBe("pdf-note");
		expect((editor as any).tempFile?.path).toBe(
			normalizeTestPath(expectedPath),
		);
	});

	it("uses explicit weaveParentFolder option even when app.plugins is empty", async () => {
		const { app, files } = createMemoryApp();
		const editor = new DetachedLeafEditor(app, document.createElement("div"), {
			sessionId: "session-explicit",
			weaveParentFolder: "显式IR根",
			value: "explicit",
		});

		await (editor as any).prepareTempFile();

		const expectedPath = "显式IR根/editor/weave-editor-session-explicit.md";
		expect(files.get(normalizeTestPath(expectedPath))).toBe("explicit");
		expect((editor as any).tempFile?.path).toBe(
			normalizeTestPath(expectedPath),
		);
	});

	it("uses registered weaveParentFolder when option is omitted", async () => {
		setActiveWeaveParentFolder("登记IR根");
		const { app, files } = createMemoryApp();
		const editor = new DetachedLeafEditor(app, document.createElement("div"), {
			sessionId: "session-registered",
			value: "registered",
		});

		await (editor as any).prepareTempFile();

		const expectedPath = "登记IR根/editor/weave-editor-session-registered.md";
		expect(files.get(normalizeTestPath(expectedPath))).toBe("registered");
		expect((editor as any).tempFile?.path).toBe(
			normalizeTestPath(expectedPath),
		);
	});
});
