import { IRCalendarBackgroundLoadCoordinator } from "../IRCalendarBackgroundLoadCoordinator";

describe("IRCalendarBackgroundLoadCoordinator", () => {
	it("serializes heavy loads in order", async () => {
		const coordinator = new IRCalendarBackgroundLoadCoordinator();
		const order: string[] = [];

		const first = coordinator.runHeavyLoad("warmup", async () => {
			order.push("warmup-start");
			await new Promise((resolve) => setTimeout(resolve, 20));
			order.push("warmup-end");
			return "warmup";
		});

		const second = coordinator.runHeavyLoad("sidebar-reconcile", async () => {
			order.push("reconcile-start");
			return "reconcile";
		});

		await Promise.all([first, second]);
		expect(order).toEqual(["warmup-start", "warmup-end", "reconcile-start"]);
	});

	it("defers warmup while sidebar reconcile is active", async () => {
		const coordinator = new IRCalendarBackgroundLoadCoordinator();
		let releaseWarmup!: () => void;
		const warmupGate = new Promise<void>((resolve) => {
			releaseWarmup = resolve;
		});

		void coordinator.runHeavyLoad("sidebar-reconcile", async () => {
			await warmupGate;
			return undefined;
		});

		await Promise.resolve();
		expect(coordinator.shouldDeferWarmup()).toBe(true);

		releaseWarmup();
		await Promise.resolve();
		await coordinator.runHeavyLoad("warmup", async () => undefined);
		expect(coordinator.isHeavyLoadActive()).toBe(false);
	});
});
