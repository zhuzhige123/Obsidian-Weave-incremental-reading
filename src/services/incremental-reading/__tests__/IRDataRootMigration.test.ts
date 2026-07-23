import { describe, expect, it, vi } from "vitest";
import {
	DEFAULT_IR_DATA_ROOT,
	LEGACY_IR_DATA_ROOT,
} from "../../../config/paths";
import { migrateIRDataRootIfNeeded } from "../IRDataRootMigration";

function createHost(options: {
	files: Set<string>;
	weaveParentFolder?: string;
}) {
	const files = options.files;
	const renamed: Array<{ from: string; to: string }> = [];
	const host = {
		app: {
			vault: {
				adapter: {
					exists: async (path: string) => files.has(path),
					rename: async (from: string, to: string) => {
						if (!files.has(from)) {
							throw new Error(`missing: ${from}`);
						}
						files.delete(from);
						// move immediate children markers for test simplicity
						for (const key of [...files]) {
							if (key.startsWith(`${from}/`)) {
								files.delete(key);
								files.add(`${to}${key.slice(from.length)}`);
							}
						}
						files.add(to);
						renamed.push({ from, to });
					},
				},
			},
		},
		settings: {
			weaveParentFolder: options.weaveParentFolder ?? "",
		},
		saveSettings: vi.fn(async () => undefined),
	};
	return { host, renamed, files };
}

describe("migrateIRDataRootIfNeeded", () => {
	it("renames default legacy root to weave Incremental reading", async () => {
		const { host, renamed } = createHost({
			files: new Set([
				LEGACY_IR_DATA_ROOT,
				`${LEGACY_IR_DATA_ROOT}/points`,
			]),
		});

		const result = await migrateIRDataRootIfNeeded(host as never);

		expect(result.renamedDefaultRoot).toBe(true);
		expect(renamed).toEqual([
			{ from: LEGACY_IR_DATA_ROOT, to: DEFAULT_IR_DATA_ROOT },
		]);
	});

	it("rebinds old custom parent prefix to legacy IR root", async () => {
		const { host } = createHost({
			weaveParentFolder: "Archive",
			files: new Set([
				"Archive/weave/incremental-reading",
				"Archive/weave/incremental-reading/points",
			]),
		});

		const result = await migrateIRDataRootIfNeeded(host as never);

		expect(result.reboundCustomParent).toBe(true);
		expect(host.settings.weaveParentFolder).toBe(
			"Archive/weave/incremental-reading",
		);
		expect(host.saveSettings).toHaveBeenCalled();
	});

	it("no-ops when new default root already has data", async () => {
		const { host, renamed } = createHost({
			files: new Set([
				LEGACY_IR_DATA_ROOT,
				`${LEGACY_IR_DATA_ROOT}/points`,
				DEFAULT_IR_DATA_ROOT,
				`${DEFAULT_IR_DATA_ROOT}/points`,
			]),
		});

		const result = await migrateIRDataRootIfNeeded(host as never);

		expect(result.renamedDefaultRoot).toBe(false);
		expect(renamed).toEqual([]);
	});
});
