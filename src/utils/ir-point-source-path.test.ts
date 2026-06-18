import { describe, expect, it } from "vitest";
import type { IRPoint } from "../types/ir-point-storage-types";
import {
	countInvalidSourcePathFieldsInRawPoint,
	sanitizePointSourcePathFields,
} from "./ir-point-source-path";

describe("ir-point-source-path", () => {
	it("counts invalid paths in raw point records", () => {
		expect(
			countInvalidSourcePathFieldsInRawPoint({
				id: "chunk-1",
				source: { path: "/" },
				metadata: { sourcePath: "Inbox/" },
			})
		).toBe(2);
	});

	it("sanitizes invalid source and locator paths on IRPoint", () => {
		const point = {
			id: "chunk-1",
			source: { id: "mat-1", type: "markdown", path: "/", title: "Broken" },
			trace: {
				locatorType: "markdown-chunk",
				locator: { filePath: "/", sourcePath: "Notes/Good.md" },
			},
			metadata: { sourcePath: "Inbox/folder" },
		} as IRPoint;

		const result = sanitizePointSourcePathFields(point);
		expect(result.changed).toBe(true);
		expect(result.point.source?.path).toBe("");
		expect(result.point.trace?.locator).toEqual({ sourcePath: "Notes/Good.md" });
		expect(result.point.metadata?.sourcePath).toBeUndefined();
		expect(result.clearedFields).toContain("source.path");
	});
});
