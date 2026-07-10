import { vi } from "vitest";

/** Minimal App shape for standalone IR unit tests. */
export function createStandaloneIRTestApp(
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	const adapter = {
		exists: vi.fn(async () => false),
		read: vi.fn(async () => ""),
		write: vi.fn(async () => undefined),
		writeBinary: vi.fn(async () => undefined),
		readBinary: vi.fn(async () => new ArrayBuffer(0)),
		mkdir: vi.fn(async () => undefined),
		remove: vi.fn(async () => undefined),
		list: vi.fn(async () => ({ files: [], folders: [] })),
		...(overrides.vault as { adapter?: Record<string, unknown> } | undefined)
			?.adapter,
	};

	const vault = {
		configDir: ".obsidian",
		adapter,
		getAbstractFileByPath: vi.fn(() => null),
		read: vi.fn(async () => ""),
		...(overrides.vault as Record<string, unknown> | undefined),
	};

	return {
		plugins: {
			getPlugin: vi.fn(() => null),
			...(overrides.plugins as Record<string, unknown> | undefined),
		},
		vault,
		workspace: {
			on: vi.fn(() => ({ unregister: vi.fn() })),
			onLayoutReady: vi.fn((callback: () => void) => callback()),
			trigger: vi.fn(),
			getLeavesOfType: vi.fn(() => []),
			getMostRecentLeaf: vi.fn(() => null),
			...(overrides.workspace as Record<string, unknown> | undefined),
		},
		...overrides,
	};
}
