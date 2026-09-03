import { TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import type { ScheduleItem } from "../IRCalendarScheduleItem";
import {
	collectScheduleItemVaultSourcePathCandidates,
	evaluateScheduleItemSourceMissing,
	extractVaultPathCandidateFromResumeLink,
	isVaultSourcePathPresent,
	resolveScheduleItemVaultSourcePath,
	resolveVaultSourcePathIfPresent,
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

function makeApp(options?: {
	pathsPresent?: string[];
	linkpathMap?: Record<string, string>;
}) {
	const present = new Set(
		(options?.pathsPresent || []).map((p) => p.replace(/\\/g, "/")),
	);
	const linkpathMap = new Map(
		Object.entries(options?.linkpathMap || {}).map(([key, value]) => [
			key.replace(/\\/g, "/"),
			value.replace(/\\/g, "/"),
		]),
	);

	const fileFor = (path: string) => {
		const normalized = String(path || "").replace(/\\/g, "/");
		if (!present.has(normalized)) {
			return null;
		}
		return new TFile(normalized);
	};

	return {
		metadataCache: {
			getCache: () => null,
			getFirstLinkpathDest: (linkPath: string) => {
				const key = String(linkPath || "").replace(/\\/g, "/");
				const mapped = linkpathMap.get(key);
				if (mapped) {
					return fileFor(mapped);
				}
				return fileFor(key);
			},
		},
		vault: {
			getAbstractFileByPath: (path: string) => fileFor(path),
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

describe("extractVaultPathCandidateFromResumeLink / candidates", () => {
	it("extracts wikilink and epub protocol file paths", () => {
		expect(extractVaultPathCandidateFromResumeLink("[[Notes/A.md#^x]]")).toBe(
			"Notes/A.md",
		);
		expect(
			extractVaultPathCandidateFromResumeLink(
				"[EPUB](obsidian://weave-epub?vault=Vault&file=Books%2Fdemo.epub&cfi=epubcfi(/6/2))",
			),
		).toBe("Books/demo.epub");
		expect(extractVaultPathCandidateFromResumeLink("https://example.com")).toBe(
			"",
		);
	});

	it("collects sourceFile, basename, and resumeLink candidates", () => {
		expect(
			collectScheduleItemVaultSourcePathCandidates(
				makeMaterial({
					sourceFile: "Old/Note.md",
					resumeLink: "[[New/Note.md#^block]]",
				}),
			),
		).toEqual(["Old/Note.md", "Note.md", "New/Note.md"]);
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
		const app = makeApp({ pathsPresent: ["Notes/Present.md"] });
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

	it("soft-resolves moved files via linkpath basename", () => {
		const app = makeApp({
			pathsPresent: ["Archive/Present.md"],
			linkpathMap: { "Present.md": "Archive/Present.md" },
		});

		expect(resolveVaultSourcePathIfPresent(app, "Present.md")).toBe(
			"Archive/Present.md",
		);
		expect(
			evaluateScheduleItemSourceMissing(
				app,
				makeMaterial({ sourceFile: "Old/Present.md" }),
			),
		).toEqual({
			checkable: true,
			missing: false,
			path: "Old/Present.md",
		});
	});

	it("treats empty sourceFile as present when resumeLink resolves", () => {
		const app = makeApp({ pathsPresent: ["Notes/FromLink.md"] });
		expect(
			evaluateScheduleItemSourceMissing(
				app,
				makeMaterial({
					sourceFile: "",
					resumeLink: "[[Notes/FromLink.md#^b]]",
				}),
			),
		).toEqual({
			checkable: true,
			missing: false,
			path: "Notes/FromLink.md",
		});
	});

	it("soft-resolves stale sourceFile via resumeLink file path", () => {
		const app = makeApp({ pathsPresent: ["Books/current.epub"] });
		const material = makeMaterial({
			id: "epubbm-1",
			sourceType: "epub",
			sourceFile: "Books/stale.epub",
			resumeLink:
				"[EPUB](obsidian://weave-epub?vault=Vault&file=Books%2Fcurrent.epub)",
		});
		expect(collectScheduleItemVaultSourcePathCandidates(material)).toEqual([
			"Books/stale.epub",
			"stale.epub",
			"Books/current.epub",
			"current.epub",
		]);
		expect(evaluateScheduleItemSourceMissing(app, material)).toEqual({
			checkable: true,
			missing: false,
			path: "Books/stale.epub",
		});
	});

	it("reuses pathExistsCache for repeated paths", () => {
		const app = makeApp({ pathsPresent: ["Shared/A.md"] });
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
