import { describe, expect, it, vi } from "vitest";
import type { IRVaultPointFileEntry } from "../../../types/ir-data-management-types";
import { IR_POINT_STORAGE_VERSION } from "../../../types/ir-point-storage-types";
import { IRDeckDataManagementService } from "../IRDeckDataManagementService";

describe("IRDeckDataManagementService helpers", () => {
	const service = {
		buildDuplicateGroups(files: IRVaultPointFileEntry[]) {
			return new IRDeckDataManagementService({} as any).buildDuplicateGroups(
				files,
			);
		},
		buildNormalizeMovePlan(files: IRVaultPointFileEntry[], targetDir: string) {
			return new IRDeckDataManagementService({} as any).buildNormalizeMovePlan(
				files,
				targetDir,
			);
		},
	};

	const sampleFiles: IRVaultPointFileEntry[] = [
		{
			absolutePath: "weave/incremental-reading/points/A.irdeck",
			topicId: "topic-a",
			topicName: "Topic A",
			pointCount: 10,
			updatedAt: "2026-05-20T00:00:00.000Z",
			isInCanonicalDir: true,
		},
		{
			absolutePath: "Topics/A.irdeck",
			topicId: "topic-a",
			topicName: "Topic A",
			pointCount: 3,
			updatedAt: "2026-05-19T00:00:00.000Z",
			isInCanonicalDir: false,
		},
		{
			absolutePath: "Topics/B.irdeck",
			topicId: "topic-b",
			topicName: "Topic B",
			pointCount: 1,
			updatedAt: "2026-05-18T00:00:00.000Z",
			isInCanonicalDir: false,
		},
	];

	it("groups duplicate topic ids", () => {
		const groups = service.buildDuplicateGroups(sampleFiles);
		expect(groups).toHaveLength(1);
		expect(groups[0]?.topicId).toBe("topic-a");
		expect(groups[0]?.files).toHaveLength(2);
	});

	it("builds move plan only for files outside canonical directory", () => {
		const plan = service.buildNormalizeMovePlan(
			sampleFiles,
			"weave/incremental-reading/points",
		);
		expect(plan).toHaveLength(2);
		expect(plan.map((item) => item.sourcePath)).toEqual(
			expect.arrayContaining(["Topics/A.irdeck", "Topics/B.irdeck"]),
		);
		expect(
			plan.every((item) =>
				item.targetPath.startsWith("weave/incremental-reading/points/"),
			),
		).toBe(true);
	});

	it("uses part suffix when moving multiple files for the same topic into one folder", () => {
		const outsideOnly: IRVaultPointFileEntry[] = [
			{
				absolutePath: "A/Topic.irdeck",
				topicId: "topic-x",
				topicName: "Topic",
				pointCount: 5,
				updatedAt: "2026-05-20T00:00:00.000Z",
				isInCanonicalDir: false,
			},
			{
				absolutePath: "B/Topic.irdeck",
				topicId: "topic-x",
				topicName: "Topic",
				pointCount: 2,
				updatedAt: "2026-05-19T00:00:00.000Z",
				isInCanonicalDir: false,
			},
		];
		const plan = service.buildNormalizeMovePlan(
			outsideOnly,
			"weave/incremental-reading/points",
		);
		expect(plan).toHaveLength(2);
		expect(plan[0]?.targetPath).toBe(
			"weave/incremental-reading/points/Topic.irdeck",
		);
		expect(plan[1]?.targetPath).toBe(
			"weave/incremental-reading/points/Topic.part2.irdeck",
		);
	});

	it("flags legacy schema and empty points in format inspection", async () => {
		const files = new Map<string, string>([
			[
				"weave/incremental-reading/points/Legacy.irdeck",
				JSON.stringify({
					topicId: "topic-legacy",
					topicName: "Legacy",
					points: [],
				}),
			],
		]);
		const adapter = {
			exists: vi.fn(async (path: string) => files.has(path)),
			read: vi.fn(async (path: string) => files.get(path) || ""),
		};
		const service = new IRDeckDataManagementService({
			vault: { adapter },
		} as any);

		const report = await service.inspectPointFileFormat(
			"weave/incremental-reading/points/Legacy.irdeck",
		);
		expect(report.isEmpty).toBe(true);
		expect(report.needsMigration).toBe(true);
		expect(report.issues.some((issue) => issue.code === "schema_version")).toBe(
			true,
		);
		expect(report.issues.some((issue) => issue.code === "empty_points")).toBe(
			true,
		);
		expect(
			report.issues.find((issue) => issue.code === "schema_version")?.message,
		).toContain(String(IR_POINT_STORAGE_VERSION));
	});

	it("refuses to recover backup orphan when target path already exists", async () => {
		const backupPath = "plugins/weave-incremental-reading/backups/Topic.irdeck";
		const targetDir = "weave/incremental-reading/points";
		const existingTarget = `${targetDir}/Topic.irdeck`;
		const files = new Map<string, string>([
			[
				backupPath,
				JSON.stringify({
					schemaVersion: IR_POINT_STORAGE_VERSION,
					topicId: "topic-recover",
					topicName: "Topic",
					points: [{ id: "p1", source: { path: "note.md" } }],
				}),
			],
		]);
		const adapter = {
			exists: vi.fn(
				async (path: string) =>
					files.has(path) || path === existingTarget || path === targetDir,
			),
			read: vi.fn(async (path: string) => files.get(path) || ""),
			write: vi.fn(async (path: string, content: string) => {
				files.set(path, content);
			}),
			mkdir: vi.fn(async () => undefined),
		};
		const service = new IRDeckDataManagementService({
			vault: { adapter },
		} as any);

		await expect(
			service.recoverBackupOrphan(
				{
					absolutePath: backupPath,
					topicId: "topic-recover",
					topicName: "Topic",
					pointCount: 1,
					updatedAt: "2026-05-20T00:00:00.000Z",
					backupRoot: "plugins/weave-incremental-reading/backups",
					relativePath: "Topic.irdeck",
				},
				targetDir,
			),
		).rejects.toThrow("库内已存在同名专题文件");
		expect(adapter.write).not.toHaveBeenCalled();
	});
});
