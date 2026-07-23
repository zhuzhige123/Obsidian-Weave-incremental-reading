import { beforeEach, describe, expect, test, vi } from "vitest";
import type { IRLoadDeferralRecord } from "../IRDailyLoadAllocator";

const { mockUpdateChunkSchedule, mockPdfUpdateTask } = vi.hoisted(() => ({
	mockUpdateChunkSchedule: vi.fn().mockResolvedValue(undefined),
	mockPdfUpdateTask: vi.fn().mockResolvedValue({ id: "pdfbm-test" }),
}));

vi.mock("../IRStorageService", () => ({
	IRStorageService: class {
		initialize = vi.fn().mockResolvedValue(undefined);
	},
}));

vi.mock("../IRChunkScheduleAdapter", () => ({
	IRChunkScheduleAdapter: class {
		updateChunkSchedule = mockUpdateChunkSchedule;
	},
}));

vi.mock("../IRPdfBookmarkTaskService", () => ({
	IRPdfBookmarkTaskService: class {
		initialize = vi.fn().mockResolvedValue(undefined);
		updateTask = mockPdfUpdateTask;
	},
	isPdfBookmarkTaskId: (id: string) => id.startsWith("pdfbm-"),
}));

vi.mock("../IREpubBookmarkTaskService", () => ({
	IREpubBookmarkTaskService: class {
		initialize = vi.fn().mockResolvedValue(undefined);
		updateTask = vi.fn().mockResolvedValue({ id: "epubbm-test" });
	},
	isEpubBookmarkTaskId: (id: string) => id.startsWith("epubbm-"),
}));

vi.mock("../IRWorkspaceSnapshotService", () => ({
	getSharedIRWorkspaceSnapshotService: () => ({
		getWorkspaceData: vi.fn().mockResolvedValue({
			chunksRecord: {
				"chunk-1": { nextRepDate: Date.parse("2026-06-18T00:00:00") },
			},
			blocksRecord: {},
			pdfTasks: [
				{
					id: "pdfbm-test",
					nextRepDate: Date.parse("2026-06-18T00:00:00"),
					meta: { manualSchedulePinnedDateKey: "2026-06-18" },
				},
			],
			epubTasks: [],
		}),
		invalidate: vi.fn(),
	}),
}));

vi.mock("../IRScheduleIndexService", () => ({
	getSharedIRScheduleIndexService: () => ({
		invalidate: vi.fn(),
	}),
}));

vi.mock("../IRMonitoringService", () => ({
	IRMonitoringService: class {
		load = vi.fn().mockResolvedValue(undefined);
		recordDecisionEvent = vi.fn();
		save = vi.fn().mockResolvedValue(undefined);
	},
}));

function createDeferral(itemId: string): IRLoadDeferralRecord {
	const from = Date.parse("2026-06-18T08:00:00");
	const to = Date.parse("2026-06-20T08:00:00");
	return {
		itemId,
		fromDateKey: "2026-06-18",
		toDateKey: "2026-06-20",
		fromNextRepDate: from,
		toNextRepDate: to,
		action: "load_defer",
		sourceType: itemId.startsWith("pdfbm-") ? "pdf" : "chunk",
	};
}

describe("IRLoadDeferService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("load_defer 触发原因会跳过持久化，避免循环写入", async () => {
		const { applyLoadDeferralsFromPlan } = await import(
			"../IRLoadDeferService"
		);
		const app = { vault: {} } as any;
		const applied = await applyLoadDeferralsFromPlan(
			app,
			[createDeferral("chunk-1")],
			{
				reason: "load_defer",
				persistDeferrals: true,
			},
		);
		expect(applied).toBe(0);
		expect(mockUpdateChunkSchedule).not.toHaveBeenCalled();
	});

	test("默认不持久化顺延，保护完成时写入的 nextRepDate", async () => {
		const { applyLoadDeferralsFromPlan } = await import(
			"../IRLoadDeferService"
		);
		const app = { vault: {} } as any;
		const applied = await applyLoadDeferralsFromPlan(
			app,
			[createDeferral("chunk-1")],
			{
				reason: "ui_refresh",
			},
		);
		expect(applied).toBe(0);
		expect(mockUpdateChunkSchedule).not.toHaveBeenCalled();
	});

	test("显式 persistDeferrals 才会持久化 chunk 顺延并清除手动 pin", async () => {
		const { applyLoadDeferralsFromPlan } = await import(
			"../IRLoadDeferService"
		);
		const app = { vault: {} } as any;
		const applied = await applyLoadDeferralsFromPlan(
			app,
			[createDeferral("chunk-1")],
			{
				reason: "ui_refresh",
				persistDeferrals: true,
			},
		);
		expect(applied).toBe(1);
		expect(mockUpdateChunkSchedule).toHaveBeenCalledWith("chunk-1", {
			nextRepDate: Date.parse("2026-06-20T08:00:00"),
			scheduleStatus: "queued",
			manualSchedulePinnedDateKey: null,
		});
	});
});
