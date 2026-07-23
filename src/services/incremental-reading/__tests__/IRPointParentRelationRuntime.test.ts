import { describe, expect, it } from "vitest";
import {
	buildParentRelationRuntime,
	filterParentPickerItemsAgainstCycles,
	formatParentPickerSuggestDisplay,
	isDescendantOfParentCandidate,
	listParentPickerItems,
} from "../IRPointParentRelationRuntime";
import type { IRPointSnapshot } from "../../../types/ir-point-storage-types";

function snap(
	id: string,
	parentPointId: string | null = null,
	topicId = "topic-a",
	overrides?: Partial<IRPointSnapshot["point"]>,
): IRPointSnapshot {
	return {
		topicId,
		topicName: topicId,
		material: {} as IRPointSnapshot["material"],
		point: {
			id,
			pointType: "chunk-entry",
			materialId: "m",
			source: { id: "s", type: "markdown", path: `Notes/${id}.md`, title: id },
			timestamps: { createdAt: "", updatedAt: "" },
			trace: {
				locatorType: "markdown-chunk",
				locator: {},
				traceState: "verified",
				traceConfidence: 1,
				fallbackLocators: [],
			},
			parameterContext: {
				materialClass: "reference-note",
				scheduleProfileRef: "default",
				classificationSource: "manual",
				isOverride: false,
			},
			schedule: {
				status: id === "c1" ? "done" : "learning",
				priorityScore: 5,
				manualPriority: 5,
				intervalDays: 1,
			},
			relations: {
				topicIds: [topicId],
				parentPointId,
				linkedCardIds: [],
				linkedNotePaths: [],
			},
			userData: { title: `Title ${id}`, tags: [], isStarred: false },
			stats: {
				impressionCount: 0,
				reviewCount: 0,
				extractCount: 0,
				cardCreatedCount: 0,
				noteCreatedCount: 0,
				totalReadingTimeMs: 0,
			},
			audit: { createdBy: "test" },
			...overrides,
		},
	} as IRPointSnapshot;
}

describe("IRPointParentRelationRuntime", () => {
	it("builds progress for parents and filters picker cycles", () => {
		const runtime = buildParentRelationRuntime([
			snap("parent"),
			snap("c1", "parent"),
			snap("c2", "parent"),
			snap("other"),
		]);

		expect(runtime.progressByParentId.get("parent")).toEqual({
			totalChildren: 2,
			completedChildren: 1,
			percent: 50,
		});

		const items = listParentPickerItems(runtime, { excludePointId: "c1" });
		expect(items.map((item) => item.id)).toEqual(
			expect.arrayContaining(["parent", "c2", "other"]),
		);
		expect(items.map((item) => item.id)).not.toContain("c1");

		expect(isDescendantOfParentCandidate("c1", "parent", runtime.index)).toBe(
			true,
		);
		expect(
			filterParentPickerItemsAgainstCycles(items, "parent", runtime.index).map(
				(item) => item.id,
			),
		).not.toContain("c1");
	});

	it("formats picker rows as reading-point title with path subtitle", () => {
		expect(
			formatParentPickerSuggestDisplay(
				snap("md-1", null, "topic-a", {
					userData: {
						title: "7_.2_概念的形成",
						tags: [],
						isStarred: false,
					},
					source: {
						id: "s",
						type: "markdown",
						path: "Notes/7_.2_概念的形成.md",
						title: "7_.2_概念的形成",
					},
				}),
			),
		).toEqual({
			title: "7_.2_概念的形成",
			subtitle: "Notes/7_.2_概念的形成.md",
		});

		expect(
			formatParentPickerSuggestDisplay(
				snap("epubbm-1", null, "topic-a", {
					id: "epubbm-1",
					pointType: "chapter-entry",
					userData: {
						title: "05 先考试后学习",
						tags: [],
						isStarred: false,
					},
					source: {
						id: "s",
						type: "epub",
						path: "附件/如何学习.epub",
						title: "如何学习",
					},
					trace: {
						locatorType: "epub-chapter",
						locator: {},
						traceState: "verified",
						traceConfidence: 1,
						fallbackLocators: [],
					},
					audit: { createdBy: "test", origin: { type: "epub-bookmark" } },
				}),
			),
		).toEqual({
			title: "05 先考试后学习",
			subtitle: "附件/如何学习.epub",
		});

		expect(
			formatParentPickerSuggestDisplay(
				snap("web-1", null, "topic-a", {
					userData: {
						title: "示例网页",
						tags: [],
						isStarred: false,
					},
					metadata: { webUrl: "https://example.com/a" },
				}),
			),
		).toEqual({
			title: "示例网页",
			subtitle: "https://example.com/a",
		});

		expect(
			formatParentPickerSuggestDisplay(
				snap("canvas-1", null, "topic-a", {
					userData: {
						title: "画布节点",
						tags: [],
						isStarred: false,
					},
					source: {
						id: "s",
						type: "markdown",
						path: "Boards/topic.canvas",
						title: "topic",
					},
					trace: {
						locatorType: "canvas-node",
						locator: { canvasPath: "Boards/topic.canvas" },
						traceState: "verified",
						traceConfidence: 1,
						fallbackLocators: [],
					},
				}),
			),
		).toEqual({
			title: "画布节点",
			subtitle: "Boards/topic.canvas",
		});
	});
});
