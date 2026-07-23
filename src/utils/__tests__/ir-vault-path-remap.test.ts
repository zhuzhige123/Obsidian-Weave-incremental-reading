import { describe, expect, it } from "vitest";
import type { IRPoint } from "../../types/ir-point-storage-types";
import {
	remapEmbeddedVaultPathInText,
	remapPointSourcePaths,
	remapVaultPath,
} from "../ir-vault-path-remap";

function makePoint(overrides: Partial<IRPoint> = {}): IRPoint {
	return {
		id: "point-1",
		topicIds: ["topic-a"],
		pointType: "chunk-entry",
		title: "Demo",
		source: {
			id: "src-1",
			type: "markdown",
			path: "Notes/Demo.md",
			title: "Demo",
		},
		trace: {
			locatorType: "markdown-chunk",
			locator: {
				chunkFilePath: "Notes/Demo.md",
				resumeLink: "[[Notes/Demo.md#^abc]]",
			},
			traceState: "verified",
			traceConfidence: 1,
			fallbackLocators: [],
		},
		parameterContext: {
			materialClass: "default",
			scheduleProfileRef: "default",
			classificationSource: "manual",
			isOverride: false,
		},
		schedule: {
			status: "new",
			priorityUi: 5,
			priorityEff: 5,
			intervalDays: 1,
			nextRepDate: 0,
		},
		stats: {},
		meta: {},
		tags: [],
		timestamps: {
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-01T00:00:00.000Z",
		},
		relations: {
			linkedNotePaths: ["Notes/Related.md"],
		},
		metadata: {
			resumeLink: "[[Notes/Demo#^abc]]",
			chunkFilePath: "Notes/Demo.md",
		},
		...overrides,
	} as IRPoint;
}

describe("remapVaultPath", () => {
	it("remaps exact file paths", () => {
		expect(remapVaultPath("Notes/A.md", "Notes/A.md", "Notes/B.md")).toBe(
			"Notes/B.md",
		);
		expect(remapVaultPath("Notes/A.md", "Notes/Other.md", "Notes/B.md")).toBe(
			null,
		);
		expect(remapVaultPath("Notes/A.md", "Notes/A.md", "Notes/A.md")).toBe(null);
	});

	it("remaps folder prefixes without matching sibling prefixes", () => {
		expect(
			remapVaultPath("Books/Old/Chapter.pdf", "Books/Old", "Books/New"),
		).toBe("Books/New/Chapter.pdf");
		expect(remapVaultPath("Books/Older/X.pdf", "Books/Old", "Books/New")).toBe(
			null,
		);
	});
});

describe("remapEmbeddedVaultPathInText", () => {
	it("rewrites wiki links with and without extension", () => {
		expect(
			remapEmbeddedVaultPathInText(
				"[[Notes/Demo.md#^abc|段落]]",
				"Notes/Demo.md",
				"Archive/Demo.md",
			),
		).toBe("[[Archive/Demo.md#^abc|段落]]");

		expect(
			remapEmbeddedVaultPathInText(
				"[[Notes/Demo#^abc]]",
				"Notes/Demo.md",
				"Archive/Demo.md",
			),
		).toBe("[[Archive/Demo#^abc]]");
	});

	it("does not rewrite longer path prefixes", () => {
		expect(
			remapEmbeddedVaultPathInText(
				"open Notes/Demo.mdx later",
				"Notes/Demo.md",
				"Archive/Demo.md",
			),
		).toBe("open Notes/Demo.mdx later");
	});

	it("rewrites URL-encoded path fragments", () => {
		const oldPath = "Notes/My File.md";
		const newPath = "Notes/Renamed.md";
		const encoded = encodeURIComponent(oldPath);
		expect(
			remapEmbeddedVaultPathInText(
				`obsidian://open?file=${encoded}`,
				oldPath,
				newPath,
			),
		).toContain(encodeURIComponent(newPath));
	});
});

describe("remapPointSourcePaths", () => {
	it("rewrites source, locator, metadata, and linked notes", () => {
		const result = remapPointSourcePaths(
			makePoint(),
			"Notes/Demo.md",
			"Archive/Demo.md",
		);
		expect(result.changed).toBe(true);
		expect(result.point.source.path).toBe("Archive/Demo.md");
		expect(result.point.trace.locator.chunkFilePath).toBe("Archive/Demo.md");
		expect(result.point.trace.locator.resumeLink).toBe(
			"[[Archive/Demo.md#^abc]]",
		);
		expect(result.point.metadata?.resumeLink).toBe("[[Archive/Demo#^abc]]");
		expect(result.point.metadata?.chunkFilePath).toBe("Archive/Demo.md");
	});

	it("returns unchanged when path does not match", () => {
		const point = makePoint();
		const result = remapPointSourcePaths(point, "Other/File.md", "X.md");
		expect(result.changed).toBe(false);
		expect(result.point).toBe(point);
	});

	it("remaps linked notes under a renamed folder", () => {
		const result = remapPointSourcePaths(
			makePoint({
				relations: { linkedNotePaths: ["Notes/Related.md"] },
			}),
			"Notes",
			"Archive",
		);
		expect(result.changed).toBe(true);
		expect(result.point.relations?.linkedNotePaths).toEqual([
			"Archive/Related.md",
		]);
		expect(result.point.source.path).toBe("Archive/Demo.md");
	});
});
