import type { App } from "obsidian";

const finalizeChainsByApp = new WeakMap<App, Promise<void>>();

/**
 * 串行化月历安排 finalize，避免连续完成时 progress / L1 patch 乱序。
 */
export function enqueueScheduleFinalize(
	app: App,
	task: () => Promise<void>,
): void {
	const previous = finalizeChainsByApp.get(app) ?? Promise.resolve();
	const next = previous.then(() => task()).catch(() => undefined);
	finalizeChainsByApp.set(app, next);
}

export async function awaitScheduleFinalizeQueue(app: App): Promise<void> {
	await finalizeChainsByApp.get(app);
}
