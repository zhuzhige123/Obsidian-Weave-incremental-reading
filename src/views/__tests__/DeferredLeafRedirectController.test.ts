import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeferredLeafRedirectController } from "../DeferredLeafRedirectController";

type MockLeaf = { id: string };

function createWorkspace(options: {
	layoutReady?: boolean;
	activeLeaf?: MockLeaf | null;
	mostRecentLeaf?: MockLeaf | null;
	includeGetActiveLeaf?: boolean;
}) {
	const listeners = new Map<string, Set<(leaf: MockLeaf | null) => void>>();

	return {
		layoutReady: options.layoutReady ?? true,
		activeLeaf: options.activeLeaf ?? null,
		getMostRecentLeaf: vi.fn(() => options.mostRecentLeaf ?? null),
		...(options.includeGetActiveLeaf
			? { getActiveLeaf: vi.fn(() => options.activeLeaf ?? null) }
			: {}),
		on: vi.fn((event: string, callback: (leaf: MockLeaf | null) => void) => {
			if (!listeners.has(event)) {
				listeners.set(event, new Set());
			}
			listeners.get(event)?.add(callback);
			return { event, callback };
		}),
		offref: vi.fn(),
		onLayoutReady: vi.fn((callback: () => void) => {
			if (options.layoutReady ?? true) {
				callback();
			}
		}),
		emit(event: string, leaf: MockLeaf | null) {
			for (const callback of listeners.get(event) ?? []) {
				callback(leaf);
			}
		},
	};
}

describe("DeferredLeafRedirectController", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("redirects when the leaf is active via getMostRecentLeaf (no getActiveLeaf)", () => {
		const leaf = { id: "deck-leaf" };
		const onRedirect = vi.fn();
		const workspace = createWorkspace({
			layoutReady: true,
			mostRecentLeaf: leaf,
		});

		const controller = new DeferredLeafRedirectController({
			workspace: workspace as never,
			leaf: leaf as never,
			shouldRedirect: () => true,
			onRedirect,
			delayMs: 0,
		});

		controller.start();
		vi.runAllTimers();

		expect(onRedirect).toHaveBeenCalledTimes(1);
		controller.stop();
	});

	it("does not redirect while a different leaf is active", () => {
		const leaf = { id: "deck-leaf" };
		const other = { id: "other-leaf" };
		const onRedirect = vi.fn();
		const workspace = createWorkspace({
			layoutReady: true,
			mostRecentLeaf: other,
			activeLeaf: other,
		});

		const controller = new DeferredLeafRedirectController({
			workspace: workspace as never,
			leaf: leaf as never,
			shouldRedirect: () => true,
			onRedirect,
			delayMs: 0,
		});

		controller.start();
		vi.runAllTimers();

		expect(onRedirect).not.toHaveBeenCalled();
		controller.stop();
	});

	it("redirects after active-leaf-change selects this leaf", () => {
		const leaf = { id: "deck-leaf" };
		const other = { id: "other-leaf" };
		const onRedirect = vi.fn();
		let recentLeaf: MockLeaf | null = other;
		const workspace = createWorkspace({
			layoutReady: true,
			mostRecentLeaf: other,
			activeLeaf: other,
		});
		workspace.getMostRecentLeaf = vi.fn(() => recentLeaf);
		workspace.activeLeaf = other;

		const controller = new DeferredLeafRedirectController({
			workspace: workspace as never,
			leaf: leaf as never,
			shouldRedirect: () => true,
			onRedirect,
			delayMs: 0,
		});

		controller.start();
		vi.runAllTimers();
		expect(onRedirect).not.toHaveBeenCalled();

		recentLeaf = leaf;
		workspace.activeLeaf = leaf;
		workspace.emit("active-leaf-change", leaf);
		vi.runAllTimers();

		expect(onRedirect).toHaveBeenCalledTimes(1);
		controller.stop();
	});

	it("cancels a scheduled redirect when stop() runs before the timer fires", () => {
		const leaf = { id: "deck-leaf" };
		const onRedirect = vi.fn();
		const workspace = createWorkspace({
			layoutReady: true,
			mostRecentLeaf: leaf,
		});

		const controller = new DeferredLeafRedirectController({
			workspace: workspace as never,
			leaf: leaf as never,
			shouldRedirect: () => true,
			onRedirect,
			delayMs: 25,
		});

		controller.start();
		controller.stop();
		vi.runAllTimers();

		expect(onRedirect).not.toHaveBeenCalled();
	});
});
