import { beforeEach, describe, expect, it, vi } from "vitest";
import { IRDueDateIndexService, formatDueDateKeyFromTimestamp } from "../IRDueDateIndexService";

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
