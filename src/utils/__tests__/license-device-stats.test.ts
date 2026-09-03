import { describe, expect, it } from "vitest";
import {
	getLicenseDeviceStats,
	isWeavePrimaryLicense,
	resolveLicenseDevicePoolKind,
	resolveLicenseDeviceStats,
	formatLicenseDeviceStats,
} from "../license-device-stats";
import type { LicenseInfo } from "../../types/license";

function buildLicense(overrides: Partial<LicenseInfo> = {}): LicenseInfo {
	return {
		activationCode: "code",
		isActivated: true,
		activatedAt: "2026-01-01T00:00:00.000Z",
		deviceFingerprint: "fp",
		expiresAt: "2099-01-01T00:00:00.000Z",
		productVersion: "0.5.0",
		licenseType: "lifetime",
		issuedProductId: "weave",
		entitlements: ["weave-premium", "ir-premium"],
		...overrides,
	};
}

describe("license-device-stats", () => {
	it("returns cloud sync counts when present", () => {
		const stats = getLicenseDeviceStats(
			buildLicense({
				cloudSync: {
					status: "synced",
					syncedAt: "2026-01-01T00:00:00.000Z",
					lastValidatedAt: "2026-01-01T00:00:00.000Z",
					devicesUsed: 2,
					devicesMax: 5,
				},
			}),
		);
		expect(stats).toEqual({ used: 2, max: 5 });
		expect(formatLicenseDeviceStats(stats!)).toBe("2/5");
	});

	it("classifies suite vs standalone IR pools", () => {
		expect(isWeavePrimaryLicense(buildLicense())).toBe(true);
		expect(resolveLicenseDevicePoolKind(buildLicense())).toBe("suite");
		expect(
			resolveLicenseDevicePoolKind(
				buildLicense({
					issuedProductId: "weave-incremental-reading",
					entitlements: ["ir-premium"],
				}),
			),
		).toBe("standalone-ir");
	});

	it("prefers weave plugin device stats for suite licenses", () => {
		const weavePlugin = {
			manifest: { id: "weave" },
			getEffectiveLicenseState: () => ({
				activeLicenses: [
					buildLicense({
						activationCode: "shared-code",
						cloudSync: {
							status: "synced",
							syncedAt: "2026-01-01T00:00:00.000Z",
							lastValidatedAt: "2026-01-01T00:00:00.000Z",
							devicesUsed: 1,
							devicesMax: 5,
						},
					}),
				],
			}),
		};

		const app = {
			plugins: {
				getPlugin: (id: string) => (id === "weave" ? weavePlugin : null),
			},
		};

		const stats = resolveLicenseDeviceStats(
			buildLicense({
				activationCode: "shared-code",
				cloudSync: {
					status: "synced",
					syncedAt: "2026-01-01T00:00:00.000Z",
					lastValidatedAt: "2026-01-01T00:00:00.000Z",
					devicesUsed: 3,
					devicesMax: 5,
				},
			}),
			app,
		);

		expect(stats).toEqual({ used: 1, max: 5 });
	});
});
