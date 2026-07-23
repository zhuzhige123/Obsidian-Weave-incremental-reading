import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveReadingTargetSchedulePin } from "../IRReadingTargetScheduleDate";

const {
	getTaskMock,
	updateTaskMock,
	getChunkDataMock,
	getBlockMock,
	createPdfPointMock,
	deletePointMock,
	getDeckByIdMock,
	saveDeckMock,
	saveChunkDataMock,
	getAllChunkDataMock,
	getBlocksByFileMock,
	initializeStorageMock,
	initializePdfMock,
	recomputeMock,
	updatePointDueDateMock,
	flushPendingWritesMock,
	ensureVaultMock,
} = vi.hoisted(() => ({
	getTaskMock: vi.fn(),
	updateTaskMock: vi.fn(),
	getChunkDataMock: vi.fn(),
	getBlockMock: vi.fn(),
	createPdfPointMock: vi.fn(),
	deletePointMock: vi.fn(),
	getDeckByIdMock: vi.fn(),
	saveDeckMock: vi.fn(),
	saveChunkDataMock: vi.fn(),
	getAllChunkDataMock: vi.fn(),
	getBlocksByFileMock: vi.fn(),
	initializeStorageMock: vi.fn(),
	initializePdfMock: vi.fn(),
	recomputeMock: vi.fn(),
	updatePointDueDateMock: vi.fn(),
	flushPendingWritesMock: vi.fn(),
	ensureVaultMock: vi.fn(),
}));

vi.mock("../../IRStorageService", () => ({
	IRStorageService: class {
		initialize = initializeStorageMock;
		getChunkData = getChunkDataMock;
		getBlock = getBlockMock;
		getDeckById = getDeckByIdMock;
		saveDeck = saveDeckMock;
		getAllChunkData = getAllChunkDataMock;
		getBlocksByFile = getBlocksByFileMock;
		saveBlock = vi.fn();
		saveChunkData = saveChunkDataMock;
		addBlocksToDeck = vi.fn();
	},
}));

vi.mock("../../IRPdfBookmarkTaskService", () => ({
	isPdfBookmarkTaskId: (id: string) => String(id || "").startsWith("pdfbm-"),
	IRPdfBookmarkTaskService: class {
		initialize = initializePdfMock;
		getTask = getTaskMock;
		updateTask = updateTaskMock;
	},
}));

vi.mock("../../IREpubBookmarkTaskService", () => ({
	isEpubBookmarkTaskId: (id: string) => String(id || "").startsWith("epubbm-"),
	IREpubBookmarkTaskService: class {
		initialize = vi.fn();
		getTasksByEpub = vi.fn(async () => []);
		setResumePoint = vi.fn();
	},
}));

vi.mock("../../IRPointStorageService", () => ({
	IRPointStorageService: class {
		initialize = vi.fn();
		getPointSnapshotById = vi.fn(async () => null);
		syncLegacyPoint = vi.fn();
	},
}));

vi.mock("../../IRPointWriteService", () => ({
	IRPointWriteService: class {
		createPdfPoint = createPdfPointMock;
		deletePoint = deletePointMock;
		createEpubPoint = vi.fn();
	},
}));

vi.mock("../../IRHostSharedService", () => ({
	IRHostSharedService: class {
		cleanIRReadingPointTitle = (title: string) => String(title || "").trim();
		ensureExternalDocumentChunkScheduled = vi.fn(async () => true);
	},
}));

vi.mock("../../IRScheduleRefreshService", () => ({
	recomputeAndBroadcastIRData: recomputeMock,
}));

vi.mock("../../IRDueDateIndexService", () => ({
	getSharedIRDueDateIndexService: () => ({
		updatePointDueDate: updatePointDueDateMock,
		flushPendingWrites: flushPendingWritesMock,
	}),
}));

vi.mock("../../IRLegacyPointUnificationService", () => ({
	getSharedIRLegacyPointUnificationService: () => ({
		upgradeLegacyBlockPointById: vi.fn(async () => false),
	}),
}));

vi.mock("../IRReadingTargetVaultChunk", () => ({
	ensureVaultReadingTargetScheduled: ensureVaultMock,
}));

vi.mock("../../../epub-integration/ir-epub-storage-access", () => ({
	getIrEpubStorageService: () => ({
		resolveSourceFilePath: vi.fn(async () => null),
	}),
}));

import {
	IRReadingTargetAddService,
	applyReadingTargetSchedulePin,
} from "../IRReadingTargetAddService";

describe("applyReadingTargetSchedulePin", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeStorageMock.mockResolvedValue(undefined);
		initializePdfMock.mockResolvedValue(undefined);
	});

	it("throws when the pdf point cannot be found", async () => {
		getTaskMock.mockResolvedValue(null);
		await expect(
			applyReadingTargetSchedulePin(
				{} as never,
				"pdfbm-missing",
				resolveReadingTargetSchedulePin(new Date(2026, 6, 16)),
			),
		).rejects.toThrow("reading-target-schedule-pin-failed");
	});

	it("updates an existing pdf point schedule pin", async () => {
		getTaskMock.mockResolvedValue({ id: "pdfbm-1" });
		updateTaskMock.mockResolvedValue(undefined);
		const pin = resolveReadingTargetSchedulePin(new Date(2026, 6, 16));

		await applyReadingTargetSchedulePin(
			{} as never,
			"pdfbm-1",
			pin,
			"book.pdf#page=1",
		);

		expect(updateTaskMock).toHaveBeenCalledWith(
			"pdfbm-1",
			expect.objectContaining({
				nextRepDate: pin.nextRepDate,
				meta: expect.objectContaining({
					sourceSequenceLocked: true,
					sourceSequenceAnchorDateKey: pin.dateKey,
					resumeLink: "book.pdf#page=1",
				}),
			}),
		);
	});
});

describe("IRReadingTargetAddService pdf-batch", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeStorageMock.mockResolvedValue(undefined);
		getDeckByIdMock.mockResolvedValue({
			id: "deck-1",
			name: "Demo",
			blockIds: [],
			sourceFiles: [],
		});
		saveDeckMock.mockResolvedValue(undefined);
		recomputeMock.mockResolvedValue(undefined);
		updatePointDueDateMock.mockResolvedValue(undefined);
		flushPendingWritesMock.mockResolvedValue(undefined);
		deletePointMock.mockResolvedValue(true);
		getTaskMock.mockImplementation(async (id: string) =>
			id.startsWith("pdfbm-") ? { id } : null,
		);
		updateTaskMock.mockResolvedValue(undefined);
	});

	it("rolls back created pdf points when a later batch item fails", async () => {
		createPdfPointMock
			.mockResolvedValueOnce({ id: "pdfbm-1" })
			.mockRejectedValueOnce(new Error("disk full"));

		const service = new IRReadingTargetAddService({} as never);
		await expect(
			service.addReadingTarget({
				title: "Batch",
				deckId: "deck-1",
				scheduleDate: new Date(2026, 6, 16),
				target: {
					kind: "pdf-batch",
					rawInput: "batch",
					resumeLink: "a.pdf#page=1",
					pdfPoints: [
						{
							title: "A",
							resumeLink: "a.pdf#page=1",
							pdfPath: "a.pdf",
						},
						{
							title: "B",
							resumeLink: "b.pdf#page=2",
							pdfPath: "b.pdf",
						},
					],
				},
			}),
		).rejects.toThrow("reading-target-pdf-batch-failed");

		expect(deletePointMock).toHaveBeenCalledWith({
			id: "pdfbm-1",
			kind: "pdf",
		});
		expect(recomputeMock).not.toHaveBeenCalled();
	});

	it("rejects missing title before writing", async () => {
		const service = new IRReadingTargetAddService({} as never);
		await expect(
			service.addReadingTarget({
				title: "   ",
				deckId: "deck-1",
				scheduleDate: new Date(2026, 6, 16),
				target: {
					kind: "web",
					rawInput: "https://example.com",
					resumeLink: "https://example.com",
					webUrl: "https://example.com",
				},
			}),
		).rejects.toThrow("reading-target-missing-title");
	});
});

describe("IRReadingTargetAddService vault lightweight", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeStorageMock.mockResolvedValue(undefined);
		getDeckByIdMock.mockResolvedValue({
			id: "deck-1",
			name: "Demo",
			blockIds: [],
			sourceFiles: [],
		});
		getBlocksByFileMock.mockResolvedValue([]);
		getAllChunkDataMock.mockResolvedValue({});
		getChunkDataMock.mockResolvedValue(null);
		recomputeMock.mockResolvedValue(undefined);
		updatePointDueDateMock.mockResolvedValue(undefined);
		flushPendingWritesMock.mockResolvedValue(undefined);
		ensureVaultMock.mockResolvedValue({
			result: "created",
			pointId: "chunk-vault-1",
		});
	});

	it("writes a vault chunk (not legacy-block) and uses lean scoped recompute", async () => {
		const scheduleDate = new Date(2026, 6, 16);
		const pin = resolveReadingTargetSchedulePin(scheduleDate);
		const service = new IRReadingTargetAddService({} as never);

		const result = await service.addReadingTarget({
			title: "段落",
			deckId: "deck-1",
			scheduleDate,
			createNote: false,
			target: {
				kind: "vault-block",
				rawInput: "[[Notes/Demo.md#^abc123]]",
				resumeLink: "Notes/Demo.md#^abc123",
				sourceFilePath: "Notes/Demo.md",
				blockId: "abc123",
			},
		});

		expect(ensureVaultMock).toHaveBeenCalledWith(
			expect.objectContaining({
				sourcePath: "Notes/Demo.md",
				blockId: "abc123",
				deckId: "deck-1",
				schedulePin: pin,
			}),
		);
		expect(updatePointDueDateMock).toHaveBeenCalledWith(
			"chunk-vault-1",
			undefined,
			pin.nextRepDate,
		);
		expect(flushPendingWritesMock).toHaveBeenCalled();
		expect(recomputeMock).toHaveBeenCalledWith(
			expect.anything(),
			"manual_reschedule",
			expect.objectContaining({
				deckIds: ["deck-1"],
				priorityDateKeys: [pin.dateKey],
				leanSchedule: true,
			}),
		);
		expect(result).toMatchObject({
			createdIds: ["chunk-vault-1"],
			outcome: "created",
			pinDateKey: pin.dateKey,
		});
	});

	it("returns existing when vault chunk is unchanged", async () => {
		ensureVaultMock.mockResolvedValue({
			result: "unchanged",
			pointId: "chunk-vault-1",
		});
		const scheduleDate = new Date(2026, 6, 16);
		const pin = resolveReadingTargetSchedulePin(scheduleDate);
		const service = new IRReadingTargetAddService({} as never);

		const result = await service.addReadingTarget({
			title: "段落",
			deckId: "deck-1",
			scheduleDate,
			target: {
				kind: "vault-block",
				rawInput: "[[Notes/Demo.md#^abc123]]",
				resumeLink: "Notes/Demo.md#^abc123",
				sourceFilePath: "Notes/Demo.md",
				blockId: "abc123",
			},
		});

		expect(result.outcome).toBe("existing");
		expect(result.pinDateKey).toBe(pin.dateKey);
		expect(recomputeMock).toHaveBeenCalledWith(
			expect.anything(),
			"manual_reschedule",
			expect.objectContaining({ leanSchedule: true }),
		);
	});
});
