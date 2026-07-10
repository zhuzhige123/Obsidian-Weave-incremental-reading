import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LicenseInfo } from "../../types/license";
import {
	LICENSED_PRODUCTS,
	cloneLicenseAsInherited,
	resolveEffectiveLicenseState,
} from "../license-state";
import {
	WEAVE_LICENSE_CHANGED_WORKSPACE_EVENT,
	buildLicenseSyncFingerprint,
	registerLicenseSyncBridge,
} from "../license-sync-bridge";

function createLicense(
	activationCode: string,
	entitlements: LicenseInfo["entitlements"] = ["ir-premium"],
): LicenseInfo {
	return {
		activationCode,
		isActivated: true,
		activatedAt: "2026-05-01T00:00:00.000Z",
		deviceFingerprint: "device",
		expiresAt: "2099-05-01T00:00:00.000Z",
		productVersion: "1.0.0",
		licenseType: "lifetime",
		entitlements,
		issuedProductId: "weave-incremental-reading",
		source: "local",
	};
}

function createTarget(overrides?: {
	allowInheritedLicenses?: boolean;
	localLicenses?: LicenseInfo[];
	inheritedLicenses?: LicenseInfo[];
	weaveInstalled?: boolean;
}) {
	const localLicenses = overrides?.localLicenses ?? [];
	const inheritedLicenses = overrides?.inheritedLicenses ?? [];
	const refreshPremiumState = vi.fn(async () => {});

	const pluginShell = {
		app: {
			plugins: {
				getPlugin: vi.fn((id: string) =>
					overrides?.weaveInstalled !== false && id === "weave" ? {} : null,
				),
			},
			workspace: {
				on: vi.fn(() => ({ unregister: vi.fn() })),
				onLayoutReady: vi.fn((callback: () => void) => callback()),
				trigger: vi.fn(),
			},
		},
		registerEvent: vi.fn(),
		registerDomEvent: vi.fn(),
	};

	const target = {
		app: pluginShell.app,
		settings: {
			allowInheritedLicenses: overrides?.allowInheritedLicenses ?? true,
		},
		getEffectiveLicenseState() {
			return resolveEffectiveLicenseState({
				product: LICENSED_PRODUCTS.IR,
				localLicenses,
				inheritedLicenses:
					target.settings.allowInheritedLicenses === false
						? []
						: inheritedLicenses,
			});
		},
		refreshPremiumState,
	};

	return {
		target,
		pluginShell,
		refreshPremiumState,
		inheritedLicenses,
	};
}

describe("license-sync-bridge", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("exports the weave license changed event name", () => {
		expect(WEAVE_LICENSE_CHANGED_WORKSPACE_EVENT).toBe("Weave:license-changed");
	});

	it("refreshes premium state when weave license changed event fires", async () => {
		const { target, pluginShell, refreshPremiumState } = createTarget();
		registerLicenseSyncBridge(pluginShell as any, target, { debounceMs: 50 });
		await vi.advanceTimersByTimeAsync(50);

		expect(refreshPremiumState).toHaveBeenCalledTimes(1);

		const workspaceOn = pluginShell.app.workspace.on as ReturnType<
			typeof vi.fn
		>;
		const licenseHandler = workspaceOn.mock.calls.find(
			(call) => call[0] === WEAVE_LICENSE_CHANGED_WORKSPACE_EVENT,
		)?.[1] as () => void;

		licenseHandler();
		await vi.advanceTimersByTimeAsync(50);
		expect(refreshPremiumState).toHaveBeenCalledTimes(2);
	});

	it("passive refresh runs when inherited license appears", async () => {
		const weaveLicense = cloneLicenseAsInherited(
			createLicense("weave-shared", ["weave-premium", "ir-premium"]),
			"weave",
		);
		const { target, pluginShell, refreshPremiumState, inheritedLicenses } =
			createTarget();
		registerLicenseSyncBridge(pluginShell as any, target, { debounceMs: 50 });
		await vi.advanceTimersByTimeAsync(50);

		expect(refreshPremiumState).toHaveBeenCalledTimes(1);

		inheritedLicenses.push(weaveLicense);

		const focusHandler = (
			pluginShell.registerDomEvent as ReturnType<typeof vi.fn>
		).mock.calls.find((call) => call[1] === "focus")?.[2] as () => void;

		focusHandler();
		await vi.advanceTimersByTimeAsync(50);
		expect(refreshPremiumState).toHaveBeenCalledTimes(2);
	});
});
