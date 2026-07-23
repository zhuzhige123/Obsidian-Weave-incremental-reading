vi.mock("obsidian", () => ({
	normalizePath: (path: string) =>
		path.replace(/\\/g, "/").replace(/\/{2,}/g, "/"),
}));

import {
	countDerivedOutlinkNotes,
	hasDerivedOutlinkNotes,
	resolveDerivedOutlinkNotePaths,
} from "../IRAssociatedNoteOutlinks";

function createApp(resolvedLinks: Record<string, Record<string, number>>) {
	return {
		metadataCache: {
			resolvedLinks,
		},
	} as any;
}

describe("IRAssociatedNoteOutlinks", () => {
	it("从 metadataCache.resolvedLinks 派生可链笔记并去重排序", () => {
		const app = createApp({
			"Notes/Source.md": {
				"Notes/B.md": 2,
				"Notes/A.md": 1,
				"Books/Ref.pdf": 1,
				"Notes/Source.md": 1,
				"Boards/Map.canvas": 1,
			},
		});

		expect(resolveDerivedOutlinkNotePaths(app, "Notes\\Source.md")).toEqual([
			"Boards/Map.canvas",
			"Notes/A.md",
			"Notes/B.md",
		]);
		expect(countDerivedOutlinkNotes(app, "Notes/Source.md")).toBe(3);
	});

	it("缺少源路径或出链表时返回空列表", () => {
		const app = createApp({});
		expect(resolveDerivedOutlinkNotePaths(app, "")).toEqual([]);
		expect(resolveDerivedOutlinkNotePaths(app, "Notes/Missing.md")).toEqual([]);
	});

	it("hasDerivedOutlinkNotes 在有可链出链时为 true，且不依赖完整列表", () => {
		const app = createApp({
			"Notes/Source.md": {
				"Notes/A.md": 1,
			},
		});
		expect(hasDerivedOutlinkNotes(app, "Notes/Source.md")).toBe(true);
		expect(hasDerivedOutlinkNotes(app, "Notes/Empty.md")).toBe(false);
	});
});
