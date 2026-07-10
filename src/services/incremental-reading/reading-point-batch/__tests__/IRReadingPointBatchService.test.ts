import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScheduleItem } from "../../IRCalendarScheduleItem";
import {
	IRReadingPointBatchService,
	dedupeMaterials,
} from "../IRReadingPointBatchService";

vi.mock("../../../../utils/obsidian-confirm", () => ({
	showObsidianConfirm: vi.fn(async () => false),
}));

vi.mock("../../IRPointWriteService", () => ({
	IRPointWriteService: class {
		deletePoint = vi.fn();
	},
}));

vi.mock("../../IRV4SchedulerService", () => ({
	IRV4SchedulerService: class {
		initialize = vi.fn(async () => undefined);
		deleteBlockV4 = vi.fn(async () => undefined);
	},
}));

vi.mock("../../IRStorageService", () => ({
	IRStorageService: class {
		initialize = vi.fn(async () => undefined);
		invalidateScheduleRuntimeCaches = vi.fn();
	},
}));

vi.mock("../../reading-point-edit/IRReadingPointTopicMigrationService", () => ({
	IRReadingPointTopicMigrationService: class {
		movePointToTopic = vi.fn(async () => ({ changed: false }));
	},
}));

function makeMaterial(id: string): ScheduleItem {
	return {
		id,
		title: id,
		sourceFile: "note.md",
		priority: 5,
		intervalDays: 1,
		scheduleStatus: "new",
		nextRepDate: 0,
		nextReviewDate: null,
	};
}

describe("dedupeMaterials", () => {
	it("removes duplicate ids while preserving first occurrence", () => {
		const first = makeMaterial("a");
		const duplicate = { ...makeMaterial("a"), title: "duplicate" };

		expect(dedupeMaterials([first, duplicate, makeMaterial("b")])).toEqual([
			first,
			makeMaterial("b"),
		]);
	});
});

describe("IRReadingPointBatchService", () => {
	const app = {} as any;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("does not invoke onBatchRemoved when delete confirmation is cancelled", async () => {
		const onBatchRemoved = vi.fn(async () => undefined);
		const service = new IRReadingPointBatchService(app, {
			resolveBlockV4: vi.fn(),
			onBatchRemoved,
		});

		const result = await service.batchDelete([makeMaterial("point-1")]);

		expect(result).toEqual({ total: 1, success: 0, failed: 0, skipped: 0 });
		expect(onBatchRemoved).not.toHaveBeenCalled();
	});

	it("counts unchanged topic moves as skipped rather than success", async () => {
		const service = new IRReadingPointBatchService(app, {
			resolveBlockV4: vi.fn(),
		});

		const result = await service.batchMoveTopic(
			[makeMaterial("point-1")],
			"deck-a",
		);

		expect(result).toEqual({ total: 1, success: 0, failed: 0, skipped: 1 });
	});
});
