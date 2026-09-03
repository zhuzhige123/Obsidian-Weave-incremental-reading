import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IRBlockV4 } from "../../../types/ir-types";
import {
	buildScheduleModePreviewInput,
	computeScheduleMenuActionBlock,
	persistScheduleMenuActionL0,
} from "../IRScheduleModeMutationService";

const persistBlockScheduleStateMock = vi.fn();

vi.mock("../IRPointScheduleMutator", () => ({
	persistBlockScheduleState: (...args: unknown[]) =>
		persistBlockScheduleStateMock(...args),
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
		const afterBlock = computeScheduleMenuActionBlock(
			beforeBlock,
			"normal",
			input,
		);
		expect(afterBlock.nextRepDate).toBeGreaterThan(beforeBlock.nextRepDate);
		expect(afterBlock.status).toBe("queued");
	});

	it("postpone uses calendar context and keeps intervalDays", () => {
		const beforeBlock = createBlock({
			intervalDays: 8,
			nextRepDate: Date.parse("2099-01-01"),
		});
		const today = new Date();
		const y = today.getFullYear();
		const m = String(today.getMonth() + 1).padStart(2, "0");
		const d = String(today.getDate()).padStart(2, "0");
		const input = buildScheduleModePreviewInput(
			{} as any,
			beforeBlock,
			1,
			`${y}-${m}-${d}`,
		);
		const afterBlock = computeScheduleMenuActionBlock(
			beforeBlock,
			"postpone",
			input,
		);
		expect(afterBlock.intervalDays).toBe(8);
		expect(afterBlock.meta?.manualPostponeCount).toBe(1);
		const expected = new Date(y, today.getMonth(), today.getDate() + 2);
		expected.setHours(0, 0, 0, 0);
		expect(afterBlock.nextRepDate).toBe(expected.getTime());
	});

	it("rejects postpone when limit is reached", () => {
		const beforeBlock = createBlock({
			intervalDays: 8,
			meta: { tagGroup: "default", manualPostponeCount: 2 },
		});
		const input = buildScheduleModePreviewInput({} as any, beforeBlock, 1);
		expect(() =>
			computeScheduleMenuActionBlock(beforeBlock, "postpone", input),
		).toThrow("postpone_limit_reached");
	});

	it("clears postpone count on arrange actions", () => {
		const beforeBlock = createBlock({
			intervalDays: 8,
			meta: { tagGroup: "default", manualPostponeCount: 2 },
		});
		const input = buildScheduleModePreviewInput({} as any, beforeBlock, 1);
		const afterBlock = computeScheduleMenuActionBlock(
			beforeBlock,
			"normal",
			input,
		);
		expect(afterBlock.meta?.manualPostponeCount).toBeUndefined();
	});

	it("persists via L0 mutator with skipInvalidate", async () => {
		const beforeBlock = createBlock();
		const afterBlock = createBlock({
			nextRepDate: beforeBlock.nextRepDate + 86_400_000,
		});
		const app = {} as import("obsidian").App;

		await persistScheduleMenuActionL0(app, beforeBlock, afterBlock);

		expect(persistBlockScheduleStateMock).toHaveBeenCalledWith(
			app,
			beforeBlock,
			afterBlock,
			{
				skipInvalidate: true,
			},
		);
	});
});
