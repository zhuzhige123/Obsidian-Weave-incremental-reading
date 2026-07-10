import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	WEAVE_MEMORY_STUDY_SESSION_EVENT,
	WEAVE_STUDY_VIEW_TYPE,
} from "../../weave-integration/weave-host-critical-work";
import { IRHostCriticalWorkGuard } from "../IRHostCriticalWorkGuard";

describe("IRHostCriticalWorkGuard", () => {
	const disposers: Array<() => void> = [];
	const getLeavesOfType = vi.fn(() => [] as unknown[]);
	const plugin = {
		app: {
			workspace: {
				getLeavesOfType,
				on: vi.fn(() => {
					const unregister = vi.fn();
					disposers.push(unregister);
					return unregister;
				}),
			},
		},
		register: (fn: () => void) => {
			disposers.push(fn);
		},
		registerEvent: vi.fn(),
	} as unknown as import("obsidian").Plugin;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		disposers.splice(0, disposers.length);
	});

	afterEach(() => {
		for (const dispose of disposers.splice(0, disposers.length)) {
			dispose();
		}
		vi.useRealTimers();
	});

	it("defers vault background work while memory study is active", async () => {
		const guard = new IRHostCriticalWorkGuard();
		guard.register(plugin);

		window.dispatchEvent(
			new CustomEvent(WEAVE_MEMORY_STUDY_SESSION_EVENT, {
				detail: { active: true },
			}),
		);

		const task = vi.fn(async () => undefined);
		guard.runVaultBackgroundWork(task);
		expect(task).not.toHaveBeenCalled();

		window.dispatchEvent(
			new CustomEvent(WEAVE_MEMORY_STUDY_SESSION_EVENT, {
				detail: { active: false },
			}),
		);
		await vi.runAllTimersAsync();

		expect(task).toHaveBeenCalledTimes(1);
	});

	it("falls back to workspace study leaf detection", () => {
		const guard = new IRHostCriticalWorkGuard();
		getLeavesOfType.mockReturnValue([{}]);
		guard.register(plugin);

		expect(guard.shouldDeferVaultBackgroundWork()).toBe(true);
		expect(getLeavesOfType).toHaveBeenCalledWith(WEAVE_STUDY_VIEW_TYPE);
	});
});
