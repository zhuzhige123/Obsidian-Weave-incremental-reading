import type { App } from "obsidian";

/** 会触发全库快照 / 调度重算的月历后台任务来源。 */
export type IRCalendarHeavyLoadOwner =
	| "warmup"
	| "sidebar-load"
	| "sidebar-reconcile";

/**
 * 串行化月历重查询，避免 warmup、首屏 load、后台 reconcile 并行触发多路全库扫描。
 */
export class IRCalendarBackgroundLoadCoordinator {
	private chain: Promise<void> = Promise.resolve();
	private activeOwner: IRCalendarHeavyLoadOwner | null = null;

	getActiveOwner(): IRCalendarHeavyLoadOwner | null {
		return this.activeOwner;
	}

	isHeavyLoadActive(): boolean {
		return this.activeOwner !== null;
	}

	shouldDeferWarmup(): boolean {
		return (
			this.activeOwner === "sidebar-load" ||
			this.activeOwner === "sidebar-reconcile"
		);
	}

	runHeavyLoad<T>(
		owner: IRCalendarHeavyLoadOwner,
		task: () => Promise<T>,
	): Promise<T> {
		const run = this.chain.then(async () => {
			this.activeOwner = owner;
			try {
				return await task();
			} finally {
				if (this.activeOwner === owner) {
					this.activeOwner = null;
				}
			}
		});
		this.chain = run.then(
			() => undefined,
			() => undefined,
		);
		return run;
	}
}

const coordinatorByApp = new WeakMap<
	App,
	IRCalendarBackgroundLoadCoordinator
>();

export function getSharedIRCalendarBackgroundLoadCoordinator(
	app: App,
): IRCalendarBackgroundLoadCoordinator {
	let coordinator = coordinatorByApp.get(app);
	if (!coordinator) {
		coordinator = new IRCalendarBackgroundLoadCoordinator();
		coordinatorByApp.set(app, coordinator);
	}
	return coordinator;
}
