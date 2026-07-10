import type { App } from "obsidian";
import type { IRBlockV4 } from "../../types/ir-types";
import type { IRFuturePlanPreview } from "./IRV4SchedulerService";
import { IRV4SchedulerService } from "./IRV4SchedulerService";

type ImpactPreviewKey = string;

/**
 * 串行化调度影响预览，避免安排菜单/优先级滑块并行触发多路 L2 重算。
 */
export class IRScheduleImpactPreviewCoordinator {
	private chain: Promise<void> = Promise.resolve();
	private readonly previewCache = new Map<
		ImpactPreviewKey,
		IRFuturePlanPreview | undefined
	>();

	constructor(private readonly app: App) {}

	private buildCacheKey(
		deckPath: string,
		originalBlock: IRBlockV4,
		updatedBlock: IRBlockV4,
	): ImpactPreviewKey {
		return [
			deckPath,
			originalBlock.id,
			originalBlock.nextRepDate,
			originalBlock.intervalDays,
			updatedBlock.nextRepDate,
			updatedBlock.intervalDays,
			updatedBlock.status,
		].join("::");
	}

	async previewBlockMutationImpact(
		originalBlock: IRBlockV4,
		updatedBlock: IRBlockV4,
		deckPath: string,
	): Promise<IRFuturePlanPreview | undefined> {
		if (!deckPath) {
			return undefined;
		}
		const cacheKey = this.buildCacheKey(deckPath, originalBlock, updatedBlock);
		if (this.previewCache.has(cacheKey)) {
			return this.previewCache.get(cacheKey);
		}

		const run = this.chain.then(async () => {
			const scheduler = new IRV4SchedulerService(this.app);
			return scheduler.previewFuturePlanForBlockMutation(
				deckPath,
				originalBlock,
				updatedBlock,
			);
		});
		this.chain = run.then(
			() => undefined,
			() => undefined,
		);

		try {
			const preview = await run;
			this.previewCache.set(cacheKey, preview);
			return preview;
		} catch {
			this.previewCache.set(cacheKey, undefined);
			return undefined;
		}
	}

	invalidate(): void {
		this.previewCache.clear();
	}
}

const coordinatorByApp = new WeakMap<App, IRScheduleImpactPreviewCoordinator>();

export function getSharedIRScheduleImpactPreviewCoordinator(
	app: App,
): IRScheduleImpactPreviewCoordinator {
	let coordinator = coordinatorByApp.get(app);
	if (!coordinator) {
		coordinator = new IRScheduleImpactPreviewCoordinator(app);
		coordinatorByApp.set(app, coordinator);
	}
	return coordinator;
}
