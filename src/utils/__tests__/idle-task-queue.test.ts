import { describe, expect, it, vi } from "vitest";
import { runIdleBatchedTasks } from "../idle-task-queue";

describe("runIdleBatchedTasks", () => {
	it("processes all items when not cancelled", async () => {
		const processed: number[] = [];
		await runIdleBatchedTasks([1, 2, 3], async (item) => {
			processed.push(item);
			return item * 2;
		});
		expect(processed).toEqual([1, 2, 3]);
	});

	it("stops early when shouldCancel returns true", async () => {
		const cancelAfter = vi.fn();
		let calls = 0;
		await runIdleBatchedTasks(
			[1, 2, 3, 4, 5],
			async (item) => {
				calls += 1;
				return item;
			},
			{
				chunkSize: 1,
				shouldCancel: () => {
					cancelAfter();
					return calls >= 2;
				},
			}
		);
		expect(calls).toBeLessThan(5);
	});
});
