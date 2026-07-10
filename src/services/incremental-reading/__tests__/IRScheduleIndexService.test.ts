import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStandaloneIRTestApp } from "./standalone-ir-test-app";
import {
	buildExternalBookmarkTasksRevision,
	buildPointFilesIndexRevision,
} from "../IRScheduleFingerprint";
import {
	IRScheduleIndexService,
	IR_SCHEDULE_INDEX_VERSION,
} from "../IRScheduleIndexService";

const getPointFilesIndexRevisionMock = vi.fn();
const listPointSnapshotsMock = vi.fn();

vi.mock("../IRPointStorageService", () => ({
	getSharedIRPointStorageService: () => ({
		initialize: vi.fn().mockResolvedValue(undefined),
		getPointFilesIndexRevision: getPointFilesIndexRevisionMock,
		listPointSnapshots: listPointSnapshotsMock,
	}),
}));

vi.mock("../IRPdfBookmarkTaskService", () => ({
	IRPdfBookmarkTaskService: class {
		initialize = vi.fn().mockResolvedValue(undefined);
		getAllTasks = vi.fn().mockResolvedValue([]);
	},
}));

vi.mock("../IREpubBookmarkTaskService", () => ({
	IREpubBookmarkTaskService: class {
		initialize = vi.fn().mockResolvedValue(undefined);
		getAllTasks = vi.fn().mockResolvedValue([]);
	},
}));

function createIndexService(): IRScheduleIndexService {
	return new IRScheduleIndexService(createStandaloneIRTestApp() as any);
}

describe("IRScheduleIndexService", () => {
	const sampleRevision = buildPointFilesIndexRevision({
		schemaVersion: 1,
		updatedAt: "2026-06-19T00:00:00.000Z",
		files: [],
	});

	beforeEach(() => {
		vi.clearAllMocks();
		getPointFilesIndexRevisionMock.mockResolvedValue(sampleRevision);
		listPointSnapshotsMock.mockResolvedValue([]);
	});

	it("normalizes unsupported index versions to null", () => {
		const service = createIndexService();
		const normalized = (service as any).normalizeStore({
			version: "0.9.0",
			updatedAt: new Date().toISOString(),
			pointFilesRevision: sampleRevision,
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
			pointFilesRevision: sampleRevision,
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

	it("migrates legacy 1.0.0 stores without pointFilesRevision as stale", async () => {
		const service = createIndexService();
		const legacyStore = {
			version: "1.0.0",
			updatedAt: new Date().toISOString(),
			snapshotCacheVersion: 3,
			externalTasksRevision: "",
			scheduleFingerprint: "legacy-fp",
			chunks: [],
			blocks: [],
			pdfTasks: [],
			epubTasks: [],
		};

		await expect((service as any).isStoreFresh(legacyStore)).resolves.toBe(
			false,
		);
	});

	it("treats disk store as fresh when pointFilesRevision matches across restart", async () => {
		const service = createIndexService();
		const store = {
			version: IR_SCHEDULE_INDEX_VERSION,
			updatedAt: new Date().toISOString(),
			pointFilesRevision: sampleRevision,
			externalTasksRevision: buildExternalBookmarkTasksRevision([]),
			scheduleFingerprint: "schedule-fp",
			chunks: [],
			blocks: [],
			pdfTasks: [],
			epubTasks: [],
		};

		await expect((service as any).isStoreFresh(store)).resolves.toBe(true);
	});

	it("warmDiskCache uses point-files revision only and does not require external task scan", async () => {
		const service = createIndexService();
		const store = {
			version: IR_SCHEDULE_INDEX_VERSION,
			updatedAt: new Date().toISOString(),
			pointFilesRevision: sampleRevision,
			externalTasksRevision: "stale-external-revision",
			scheduleFingerprint: "schedule-fp",
			chunks: [],
			blocks: [],
			pdfTasks: [],
			epubTasks: [],
		};

		vi.spyOn(service as any, "readDiskStore").mockResolvedValue(store);

		await expect(service.warmDiskCache()).resolves.toBe(true);
		await expect(service.peekScheduleFingerprint()).resolves.toBe(
			"schedule-fp",
		);
	});

	it("peekScheduleFingerprint returns null without throwing when cache is empty", async () => {
		const service = createIndexService();
		await expect(service.peekScheduleFingerprint()).resolves.toBeNull();
	});
});
