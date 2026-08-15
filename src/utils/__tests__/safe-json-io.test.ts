import { describe, expect, it, vi } from "vitest";
import { safeWriteJson } from "../safe-json-io";

describe("safeWriteJson", () => {
	it("skips adapter.write when file content is unchanged", async () => {
		const content = JSON.stringify({ version: 1, items: ["a"] }, null, 2);
		const adapter = {
			exists: vi.fn(async () => true),
			read: vi.fn(async () => content),
			write: vi.fn(async () => undefined),
		};

		await safeWriteJson(adapter, "weave Incremental reading/points/a.irdeck", content);

		expect(adapter.write).not.toHaveBeenCalled();
	});

	it("writes when file content differs", async () => {
		const existing = JSON.stringify({ version: 1, items: ["a"] }, null, 2);
		const next = JSON.stringify({ version: 1, items: ["b"] }, null, 2);
		const adapter = {
			exists: vi.fn(async () => true),
			read: vi.fn(async () => existing),
			write: vi.fn(async () => undefined),
		};

		await safeWriteJson(
			adapter,
			"weave Incremental reading/points/a.irdeck",
			next,
			{ vault: { configDir: ".obsidian" } },
		);

		expect(adapter.write).toHaveBeenCalled();
		const writeCalls = adapter.write.mock.calls.map((call) => call[0] as string);
		expect(writeCalls).toContain("weave Incremental reading/points/a.irdeck");
	});
});
