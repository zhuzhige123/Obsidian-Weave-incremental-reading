import { describe, expect, it, vi, beforeEach } from "vitest";
import { IROutcomeRecordingService } from "../IROutcomeRecordingService";

describe("IROutcomeRecordingService", () => {
	const applyPointOutcome = vi.fn();
	const invalidateScheduleRuntimeCaches = vi.fn();
	const initializeStorage = vi.fn();
	const getChunkData = vi.fn();
	const saveChunkData = vi.fn();
	const pdfInitialize = vi.fn();
	const pdfGetTask = vi.fn();
	const pdfUpdateTask = vi.fn();
	const epubInitialize = vi.fn();
	const epubGetTask = vi.fn();
	const epubUpdateTask = vi.fn();

	const app = {} as ConstructorParameters<typeof IROutcomeRecordingService>[0];

	beforeEach(() => {
		vi.clearAllMocks();
		initializeStorage.mockResolvedValue(undefined);
		pdfInitialize.mockResolvedValue(undefined);
		epubInitialize.mockResolvedValue(undefined);
		getChunkData.mockResolvedValue(null);
	});

	function createService() {
		return new IROutcomeRecordingService(app, {
			pointStorage: {
				applyPointOutcome,
			} as never,
			storage: {
				initialize: initializeStorage,
				getChunkData,
				saveChunkData,
				invalidateScheduleRuntimeCaches,
			} as never,
			pdfService: {
				initialize: pdfInitialize,
				getTask: pdfGetTask,
				updateTask: pdfUpdateTask,
			} as never,
			epubService: {
				initialize: epubInitialize,
				getTask: epubGetTask,
				updateTask: epubUpdateTask,
			} as never,
		});
	}

	it("rejects invalid input without touching storage", async () => {
		const service = createService();
		const result = await service.recordOutcome({
			pointId: "",
			kind: "memory-card",
		});

		expect(result).toEqual({ ok: false, reason: "invalid_input" });
		expect(applyPointOutcome).not.toHaveBeenCalled();
	});

	it("returns point_not_found when L0 write misses", async () => {
		applyPointOutcome.mockResolvedValue({
			ok: false,
			alreadyLinked: false,
			point: null,
			stats: null,
		});
		const service = createService();

		const result = await service.recordOutcome({
			pointId: "missing",
			kind: "extract",
			artifactId: "card-1",
		});

		expect(result.ok).toBe(false);
		expect(result.reason).toBe("point_not_found");
	});

	it("records memory-card outcomes with real artifact ids and bumps card stats", async () => {
		applyPointOutcome.mockResolvedValue({
			ok: true,
			alreadyLinked: false,
			point: { id: "point-1" },
			stats: {
				extractCount: 0,
				cardCreatedCount: 1,
				noteCreatedCount: 0,
			},
		});
		const service = createService();

		const result = await service.recordOutcome({
			pointId: "point-1",
			kind: "memory-card",
			artifactId: "card-42",
		});

		expect(applyPointOutcome).toHaveBeenCalledWith({
			pointId: "point-1",
			kind: "memory-card",
			artifactId: "card-42",
			notePath: undefined,
			count: 1,
		});
		expect(result).toMatchObject({
			ok: true,
			pointId: "point-1",
			kind: "memory-card",
			linkedArtifactId: "card-42",
			alreadyLinked: false,
			stats: { cardCreatedCount: 1 },
		});
		expect(invalidateScheduleRuntimeCaches).toHaveBeenCalled();
	});

	it("is idempotent when the same card is already linked", async () => {
		applyPointOutcome.mockResolvedValue({
			ok: true,
			alreadyLinked: true,
			point: { id: "point-1" },
			stats: {
				extractCount: 1,
				cardCreatedCount: 0,
				noteCreatedCount: 0,
			},
		});
		const service = createService();

		const result = await service.recordOutcome({
			pointId: "point-1",
			kind: "extract",
			artifactId: "card-1",
		});

		expect(result.ok).toBe(true);
		expect(result.reason).toBe("noop_already_linked");
		expect(invalidateScheduleRuntimeCaches).not.toHaveBeenCalled();
		expect(getChunkData).not.toHaveBeenCalled();
	});

	it("dual-writes chunk stats for markdown/chunk points", async () => {
		applyPointOutcome.mockResolvedValue({
			ok: true,
			alreadyLinked: false,
			point: { id: "chunk-1" },
			stats: {
				extractCount: 1,
				cardCreatedCount: 0,
				noteCreatedCount: 0,
			},
		});
		getChunkData.mockResolvedValue({
			id: "chunk-1",
			stats: {
				extracts: 2,
				cardsCreated: 1,
				notesWritten: 0,
			},
		});
		const service = createService();

		await service.recordOutcome({
			pointId: "chunk-1",
			kind: "extract",
			artifactId: "card-9",
		});

		expect(saveChunkData).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "chunk-1",
				stats: expect.objectContaining({
					extracts: 3,
					cardsCreated: 1,
					notesWritten: 0,
				}),
			}),
		);
	});

	it("dual-writes pdf bookmark task stats", async () => {
		applyPointOutcome.mockResolvedValue({
			ok: true,
			alreadyLinked: false,
			point: { id: "pdfbm-1" },
			stats: {
				extractCount: 0,
				cardCreatedCount: 1,
				noteCreatedCount: 0,
			},
		});
		pdfGetTask.mockResolvedValue({
			id: "pdfbm-1",
			stats: {
				extracts: 0,
				cardsCreated: 4,
				notesWritten: 0,
			},
		});
		const service = createService();

		await service.recordOutcome({
			pointId: "pdfbm-1",
			kind: "memory-card",
			artifactId: "card-7",
		});

		expect(pdfUpdateTask).toHaveBeenCalledWith(
			"pdfbm-1",
			expect.objectContaining({
				stats: expect.objectContaining({
					cardsCreated: 5,
					extracts: 0,
					notesWritten: 0,
				}),
			}),
		);
	});
});
