vi.mock("obsidian", async () => {
	const actual = await vi.importActual<
		typeof import("../../../tests/mocks/obsidian")
	>("../../../tests/mocks/obsidian");
	return {
		...actual,
		normalizePath: (path: string) =>
			String(path ?? "")
				.replace(/\\/g, "/")
				.replace(/\/+/g, "/")
				.replace(/\/$/, ""),
		Platform: { ...actual.Platform, isMobile: false },
		TAbstractFile: class TAbstractFile {},
	};
});

vi.mock("../../../config/paths", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../../config/paths")>();
	return {
		...actual,
		getReadableWeaveRoot: () => "weave",
		normalizeWeaveParentFolder: (value?: string) => value?.trim?.() || "",
		getPluginPaths: () => ({
			state: {
				incrementalReading: {
					root: ".obsidian/plugins/weave/data/state/incremental-reading",
					readingMaterialsRuntime:
						".obsidian/plugins/weave/data/state/incremental-reading/reading-materials-runtime.json",
					epubReaderData:
						".obsidian/plugins/weave/data/state/incremental-reading/epub-reader-data.json",
					monitoring:
						".obsidian/plugins/weave/data/state/incremental-reading/monitoring.json",
					history:
						".obsidian/plugins/weave/data/state/incremental-reading/history.json",
					studySessions:
						".obsidian/plugins/weave/data/state/incremental-reading/study-sessions.json",
					calendarProgress:
						".obsidian/plugins/weave/data/state/incremental-reading/calendar-progress.json",
					readerState:
						".obsidian/plugins/weave/data/state/incremental-reading/reader-state",
				},
			},
			cache: {
				root: ".obsidian/plugins/weave/data/cache",
				incrementalReading: {
					root: ".obsidian/plugins/weave/data/cache/incremental-reading",
					documentGroupMap:
						".obsidian/plugins/weave/data/cache/incremental-reading/document-group-map.json",
					pointFilesIndex:
						".obsidian/plugins/weave/data/cache/incremental-reading/point-files-index.json",
					syncState:
						".obsidian/plugins/weave/data/cache/incremental-reading/sync-state.json",
					readerArtifacts:
						".obsidian/plugins/weave/data/cache/incremental-reading/reader-artifacts",
				},
			},
			migration: {
				root: ".obsidian/plugins/weave/data/cache/migration",
			},
			backups: ".obsidian/plugins/weave/data/backups",
		}),
		getPluginPathsById: (_app: any, pluginId = "weave") => ({
			state: {
				incrementalReading: {
					root: `.obsidian/plugins/${pluginId}/data/state/incremental-reading`,
					readingMaterialsRuntime: `.obsidian/plugins/${pluginId}/data/state/incremental-reading/reading-materials-runtime.json`,
					epubReaderData: `.obsidian/plugins/${pluginId}/data/state/incremental-reading/epub-reader-data.json`,
					monitoring: `.obsidian/plugins/${pluginId}/data/state/incremental-reading/monitoring.json`,
					history: `.obsidian/plugins/${pluginId}/data/state/incremental-reading/history.json`,
					studySessions: `.obsidian/plugins/${pluginId}/data/state/incremental-reading/study-sessions.json`,
					calendarProgress: `.obsidian/plugins/${pluginId}/data/state/incremental-reading/calendar-progress.json`,
					readerState: `.obsidian/plugins/${pluginId}/data/state/incremental-reading/reader-state`,
				},
			},
			cache: {
				root: `.obsidian/plugins/${pluginId}/data/cache`,
				incrementalReading: {
					root: `.obsidian/plugins/${pluginId}/data/cache/incremental-reading`,
					documentGroupMap: `.obsidian/plugins/${pluginId}/data/cache/incremental-reading/document-group-map.json`,
					pointFilesIndex: `.obsidian/plugins/${pluginId}/data/cache/incremental-reading/point-files-index.json`,
					syncState: `.obsidian/plugins/${pluginId}/data/cache/incremental-reading/sync-state.json`,
					readerArtifacts: `.obsidian/plugins/${pluginId}/data/cache/incremental-reading/reader-artifacts`,
				},
			},
			migration: {
				root: `.obsidian/plugins/${pluginId}/data/cache/migration`,
			},
			backups: `.obsidian/plugins/${pluginId}/data/backups`,
		}),
	};
});

const epubContentFingerprints = new Map<string, string>();

vi.mock("../../epub-integration/ir-epub-storage-access", () => {
	const sourceByFingerprint = new Map<string, string>();
	return {
		getIrEpubStorageService: () => ({
			async ensureSourceIdentity(
				filePath: string,
				options?: { preferredSourceId?: string },
			) {
				if (options?.preferredSourceId) {
					return { sourceId: options.preferredSourceId, filePath };
				}
				const fingerprint = epubContentFingerprints.get(
					filePath.replace(/\\/g, "/").replace(/\/+/g, "/"),
				);
				if (fingerprint) {
					let sourceId = sourceByFingerprint.get(fingerprint);
					if (!sourceId) {
						sourceId = `src-${fingerprint}`;
						sourceByFingerprint.set(fingerprint, sourceId);
					}
					return { sourceId, filePath };
				}
				return { sourceId: `src-${filePath}`, filePath };
			},
			async resolveSourceFilePath(sourceId: string, fallbackPath?: string) {
				return fallbackPath || sourceId;
			},
		}),
	};
});

import { IREpubBookmarkTaskService } from "../IREpubBookmarkTaskService";
import { IRPdfBookmarkTaskService } from "../IRPdfBookmarkTaskService";

function normalizeTestPath(path: string | null | undefined): string {
	return String(path ?? "")
		.replace(/\\/g, "/")
		.replace(/\/+/g, "/")
		.replace(/\/$/, "");
}

function parentPath(path: string): string {
	const normalized = normalizeTestPath(path);
	const idx = normalized.lastIndexOf("/");
	return idx > 0 ? normalized.slice(0, idx) : "";
}

function createMemoryApp(
	initialFiles: Record<string, string> = {},
	binaryFiles: Record<string, string> = {},
) {
	epubContentFingerprints.clear();
	for (const [path, content] of Object.entries(binaryFiles)) {
		epubContentFingerprints.set(normalizeTestPath(path), content);
	}

	const files = new Map<string, string>();
	const folders = new Set<string>([
		"",
		".obsidian",
		".obsidian/plugins",
		".obsidian/plugins/weave",
	]);
	const binaries = new Map<string, string>(
		Object.entries(binaryFiles).map(([path, content]) => [
			normalizeTestPath(path),
			content,
		]),
	);

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

	const writeText = (path: string, content: string) => {
		const normalized = normalizeTestPath(path);
		ensureDir(parentPath(normalized));
		files.set(normalized, content);
	};

	for (const [path, content] of Object.entries(initialFiles)) {
		writeText(path, content);
	}

	const adapter = {
		exists: vi.fn(async (path: string) => {
			if (!path) {
				return false;
			}
			const normalized = normalizeTestPath(path);
			return (
				files.has(normalized) ||
				folders.has(normalized) ||
				binaries.has(normalized)
			);
		}),
		mkdir: vi.fn(async (path: string) => {
			ensureDir(path);
		}),
		list: vi.fn(async (dir: string) => {
			const normalized = normalizeTestPath(dir);
			const prefix = normalized ? `${normalized}/` : "";
			const childFolders = new Set<string>();
			const childFiles: string[] = [];

			for (const folder of folders) {
				if (!folder || folder === normalized || !folder.startsWith(prefix))
					continue;
				const rest = folder.slice(prefix.length);
				if (!rest || rest.includes("/")) continue;
				childFolders.add(folder);
			}

			for (const file of files.keys()) {
				if (!file.startsWith(prefix)) continue;
				const rest = file.slice(prefix.length);
				if (!rest || rest.includes("/")) continue;
				childFiles.push(file);
			}

			return {
				files: childFiles.sort(),
				folders: Array.from(childFolders).sort(),
			};
		}),
		read: vi.fn(async (path: string) => {
			const normalized = normalizeTestPath(path);
			const value = files.get(normalized);
			if (value === undefined) {
				throw new Error(`File not found: ${normalized}`);
			}
			return value;
		}),
		write: vi.fn(async (path: string, content: string) => {
			writeText(path, content);
		}),
		remove: vi.fn(async (path: string) => {
			files.delete(normalizeTestPath(path));
		}),
		stat: vi.fn(async (path: string) => {
			const normalized = normalizeTestPath(path);
			if (!binaries.has(normalized)) {
				throw new Error(`Missing file: ${normalized}`);
			}
			return { size: 1024, mtime: 1710000000000 };
		}),
		readBinary: vi.fn(async (path: string) => {
			const normalized = normalizeTestPath(path);
			const value = binaries.get(normalized);
			if (value === undefined) {
				throw new Error(`Missing file: ${normalized}`);
			}
			return new TextEncoder().encode(value);
		}),
	};

	return {
		vault: {
			configDir: ".obsidian",
			adapter,
		},
		plugins: {
			getPlugin: vi.fn(() => ({
				settings: { weaveParentFolder: "" },
			})),
		},
	} as any;
}

describe("bookmark task update merging", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-08T10:00:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("pdf bookmark updates preserve existing meta and stats fields", async () => {
		const service = new IRPdfBookmarkTaskService(createMemoryApp());
		const task = await service.createTask({
			topicId: "deck-1",
			pdfPath: "Books/Test.pdf",
			title: "Test",
			link: "obsidian://pdf",
		});

		const updated = await service.updateTask(task.id, {
			meta: {
				associatedNotePath: "Inbox/Linked.md",
			} as any,
			stats: {
				notesWritten: 3,
			} as any,
		});

		expect(updated).not.toBeNull();
		expect(updated?.meta.associatedNotePath).toBe("Inbox/Linked.md");
		expect(updated?.meta.siblings).toEqual({ prev: null, next: null });
		expect(updated?.meta.priorityLog).toEqual(task.meta.priorityLog);
		expect(updated?.stats.notesWritten).toBe(3);
		expect(updated?.stats.impressions).toBe(task.stats.impressions);
	});

	it("epub bookmark updates preserve existing meta and stats fields", async () => {
		const service = new IREpubBookmarkTaskService(createMemoryApp());
		const task = await service.createTask({
			topicId: "deck-1",
			epubFilePath: "Books/Test.epub",
			title: "Chapter 1",
			tocHref: "chapter-1.xhtml",
			tocLevel: 1,
		});

		const updated = await service.updateTask(task.id, {
			meta: {
				associatedNotePath: "Inbox/Epub-Linked.md",
			} as any,
			stats: {
				notesWritten: 5,
			} as any,
		});

		expect(updated).not.toBeNull();
		expect(updated?.meta.associatedNotePath).toBe("Inbox/Epub-Linked.md");
		expect(updated?.meta.siblings).toEqual({ prev: null, next: null });
		expect(updated?.meta.priorityLog).toEqual(task.meta.priorityLog);
		expect(updated?.stats.notesWritten).toBe(5);
		expect(updated?.stats.impressions).toBe(task.stats.impressions);
		expect(updated?.tocLevel).toBe(1);
	});

	it("epub bookmark creation normalizes legacy 0-based toc levels to 1-based storage", async () => {
		const service = new IREpubBookmarkTaskService(createMemoryApp());

		const task = await service.createTask({
			topicId: "deck-1",
			epubFilePath: "Books/Test.epub",
			title: "Legacy Level Input",
			tocHref: "chapter-legacy.xhtml",
			tocLevel: 0,
		});

		expect(task.tocLevel).toBe(1);
	});

	it("pdf bookmark tasks support mixed deck identifiers", async () => {
		const service = new IRPdfBookmarkTaskService(createMemoryApp());

		const canonical = await service.createTask({
			deckId: "deck-1",
			pdfPath: "Books/Test.pdf",
			title: "Canonical",
			link: "obsidian://canonical",
		});
		const legacy = await service.createTask({
			deckId: "Books/Test.pdf::deck",
			pdfPath: "Books/Test.pdf",
			title: "Legacy",
			link: "obsidian://legacy",
		});

		const tasks = await service.getTasksByDeckIdentifiers([
			"deck-1",
			" Books/Test.pdf::deck ",
			"deck-1",
		]);

		expect(tasks.map((task) => task.id).sort()).toEqual(
			[canonical.id, legacy.id].sort(),
		);
	});

	it("epub bookmark tasks support mixed deck identifiers", async () => {
		const service = new IREpubBookmarkTaskService(createMemoryApp());

		const canonical = await service.createTask({
			deckId: "deck-1",
			epubFilePath: "Books/Test.epub",
			title: "Chapter 1",
			tocHref: "chapter-1.xhtml",
			tocLevel: 1,
		});
		const legacy = await service.createTask({
			deckId: "Books/Test.epub::deck",
			epubFilePath: "Books/Test.epub",
			title: "Chapter 2",
			tocHref: "chapter-2.xhtml",
			tocLevel: 1,
		});

		const tasks = await service.getTasksByDeckIdentifiers([
			"deck-1",
			"Books/Test.epub::deck",
			"",
		]);

		expect(tasks.map((task) => task.id).sort()).toEqual(
			[canonical.id, legacy.id].sort(),
		);
	});

	it("epub bookmark tasks keep a stable sourceId when the same file is re-added under a new path", async () => {
		const service = new IREpubBookmarkTaskService(
			createMemoryApp(
				{},
				{
					"Books/Test.epub": "same-epub-binary",
					"Library/Test Renamed.epub": "same-epub-binary",
				},
			),
		);

		const original = await service.createTask({
			deckId: "deck-1",
			epubFilePath: "Books/Test.epub",
			title: "Chapter 1",
			tocHref: "chapter-1.xhtml",
			tocLevel: 1,
		});

		expect(original.sourceId).toBeTruthy();

		const renamed = await service.createTask({
			deckId: "deck-1",
			epubFilePath: "Library/Test Renamed.epub",
			title: "Chapter 2",
			tocHref: "chapter-2.xhtml",
			tocLevel: 1,
		});

		expect(renamed.sourceId).toBe(original.sourceId);

		const matched = await service.getTasksByEpub("Library/Test Renamed.epub");
		expect(matched.map((task) => task.id).sort()).toEqual(
			[original.id, renamed.id].sort(),
		);
	});
});
