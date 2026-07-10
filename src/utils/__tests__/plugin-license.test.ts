import { describe, expect, it } from "vitest";
import type { LicenseInfo, LicenseStore } from "../../types/license";
import { DEFAULT_LICENSE_INFO } from "../../types/license";
import { resolveEffectiveLicenseState } from "../license-state";
import {
	clearPluginLocalLicenses,
	getPluginActivationRemovalKind,
	getPluginLocalLicenses,
	removePluginActivation,
	upsertPluginLocalLicense,
} from "../plugin-license";

function createLicense(overrides: Partial<LicenseInfo> = {}): LicenseInfo {
	return {
		activationCode: overrides.activationCode ?? "test-code",
		isActivated: overrides.isActivated ?? true,
		activatedAt: overrides.activatedAt ?? "2026-05-01T00:00:00.000Z",
		deviceFingerprint: overrides.deviceFingerprint ?? "device-fingerprint",
		expiresAt: overrides.expiresAt ?? "2099-05-01T00:00:00.000Z",
		productVersion: overrides.productVersion ?? "0.7.25",
		licenseType: overrides.licenseType ?? "lifetime",
		entitlements: overrides.entitlements ?? ["ir-premium"],
		issuedProductId: overrides.issuedProductId ?? "weave-incremental-reading",
		source: overrides.source ?? "local",
		sourcePluginId: overrides.sourcePluginId,
		boundEmail: overrides.boundEmail,
		cloudSync: overrides.cloudSync,
		fingerprintVersion: overrides.fingerprintVersion,
		userId: overrides.userId,
		maxDevices: overrides.maxDevices,
		features: overrides.features,
		metadata: overrides.metadata,
	};
}

function createPlugin(settings?: {
	license?: LicenseInfo;
	licenseState?: LicenseStore;
	allowInheritedLicenses?: boolean;
	inheritedLicenses?: LicenseInfo[];
}) {
	const inheritedLicenses = settings?.inheritedLicenses ?? [];

	const plugin = {
		manifest: {
			id: "weave-incremental-reading",
		},
		settings: {
			license: settings?.license ?? { ...DEFAULT_LICENSE_INFO },
			licenseState: settings?.licenseState ?? { localLicenses: [] },
			allowInheritedLicenses: settings?.allowInheritedLicenses ?? true,
		},
		getLocalLicenses() {
			return plugin.settings.licenseState.localLicenses;
		},
		getEffectiveLicenseState() {
			return resolveEffectiveLicenseState({
				product: "weave-incremental-reading",
				localLicenses: plugin.getLocalLicenses(),
				inheritedLicenses:
					plugin.settings.allowInheritedLicenses === false
						? []
						: inheritedLicenses,
			});
		},
	};

	return plugin;
}

describe("plugin-license", () => {
	it("clears both persisted local licenses and legacy primary license data", () => {
		const existingLicense = createLicense({
			activationCode: "existing-license",
		});
		const plugin = createPlugin({
			license: existingLicense,
			licenseState: {
				localLicenses: [existingLicense],
				updatedAt: "2026-05-08T12:00:00.000Z",
			},
		});

		clearPluginLocalLicenses(plugin);

		expect(plugin.settings.license).toEqual(DEFAULT_LICENSE_INFO);
		expect(plugin.settings.licenseState.localLicenses).toEqual([]);
		expect(getPluginLocalLicenses(plugin)).toEqual([]);
	});

	it("identifies inherited-only removal when no local license exists but shared access is active", () => {
		const inheritedLicense = createLicense({
			activationCode: "shared-license",
			source: "inherited",
		});
		const plugin = createPlugin({
			inheritedLicenses: [inheritedLicense],
			allowInheritedLicenses: true,
		});

		expect(
			getPluginActivationRemovalKind(plugin, {
				disableInheritedLicenses: true,
			}),
		).toBe("inherited-only");

		const result = removePluginActivation(plugin, {
			disableInheritedLicenses: true,
		});

		expect(result.removalKind).toBe("inherited-only");
		expect(plugin.settings.allowInheritedLicenses).toBe(false);
		expect(result.nextState.isPremiumActive).toBe(false);
	});

	it("identifies combined removal when local and inherited licenses coexist", () => {
		const localLicense = createLicense({ activationCode: "local-license" });
		const inheritedLicense = createLicense({
			activationCode: "shared-license",
			source: "inherited",
		});
		const plugin = createPlugin({
			license: localLicense,
			licenseState: {
				localLicenses: [localLicense],
				updatedAt: "2026-05-08T12:00:00.000Z",
			},
			inheritedLicenses: [inheritedLicense],
			allowInheritedLicenses: true,
		});

		const result = removePluginActivation(plugin, {
			disableInheritedLicenses: true,
		});

		expect(result.removalKind).toBe("local-and-inherited");
		expect(plugin.settings.allowInheritedLicenses).toBe(false);
		expect(plugin.settings.licenseState.localLicenses).toEqual([]);
		expect(result.nextState.isPremiumActive).toBe(false);
	});

	it("keeps the latest local license as the legacy primary mirror after upsert", () => {
		const plugin = createPlugin();
		const firstLicense = createLicense({ activationCode: "first-license" });
		const secondLicense = createLicense({ activationCode: "second-license" });

		upsertPluginLocalLicense(plugin, firstLicense);
		upsertPluginLocalLicense(plugin, secondLicense);

		expect(plugin.settings.license.activationCode).toBe("second-license");
		expect(
			plugin.settings.licenseState.localLicenses.map(
				(license) => license.activationCode,
			),
		).toEqual(["second-license", "first-license"]);
	});
});
