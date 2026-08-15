import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	IRDueDateIndexService,
	formatDueDateKeyFromTimestamp,
} from "../IRDueDateIndexService";

vi.mock("../../utils/directory-utils", () => ({
	DirectoryUtils: {
		ensureDirForFile: vi.fn().mockResolvedValue(undefined),
	},
}));

function createMemoryApp(files: Record<string, string> = {}) {
	const store = new Map(Object.entries(files));
	const adapter = {
		exists: vi.fn(async (path: string) => store.has(path)),
		read: vi.fn(async (path: string) => store.get(path) ?? ""),
		write: vi.fn(async (path: string, content: string) => {
			store.set(path, content);
		}),
		mkdir: vi.fn(async () => undefined),
	};
	return {
		app: {
			vault: { adapter, configDir: ".obsidian" },
		} as any,
		store,
	};
}

describe("IRDueDateIndexService invalidateAsync", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("invalidateAsync 落盘后再清空内存", async () => {
		const { app, store } = createMemoryApp();
		const service = new IRDueDateIndexService(app);
		const ts = Date.parse("2026-06-20T00:00:00.000Z");
		const dateKey = formatDueDateKeyFromTimestamp(ts);

		(service as any).memoryStore = {
			version: "1.0.0",
			updatedAt: new Date().toISOString(),
			byDate: { [dateKey!]: ["point-1"] },
			byPointId: { "point-1": dateKey! },
		};
		(service as any).pendingWrite = true;

		await service.invalidateAsync();

		const diskPath =
			".obsidian/plugins/weave-incremental-reading/cache/incremental-reading/ir-due-date-index.json";
		const written = store.get(diskPath);
		expect(written).toBeTruthy();
		const parsed = JSON.parse(written!);
		expect(parsed.byPointId["point-1"]).toBe(dateKey);
		expect((service as any).memoryStore).toBeNull();
	});
});

describe("IRDueDateIndexService warmDiskCache", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("warms from disk without rebuilding from schedule index", async () => {
		const diskPath =
			".obsidian/plugins/weave-incremental-reading/cache/incremental-reading/ir-due-date-index.json";
		const dateKey = "2026-06-20";
		const { app } = createMemoryApp({
			[diskPath]: JSON.stringify({
				version: "1.0.0",
				updatedAt: new Date().toISOString(),
				byDate: { [dateKey]: ["point-warm"] },
				byPointId: { "point-warm": dateKey },
			}),
		});

		const service = new IRDueDateIndexService(app);
		const rebuildSpy = vi.spyOn(service, "rebuildFromScheduleIndex");
		await expect(service.warmDiskCache()).resolves.toBe(true);
		expect(await service.getPointIdsForDate(dateKey)).toEqual(["point-warm"]);
		expect(rebuildSpy).not.toHaveBeenCalled();
		expect(service.isMemoryStoreEmpty()).toBe(false);
	});

	it("rebuildFromWarmScheduleSources does not call rebuildFromScheduleIndex", async () => {
		const { app, store } = createMemoryApp();
		const service = new IRDueDateIndexService(app);
		const nextRep = Date.parse("2026-07-16T12:00:00.000Z");
		const rebuildSpy = vi.spyOn(service, "rebuildFromScheduleIndex");

		await service.rebuildFromWarmScheduleSources({
			chunks: [
				{
					chunkId: "chunk-1",
					nextRepDate: nextRep,
				} as any,
			],
			pdfTasks: [],
			epubTasks: [],
		});

		const dateKey = formatDueDateKeyFromTimestamp(nextRep)!;
		expect(await service.getPointIdsForDate(dateKey)).toEqual(["chunk-1"]);
		expect(rebuildSpy).not.toHaveBeenCalled();
		const diskPath =
			".obsidian/plugins/weave-incremental-reading/cache/incremental-reading/ir-due-date-index.json";
		expect(store.has(diskPath)).toBe(true);
	});

	it("skips rewrite when rebuilt due-index payload matches disk", async () => {
		const nextRep = Date.parse("2026-07-16T12:00:00.000Z");
		const dateKey = formatDueDateKeyFromTimestamp(nextRep)!;
		const diskPath =
			".obsidian/plugins/weave-incremental-reading/cache/incremental-reading/ir-due-date-index.json";
		const { app, store } = createMemoryApp({
			[diskPath]: JSON.stringify(
				{
					version: "1.0.0",
					updatedAt: "2026-01-01T00:00:00.000Z",
					byDate: { [dateKey]: ["chunk-1"] },
					byPointId: { "chunk-1": dateKey },
				},
				null,
				2,
			),
		});
		const service = new IRDueDateIndexService(app);
		const write = (app.vault.adapter as any).write as ReturnType<typeof vi.fn>;
		write.mockClear();

		await service.rebuildFromWarmScheduleSources({
			chunks: [
				{
					chunkId: "chunk-1",
					nextRepDate: nextRep,
				} as any,
			],
			pdfTasks: [],
			epubTasks: [],
		});

		expect(write).not.toHaveBeenCalled();
		expect(store.get(diskPath)).toContain('"chunk-1"');
	});
});
