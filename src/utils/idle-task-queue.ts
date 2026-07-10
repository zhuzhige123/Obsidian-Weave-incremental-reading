/**
 * 在浏览器空闲时分批执行任务，避免长时间占用主线程导致 Obsidian UI 卡顿。
 */

export interface IdleTaskQueueOptions {
	/** 每批最多处理多少项 */
	chunkSize?: number;
	/** 单批最大耗时（毫秒），超时后让出主线程 */
	budgetMs?: number;
	shouldCancel?: () => boolean;
}

function yieldToMainThread(): Promise<void> {
	return new Promise((resolve) => {
		if (
			typeof window !== "undefined" &&
			typeof window.requestIdleCallback === "function"
		) {
			window.requestIdleCallback(() => resolve(), { timeout: 32 });
			return;
		}
		window.setTimeout(resolve, 0);
	});
}

/**
 * 顺序处理 items，在 chunk 边界与 budget 超时时让出主线程。
 */
export async function runIdleBatchedTasks<T, R>(
	items: T[],
	processItem: (item: T, index: number) => Promise<R>,
	options: IdleTaskQueueOptions = {},
): Promise<R[]> {
	const chunkSize = Math.max(1, Math.floor(options.chunkSize ?? 12));
	const budgetMs = Math.max(4, Math.floor(options.budgetMs ?? 10));
	const shouldCancel = options.shouldCancel;
	const results: R[] = [];

	for (let index = 0; index < items.length; index += 1) {
		if (shouldCancel?.()) {
			break;
		}

		const batchStartedAt = Date.now();
		const batchEnd = Math.min(items.length, index + chunkSize);
		for (let cursor = index; cursor < batchEnd; cursor += 1) {
			if (shouldCancel?.()) {
				return results;
			}
			results.push(await processItem(items[cursor], cursor));
			if (Date.now() - batchStartedAt >= budgetMs) {
				await yieldToMainThread();
			}
		}
		index = batchEnd - 1;

		if (batchEnd < items.length) {
			await yieldToMainThread();
		}
	}

	return results;
}
