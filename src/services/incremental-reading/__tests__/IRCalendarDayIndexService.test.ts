import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	IRCalendarDayIndexService,
	IR_CALENDAR_DAY_INDEX_VERSION,
} from "../IRCalendarDayIndexService";

vi.mock("../../../config/paths", () => ({
	getPluginPaths: vi.fn(() => ({
		cache: {
			incrementalReading: {
				irCalendarDayIndex:
					".obsidian/plugins/weave-incremental-reading/cache/ir-calendar-day-index.json",
			},
		},
	})),
}));

vi.mock("../../../utils/directory-utils", () => ({
	DirectoryUtils: {
		ensureDirForFile: vi.fn(async () => undefined),
	},
}));

describe("IRCalendarDayIndexService", () => {
	let files: Map<string, string>;
	let app: any;

	beforeEach(() => {
		files = new Map<string, string>();
		app = {
			vault: {
				adapter: {
					exists: vi.fn(async (path: string) => files.has(path)),
					read: vi.fn(async (path: string) => files.get(path) || ""),
					write: vi.fn(async (path: string, content: string) => {
						files.set(path, content);
					}),
				},
			},
		};
	});

	it("hydrates tier-0 slices for priority dates", async () => {
		const service = new IRCalendarDayIndexService(app);
		const cacheKey = "__all__::__default__";
		await service.syncFromMaterialsByDate({
			cacheKey,
			settingsFingerprint: "settings-a",
			scheduleFingerprint: "schedule-a",
			materialsByDate: new Map([
				[
					"2026-05-29",
					[
						{
							id: "chunk-1",
							title: "今日阅读点",
							sourceFile: "Notes/demo.md",
							priority: 5,
							intervalDays: 1,
							scheduleStatus: "scheduled",
							nextRepDate: 0,
							nextReviewDate: null,
						} as any,
					],
				],
				["2026-05-30", []],
			]),
			priorityDateKeys: ["2026-05-29"],
		});

		await service.flushPendingWrites();
		const tier0 = await service.tryHydrateTier0({
			cacheKey,
			settingsFingerprint: "settings-a",
			scheduleFingerprint: "schedule-a",
			priorityDateKeys: ["2026-05-29"],
		});

		expect(tier0?.materialsByDate.get("2026-05-29")).toHaveLength(1);
		expect(tier0?.materialsByDate.get("2026-05-29")?.[0]?.title).toBe(
			"今日阅读点",
		);
		expect(tier0?.daySummaries.get("2026-05-29")?.totalCount).toBe(1);
	});

	it("drops tier-0 hydration when settings fingerprint changes", async () => {
		const service = new IRCalendarDayIndexService(app);
		const cacheKey = "__all__::__default__";
		await service.syncFromMaterialsByDate({
			cacheKey,
			settingsFingerprint: "settings-a",
			scheduleFingerprint: "schedule-a",
			materialsByDate: new Map([
				[
					"2026-05-29",
					[
						{
							id: "chunk-1",
							title: "今日阅读点",
							sourceFile: "Notes/demo.md",
							priority: 5,
							intervalDays: 1,
							scheduleStatus: "scheduled",
							nextRepDate: 0,
							nextReviewDate: null,
						} as any,
					],
				],
			]),
			priorityDateKeys: ["2026-05-29"],
		});

		const tier0 = await service.tryHydrateTier0({
			cacheKey,
			settingsFingerprint: "settings-b",
			scheduleFingerprint: "schedule-a",
			priorityDateKeys: ["2026-05-29"],
		});

		expect(tier0).toBeNull();
	});

	it("drops tier-0 hydration when schedule fingerprint changes", async () => {
		const service = new IRCalendarDayIndexService(app);
		const cacheKey = "__all__::__default__";
		await service.syncFromMaterialsByDate({
			cacheKey,
			settingsFingerprint: "settings-a",
			scheduleFingerprint: "schedule-a",
			materialsByDate: new Map([
				[
					"2026-05-29",
					[
						{
							id: "chunk-1",
							title: "今日阅读点",
							sourceFile: "Notes/demo.md",
							priority: 5,
							intervalDays: 1,
							scheduleStatus: "scheduled",
							nextRepDate: 0,
							nextReviewDate: null,
						} as any,
					],
				],
			]),
			priorityDateKeys: ["2026-05-29"],
		});

		const tier0 = await service.tryHydrateTier0({
			cacheKey,
			settingsFingerprint: "settings-a",
			scheduleFingerprint: "schedule-b",
			priorityDateKeys: ["2026-05-29"],
		});

		expect(tier0).toBeNull();
	});

	it("invalidates only the requested date slices", async () => {
		const service = new IRCalendarDayIndexService(app);
		const cacheKey = "__all__::__default__";
		await service.syncFromMaterialsByDate({
			cacheKey,
			settingsFingerprint: "settings-a",
			scheduleFingerprint: "schedule-a",
			materialsByDate: new Map([
				[
					"2026-05-29",
					[
						{
							id: "chunk-1",
							title: "今日",
							sourceFile: "Notes/a.md",
							priority: 5,
							intervalDays: 1,
							scheduleStatus: "scheduled",
							nextRepDate: 0,
							nextReviewDate: null,
						} as any,
					],
				],
				[
					"2026-05-30",
					[
						{
							id: "chunk-2",
							title: "明日",
							sourceFile: "Notes/b.md",
							priority: 5,
							intervalDays: 1,
							scheduleStatus: "scheduled",
							nextRepDate: 0,
							nextReviewDate: null,
						} as any,
					],
				],
			]),
			priorityDateKeys: ["2026-05-29", "2026-05-30"],
		});

		await service.invalidateDateKeys(cacheKey, ["2026-05-29"]);
		await service.flushPendingWrites();

		const hydrated = await service.tryHydrateDateKeys({
			cacheKey,
			settingsFingerprint: "settings-a",
			scheduleFingerprint: "schedule-a",
			dateKeys: ["2026-05-29", "2026-05-30"],
		});
		expect(hydrated?.materialsByDate.get("2026-05-29")).toEqual([]);
		expect(hydrated?.materialsByDate.get("2026-05-30")).toHaveLength(1);

		const persisted = JSON.parse(
			files.get(
				".obsidian/plugins/weave-incremental-reading/cache/ir-calendar-day-index.json",
			) || "{}",
		);
		expect(persisted.version).toBe(IR_CALENDAR_DAY_INDEX_VERSION);
	});

	it("merges day summaries without dropping untouched date slices", async () => {
		const service = new IRCalendarDayIndexService(app);
		const cacheKey = "__all__::__default__";
		await service.syncFromMaterialsByDate({
			cacheKey,
			settingsFingerprint: "settings-a",
			scheduleFingerprint: "schedule-a",
			materialsByDate: new Map([
				[
					"2026-05-29",
					[
						{
							id: "chunk-1",
							title: "今日",
							sourceFile: "Notes/a.md",
							priority: 5,
							intervalDays: 1,
							scheduleStatus: "scheduled",
							nextRepDate: 0,
							nextReviewDate: null,
						} as any,
					],
				],
				[
					"2026-05-30",
					[
						{
							id: "chunk-2",
							title: "明日",
							sourceFile: "Notes/b.md",
							priority: 5,
							intervalDays: 1,
							scheduleStatus: "scheduled",
							nextRepDate: 0,
							nextReviewDate: null,
						} as any,
					],
				],
			]),
			priorityDateKeys: ["2026-05-29", "2026-05-30"],
		});

		await service.syncFromMaterialsByDate({
			cacheKey,
			settingsFingerprint: "settings-a",
			scheduleFingerprint: "schedule-b",
			materialsByDate: new Map([
				[
					"2026-05-30",
					[
						{
							id: "chunk-2b",
							title: "明日更新",
							sourceFile: "Notes/b.md",
							priority: 5,
							intervalDays: 1,
							scheduleStatus: "scheduled",
							nextRepDate: 0,
							nextReviewDate: null,
						} as any,
					],
				],
			]),
			priorityDateKeys: ["2026-05-30"],
		});

		const hydrated = await service.tryHydrateDateKeys({
			cacheKey,
			settingsFingerprint: "settings-a",
			scheduleFingerprint: "schedule-b",
			dateKeys: ["2026-05-29", "2026-05-30"],
		});
		expect(hydrated?.materialsByDate.get("2026-05-29")).toHaveLength(1);
		expect(hydrated?.materialsByDate.get("2026-05-29")?.[0]?.id).toBe(
			"chunk-1",
		);
		expect(hydrated?.materialsByDate.get("2026-05-30")?.[0]?.id).toBe(
			"chunk-2b",
		);

		await service.flushPendingWrites();
		const monthHeatmap = await service.tryHydrateMonthHeatmap({
			cacheKey,
			settingsFingerprint: "settings-a",
			monthKeys: ["2026-05"],
		});
		expect(monthHeatmap?.get("2026-05")?.["2026-05-29"]).toBe(1);
		expect(monthHeatmap?.get("2026-05")?.["2026-05-30"]).toBe(1);
	});

	it("drops shell hydration when schedule fingerprint changes", async () => {
		const service = new IRCalendarDayIndexService(app);
		const cacheKey = "__all__::__default__";
		await service.syncFromMaterialsByDate({
			cacheKey,
			settingsFingerprint: "settings-a",
			scheduleFingerprint: "schedule-a",
			materialsByDate: new Map([
				[
					"2026-05-29",
					[
						{
							id: "chunk-1",
							title: "今日阅读点",
							sourceFile: "Notes/demo.md",
							priority: 5,
							intervalDays: 1,
							scheduleStatus: "scheduled",
							nextRepDate: 0,
							nextReviewDate: null,
						} as any,
					],
				],
			]),
			priorityDateKeys: ["2026-05-29"],
		});

		const hydrated = await service.tryHydrateDateKeys({
			cacheKey,
			settingsFingerprint: "settings-a",
			scheduleFingerprint: "schedule-b",
			dateKeys: ["2026-05-29"],
		});

		expect(hydrated).toBeNull();
	});

	it("hydrates tier-0 even when priority dates are empty", async () => {
		const service = new IRCalendarDayIndexService(app);
		const cacheKey = "__all__::__default__";
		await service.syncFromMaterialsByDate({
			cacheKey,
			settingsFingerprint: "settings-a",
			scheduleFingerprint: "schedule-a",
			materialsByDate: new Map([
				[
					"2026-05-30",
					[
						{
							id: "chunk-2",
							title: "明日",
							sourceFile: "Notes/b.md",
							priority: 5,
							intervalDays: 1,
							scheduleStatus: "scheduled",
							nextRepDate: 0,
							nextReviewDate: null,
						} as any,
					],
				],
			]),
			priorityDateKeys: ["2026-05-30"],
		});

		await service.flushPendingWrites();
		const tier0 = await service.tryHydrateTier0({
			cacheKey,
			settingsFingerprint: "settings-a",
			scheduleFingerprint: "schedule-a",
			priorityDateKeys: ["2026-05-29", "2026-05-30"],
		});

		expect(tier0?.materialsByDate.get("2026-05-29")).toEqual([]);
		expect(tier0?.materialsByDate.get("2026-05-30")).toHaveLength(1);
	});
});
