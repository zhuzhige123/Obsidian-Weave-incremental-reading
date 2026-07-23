import { TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import type { ScheduleItem } from "../IRCalendarScheduleItem";
import {
	evaluateScheduleItemSourceMissing,
	isVaultSourcePathPresent,
	resolveScheduleItemVaultSourcePath,
	shouldCheckScheduleItemSourceExistence,
} from "../ir-calendar-source-existence";

function makeMaterial(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
	return {
		id: "point-1",
		title: "Test",
		sourceFile: "Notes/Test.md",
		priority: 5,
		intervalDays: 1,
		scheduleStatus: "new",
		nextRepDate: 0,
		nextReviewDate: null,
		...overrides,
	};
}

function makeApp(pathsPresent: string[] = []) {
	const present = new Set(pathsPresent.map((p) => p.replace(/\\/g, "/")));
	return {
		metadataCache: {
			getCache: () => null,
		},
		vault: {
			getAbstractFileByPath: (path: string) => {
				const normalized = String(path || "").replace(/\\/g, "/");
				if (!present.has(normalized)) {
					return null;
				}
				return new TFile(normalized);
			},
		},
	} as any;
}

describe("shouldCheckScheduleItemSourceExistence", () => {
	it("skips web / link reading points", () => {
		const app = {
			metadataCache: {
				getCache: () => ({
					frontmatter: { "weave-ir-web-url": "https://example.com/a" },
				}),
			},
			vault: { getAbstractFileByPath: () => null },
		} as any;

		expect(
			shouldCheckScheduleItemSourceExistence(
				app,
				makeMaterial({ sourceFile: "IR/Web.md" }),
			),
		).toBe(false);

		expect(
			shouldCheckScheduleItemSourceExistence(
				app,
				makeMaterial({
					sourceFile: "",
					resumeLink: "https://example.com/b",
				}),
			),
		).toBe(false);
	});

	it("checks vault-backed md / pdf / epub / canvas", () => {
		const app = makeApp();
		expect(
			shouldCheckScheduleItemSourceExistence(
				app,
				makeMaterial({ sourceFile: "Notes/A.md" }),
			),
		).toBe(true);
		expect(
			shouldCheckScheduleItemSourceExistence(
				app,
				makeMaterial({
					id: "pdf-task:1",
					sourceType: "pdf",
					sourceFile: "Books/A.pdf",
				}),
			),
		).toBe(true);
		expect(
			shouldCheckScheduleItemSourceExistence(
				app,
				makeMaterial({
					id: "epubbm-1",
					sourceType: "epub",
					sourceFile: "Books/A.epub",
				}),
			),
		).toBe(true);
		expect(
			shouldCheckScheduleItemSourceExistence(
				app,
				makeMaterial({ sourceFile: "Maps/A.canvas" }),
			),
		).toBe(true);
	});
});

describe("resolveScheduleItemVaultSourcePath", () => {
	it("normalizes and trims sourceFile", () => {
		expect(resolveScheduleItemVaultSourcePath(makeMaterial({ sourceFile: "" }))).toBe(
			"",
		);
		expect(
			resolveScheduleItemVaultSourcePath(
				makeMaterial({ sourceFile: "  Notes/A.md  " }),
			),
		).toBe("Notes/A.md");
	});
});

describe("isVaultSourcePathPresent / evaluateScheduleItemSourceMissing", () => {
	it("treats empty path as missing for checkable items", () => {
		const app = makeApp();
		const result = evaluateScheduleItemSourceMissing(
			app,
			makeMaterial({ sourceFile: "" }),
		);
		expect(result).toEqual({ checkable: true, missing: true, path: "" });
	});

	it("reports present and missing paths", () => {
		const app = makeApp(["Notes/Present.md"]);
		expect(isVaultSourcePathPresent(app, "Notes/Present.md")).toBe(true);
		expect(isVaultSourcePathPresent(app, "Notes/Gone.md")).toBe(false);

		expect(
			evaluateScheduleItemSourceMissing(
				app,
				makeMaterial({ sourceFile: "Notes/Present.md" }),
			),
		).toEqual({
			checkable: true,
			missing: false,
			path: "Notes/Present.md",
		});
		expect(
			evaluateScheduleItemSourceMissing(
				app,
				makeMaterial({ sourceFile: "Notes/Gone.md" }),
			),
		).toEqual({
			checkable: true,
			missing: true,
			path: "Notes/Gone.md",
		});
	});

	it("reuses pathExistsCache for repeated paths", () => {
		const app = makeApp(["Shared/A.md"]);
		const cache = new Map<string, boolean>();
		const spy = vi.spyOn(app.vault, "getAbstractFileByPath");

		evaluateScheduleItemSourceMissing(
			app,
			makeMaterial({ id: "p1", sourceFile: "Shared/A.md" }),
			cache,
		);
		evaluateScheduleItemSourceMissing(
			app,
			makeMaterial({ id: "p2", sourceFile: "Shared/A.md" }),
			cache,
		);

		expect(spy).toHaveBeenCalledTimes(1);
		expect(cache.get("Shared/A.md")).toBe(true);
	});

	it("does not mark web targets as missing", () => {
		const app = {
			metadataCache: {
				getCache: () => ({
					frontmatter: { "weave-ir-web-url": "https://example.com/a" },
				}),
			},
			vault: { getAbstractFileByPath: () => null },
		} as any;

		expect(
			evaluateScheduleItemSourceMissing(
				app,
				makeMaterial({ sourceFile: "IR/Web.md" }),
			),
		).toEqual({ checkable: false, missing: false, path: "" });
	});
});
