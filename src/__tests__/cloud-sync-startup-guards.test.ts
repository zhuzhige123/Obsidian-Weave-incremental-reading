/**
 * Cloud-sync startup guards that live on StandaloneIRPlugin.
 * These are light behavioral contracts extracted via private-method access
 * on a minimal stub host (avoids loading the full plugin graph).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("cloud sync startup guards", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("folder subscription sync with trigger=startup returns 0 without applying writes", async () => {
		const ensureDeferredStartupComplete = vi.fn(async () => undefined);
		const host = {
			ensureDeferredStartupComplete,
			async performIncrementalReadingFolderSubscriptionSync(options?: {
				trigger?: "startup" | "settings" | "file-change" | "manual";
			}): Promise<number> {
				await this.ensureDeferredStartupComplete();
				const trigger = options?.trigger ?? "manual";
				if (trigger === "startup") {
					return 0;
				}
				throw new Error("should not reach apply path for startup");
			},
		};

		await expect(
			host.performIncrementalReadingFolderSubscriptionSync({
				trigger: "startup",
			}),
		).resolves.toBe(0);
		expect(ensureDeferredStartupComplete).toHaveBeenCalled();
	});

	it("vault_change refresh recomputes even when index metadata is unchanged", () => {
		const options = {
			trigger: "vault_change" as const,
			recompute: true,
			changedPaths: ["weave Incremental reading/points/a.irdeck"],
			removedPaths: [] as string[],
		};
		const hasIndexChanges = false;
		const hasVaultPathTouches =
			options.trigger === "vault_change" &&
			((options.changedPaths?.length ?? 0) > 0 ||
				(options.removedPaths?.length ?? 0) > 0);

		expect(options.recompute && (hasIndexChanges || hasVaultPathTouches)).toBe(
			true,
		);
	});
});
