import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IRBlockV4 } from "../../../types/ir-types";
import {
	buildScheduleModePreviewInput,
	computeScheduleMenuActionBlock,
	persistScheduleMenuActionL0,
} from "../IRScheduleModeMutationService";

const persistBlockScheduleStateMock = vi.fn();

vi.mock("../IRPointScheduleMutator", () => ({
	persistBlockScheduleState: (...args: unknown[]) => persistBlockScheduleStateMock(...args),
}));

vi.mock("../../utils/ir-plugin-host-access", () => ({
	readAdvancedScheduleSettingsSnapshot: () => ({
		enableTagGroupPrior: false,
		defaultIntervalFactor: 1.5,
		maxIntervalDays: 365,
	}),
}));

function createBlock(overrides: Partial<IRBlockV4> = {}): IRBlockV4 {
	return {
		id: "chunk-1",
		sourcePath: "notes/test.md",
		blockId: "chunk-1",
		contentHash: "",
		status: "queued",
		priorityUi: 5,
		priorityEff: 5,
		intervalDays: 3,
		nextRepDate: Date.parse("2026-06-19"),
		stats: {},
		meta: { tagGroup: "default" },
		updatedAt: Date.now(),
		...overrides,
	};
}

describe("IRScheduleModeMutationService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		persistBlockScheduleStateMock.mockResolvedValue({ pointId: "chunk-1" });
	});

	it("uses shared preview formula for menu actions", () => {
		const beforeBlock = createBlock();
		const input = buildScheduleModePreviewInput({} as any, beforeBlock, 1);
		const afterBlock = computeScheduleMenuActionBlock(beforeBlock, "normal", input);
		expect(afterBlock.nextRepDate).toBeGreaterThan(beforeBlock.nextRepDate);
		expect(afterBlock.status).toBe("queued");
	});

	it("persists via L0 mutator with skipInvalidate", async () => {
		const beforeBlock = createBlock();
		const afterBlock = createBlock({ nextRepDate: beforeBlock.nextRepDate + 86_400_000 });
		const app = {} as import("obsidian").App;

		await persistScheduleMenuActionL0(app, beforeBlock, afterBlock);

		expect(persistBlockScheduleStateMock).toHaveBeenCalledWith(app, beforeBlock, afterBlock, {
			skipInvalidate: true,
		});
	});
});
