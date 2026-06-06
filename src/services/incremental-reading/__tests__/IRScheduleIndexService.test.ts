import { IR_SCHEDULE_INDEX_VERSION, IRScheduleIndexService } from "../IRScheduleIndexService";

function createIndexService(): IRScheduleIndexService {
	return new IRScheduleIndexService({
		vault: {
			adapter: {
				exists: vi.fn(async () => false),
				read: vi.fn(async () => ""),
				write: vi.fn(async () => undefined),
			},
		},
	} as any);
}

describe("IRScheduleIndexService", () => {
	it("normalizes unsupported index versions to null", () => {
		const service = createIndexService();
		const normalized = (service as any).normalizeStore({
			version: "0.9.0",
			updatedAt: new Date().toISOString(),
			snapshotCacheVersion: 1,
			externalTasksRevision: "x",
			scheduleFingerprint: "y",
			chunks: [],
			blocks: [],
			pdfTasks: [],
			epubTasks: [],
		});

		expect(normalized).toBeNull();
	});

	it("accepts the current schedule index version", () => {
		const service = createIndexService();
		const normalized = (service as any).normalizeStore({
			version: IR_SCHEDULE_INDEX_VERSION,
			updatedAt: new Date().toISOString(),
			snapshotCacheVersion: 1,
			externalTasksRevision: "x",
			scheduleFingerprint: "y",
			chunks: [{ chunkId: "c1" }],
			blocks: [],
			pdfTasks: [],
			epubTasks: [],
		});

		expect(normalized?.version).toBe(IR_SCHEDULE_INDEX_VERSION);
		expect(normalized?.chunks).toHaveLength(1);
	});
});
