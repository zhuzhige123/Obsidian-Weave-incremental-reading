import { describe, expect, it } from "vitest";
import {
	resolveActiveDayReadingListEmptyKind,
	shouldKickSelectedDateHydrate,
	shouldShowSelectedDateMaterialsPending,
} from "../ir-calendar-selected-date-hydrate";

describe("shouldKickSelectedDateHydrate", () => {
	it("kicks only for unsatisfied active dates", () => {
		expect(
			shouldKickSelectedDateHydrate({
				isPastDate: false,
				loadSatisfied: false,
			}),
		).toBe(true);
		expect(
			shouldKickSelectedDateHydrate({
				isPastDate: false,
				loadSatisfied: true,
			}),
		).toBe(false);
		expect(
			shouldKickSelectedDateHydrate({
				isPastDate: true,
				loadSatisfied: false,
			}),
		).toBe(false);
	});
});

describe("shouldShowSelectedDateMaterialsPending", () => {
	const base = {
		isPastDate: false,
		hasActiveSearch: false,
		materialsEmpty: true,
		loadSatisfied: false,
		reconcilePending: false,
		isColdStartBlocking: false,
		expectedMaterialSignal: 3,
	};

	it("shows blocking pending when list empty and heatmap expects materials", () => {
		expect(shouldShowSelectedDateMaterialsPending(base)).toBe(true);
	});

	it("does not block when a partial day queue is already visible", () => {
		expect(
			shouldShowSelectedDateMaterialsPending({
				...base,
				materialsEmpty: false,
			}),
		).toBe(false);
	});

	it("does not show pending when load is already satisfied", () => {
		expect(
			shouldShowSelectedDateMaterialsPending({
				...base,
				loadSatisfied: true,
			}),
		).toBe(false);
	});

	it("shows pending during cold start even without heatmap signal", () => {
		expect(
			shouldShowSelectedDateMaterialsPending({
				...base,
				expectedMaterialSignal: 0,
				isColdStartBlocking: true,
			}),
		).toBe(true);
	});
});

describe("resolveActiveDayReadingListEmptyKind", () => {
	const base = {
		isPastDate: false,
		hasActiveSearch: false,
		isLoading: false,
		displayedCount: 0,
		unfilteredCount: 0,
		activeTagFilter: "",
		hideTodayCompleted: false,
		isToday: true,
	};

	it("returns day_empty for loaded active days with no materials", () => {
		expect(resolveActiveDayReadingListEmptyKind(base)).toBe("day_empty");
	});

	it("returns completed_hidden when today items exist but are filtered out", () => {
		expect(
			resolveActiveDayReadingListEmptyKind({
				...base,
				unfilteredCount: 4,
				hideTodayCompleted: true,
				isToday: true,
			}),
		).toBe("completed_hidden");
	});

	it("defers to tag-filter empty handling when tag filter excludes all", () => {
		expect(
			resolveActiveDayReadingListEmptyKind({
				...base,
				unfilteredCount: 2,
				activeTagFilter: "focus",
			}),
		).toBe("none");
	});

	it("returns none while loading or when rows are visible", () => {
		expect(
			resolveActiveDayReadingListEmptyKind({
				...base,
				isLoading: true,
			}),
		).toBe("none");
		expect(
			resolveActiveDayReadingListEmptyKind({
				...base,
				displayedCount: 1,
			}),
		).toBe("none");
	});
});
