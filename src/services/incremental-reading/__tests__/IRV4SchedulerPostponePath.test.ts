import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IRBlockV4 } from "../../../types/ir-types";
import {
	DEFAULT_IR_BLOCK_META,
	DEFAULT_IR_BLOCK_STATS,
} from "../../../types/ir-types";

const persistBlockScheduleStateMock = vi.fn();
const recordScheduleMenuActionInteractionMock = vi.fn();

vi.mock("../IRPointScheduleMutator", () => ({
	persistBlockScheduleState: (...args: unknown[]) =>
		persistBlockScheduleStateMock(...args),
}));

vi.mock("../IRScheduleModeMutationService", () => ({
	recordScheduleMenuActionInteraction: (...args: unknown[]) =>
		recordScheduleMenuActionInteractionMock(...args),
}));

vi.mock("../IRScheduleModePreviewService", async () => {
	const actual = await vi.importActual<
		typeof import("../IRScheduleModePreviewService")
	>("../IRScheduleModePreviewService");
	return actual;
});

import { IRV4SchedulerService } from "../IRV4SchedulerService";

function makeBlock(overrides?: Partial<IRBlockV4>): IRBlockV4 {
	return {
		id: "chunk-postpone-1",
		sourcePath: "note.md",
		blockId: "chunk-postpone-1",
		contentHash: "",
		status: "queued",
		priorityUi: 5,
		priorityEff: 5,
		intervalDays: 4,
		nextRepDate: Date.UTC(2026, 8, 10),
		stats: { ...DEFAULT_IR_BLOCK_STATS },
		meta: { ...DEFAULT_IR_BLOCK_META, tagGroup: "default" },
		updatedAt: Date.now(),
		...overrides,
	};
}

describe("IRV4SchedulerService postpone / schedule-mode path", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		persistBlockScheduleStateMock.mockResolvedValue({
			pointId: "chunk-postpone-1",
		});
		recordScheduleMenuActionInteractionMock.mockResolvedValue(undefined);
	});

	it("persists full postpone block including manualPostponeCount", async () => {
		const service = Object.create(IRV4SchedulerService.prototype) as IRV4SchedulerService;
		(service as any).app = {};
		(service as any).initialize = vi.fn().mockResolvedValue(undefined);
		(service as any).previewFuturePlanForBlockMutation = vi
			.fn()
			.mockResolvedValue(undefined);

		const before = makeBlock();
		const result = await service.postponeBlockWithPreviewV4(before, 2, "");

		expect(result.block.meta?.manualPostponeCount).toBe(1);
		expect(result.block.intervalDays).toBe(4);
		expect(persistBlockScheduleStateMock).toHaveBeenCalledWith(
			{},
			before,
			result.block,
		);
		expect(recordScheduleMenuActionInteractionMock).toHaveBeenCalledWith(
			{},
			"chunk-postpone-1",
		);
	});

	it("rejects postpone when limit already reached", async () => {
		const service = Object.create(IRV4SchedulerService.prototype) as IRV4SchedulerService;
		(service as any).app = {};
		(service as any).initialize = vi.fn().mockResolvedValue(undefined);

		const before = makeBlock({
			meta: {
				...DEFAULT_IR_BLOCK_META,
				tagGroup: "default",
				manualPostponeCount: 2,
			},
		});

		await expect(
			service.postponeBlockWithPreviewV4(before, 2, ""),
		).rejects.toThrow("postpone_limit_reached");
		expect(persistBlockScheduleStateMock).not.toHaveBeenCalled();
	});
});
