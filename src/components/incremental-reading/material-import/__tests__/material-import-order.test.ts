import { describe, expect, it } from "vitest";
import {
	compareMaterialImportPaths,
	sortMaterialImportSelectedPaths,
} from "../material-import-file-tree";
import { createMarkdownImportSequenceGroup } from "../material-import-sequence";

describe("sortMaterialImportSelectedPaths", () => {
	it("sorts folder selection by title including numeric chapter order", () => {
		const unsorted = [
			"Book/10-结尾.md",
			"Book/2-中章.md",
			"Book/1-开篇.md",
		];
		expect(sortMaterialImportSelectedPaths(unsorted)).toEqual([
			"Book/1-开篇.md",
			"Book/2-中章.md",
			"Book/10-结尾.md",
		]);
	});

	it("does not mutate the input array", () => {
		const input = ["b.md", "a.md"];
		const sorted = sortMaterialImportSelectedPaths(input);
		expect(input).toEqual(["b.md", "a.md"]);
		expect(sorted).toEqual(["a.md", "b.md"]);
	});
});

describe("compareMaterialImportPaths", () => {
	it("places chapter 2 before chapter 10", () => {
		expect(compareMaterialImportPaths("2.md", "10.md")).toBeLessThan(0);
	});
});

describe("createMarkdownImportSequenceGroup", () => {
	it("keeps single-file group keyed by path", () => {
		expect(createMarkdownImportSequenceGroup(["Notes/Chapter.md"], 123)).toBe(
			"md:Notes/Chapter.md",
		);
	});

	it("shares one batch group for multi-file imports", () => {
		expect(
			createMarkdownImportSequenceGroup(
				["Notes/1.md", "Notes/2.md"],
				1_700_000_000_000,
			),
		).toBe("md-batch:1700000000000");
	});
});
