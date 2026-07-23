import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getV2Paths } from "../../../config/paths";
import { IR_POINT_STORAGE_VERSION } from "../../../types/ir-point-storage-types";
import { IRPointStorageService } from "../IRPointStorageService";

function normalizeTestPath(path: string): string {
	return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function parentPath(path: string): string {
	const normalized = normalizeTestPath(path);
	const idx = normalized.lastIndexOf("/");
	return idx > 0 ? normalized.slice(0, idx) : "";
}

function createMemoryApp() {
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

	const writeText = (path: string, content: string) => {
		const normalized = normalizeTestPath(path);
		ensureDir(parentPath(normalized));
		files.set(normalized, content);
	};

	const adapter = {
		exists: vi.fn(async (path: string) => {
			const normalized = normalizeTestPath(path);
			return files.has(normalized) || folders.has(normalized);
		}),
		mkdir: vi.fn(async (path: string) => {
			ensureDir(path);
		}),
		list: vi.fn(async () => ({ files: [], folders: [] })),
		read: vi.fn(async (path: string) => {
			const value = files.get(normalizeTestPath(path));
			if (value === undefined) {
				throw new Error(`File not found: ${path}`);
			}
			return value;
		}),
		write: vi.fn(async (path: string, content: string) => {
			writeText(path, content);
		}),
		remove: vi.fn(async (path: string) => {
			files.delete(normalizeTestPath(path));
		}),
		rmdir: vi.fn(async () => undefined),
	};

	const app = {
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

	return { app, files };
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-04-16T10:00:00.000Z"));
});

afterEach(() => {
	vi.useRealTimers();
});

describe("IRPointStorageService.applyPointOutcome", () => {
	it("links real card ids and increments the correct stats counters", async () => {
		const { app, files } = createMemoryApp();
		const service = new IRPointStorageService(app);
		const v2Paths = getV2Paths("");

		await service.syncLegacyPoint({
			id: "point-outcome-1",
			topicId: "topic-outcome",
			topicName: "Outcome Topic",
			title: "Outcome Point",
			status: "active",
			sourceType: "ir-chunk",
			sourcePath: "Notes/source.md",
			locatorType: "markdown-chunk",
			locator: { filePath: "Notes/source.md" },
			stats: {
				extracts: 0,
				cardsCreated: 0,
				notesWritten: 0,
			},
		});

		const memory = await service.applyPointOutcome({
			pointId: "point-outcome-1",
			kind: "memory-card",
			artifactId: "card-memory-1",
		});
		expect(memory.ok).toBe(true);
		expect(memory.alreadyLinked).toBe(false);
		expect(memory.stats).toEqual({
			extractCount: 0,
			cardCreatedCount: 1,
			noteCreatedCount: 0,
		});

		const extract = await service.applyPointOutcome({
			pointId: "point-outcome-1",
			kind: "extract",
			artifactId: "card-extract-1",
		});
		expect(extract.stats).toEqual({
			extractCount: 1,
			cardCreatedCount: 1,
			noteCreatedCount: 0,
		});

		const note = await service.applyPointOutcome({
			pointId: "point-outcome-1",
			kind: "note",
			notePath: "Notes/permanent.md",
		});
		expect(note.stats).toEqual({
			extractCount: 1,
			cardCreatedCount: 1,
			noteCreatedCount: 1,
		});

		const again = await service.applyPointOutcome({
			pointId: "point-outcome-1",
			kind: "memory-card",
			artifactId: "card-memory-1",
		});
		expect(again.ok).toBe(true);
		expect(again.alreadyLinked).toBe(true);
		expect(again.stats?.cardCreatedCount).toBe(1);

		const pointFilePath = normalizeTestPath(
			`${v2Paths.ir.root}/points/Outcome Topic.irdeck`,
		);
		const pointFile = JSON.parse(files.get(pointFilePath) || "{}");
		expect(pointFile.schemaVersion).toBe(IR_POINT_STORAGE_VERSION);
		expect(pointFile.points[0].relations.linkedCardIds).toEqual([
			"card-memory-1",
			"card-extract-1",
		]);
		expect(pointFile.points[0].relations.linkedNotePaths).toEqual([
			"Notes/permanent.md",
		]);
	});
});
