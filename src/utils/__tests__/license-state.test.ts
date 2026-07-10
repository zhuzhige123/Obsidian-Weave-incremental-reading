import type { LicenseInfo } from "../../types/license";
import {
	LICENSED_PRODUCTS,
	cloneLicenseAsInherited,
	licenseAppliesToProduct,
	mapProductIdToEntitlements,
	normalizeLicenseStore,
	resolveEffectiveLicenseState,
} from "../license-state";

function createLicense(overrides: Partial<LicenseInfo> = {}): LicenseInfo {
	return {
		activationCode: overrides.activationCode ?? "test-code",
		isActivated: overrides.isActivated ?? true,
		activatedAt: overrides.activatedAt ?? "2026-05-01T00:00:00.000Z",
		deviceFingerprint: overrides.deviceFingerprint ?? "device-fingerprint",
		expiresAt: overrides.expiresAt ?? "2099-05-01T00:00:00.000Z",
		productVersion: overrides.productVersion ?? "0.7.25",
		licenseType: overrides.licenseType ?? "lifetime",
		entitlements: overrides.entitlements ?? [],
		issuedProductId: overrides.issuedProductId,
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

describe("license-state multi product rules", () => {
	it("maps Weave product ids to weave and IR entitlements (不含 EPUB 专属权益)", () => {
		expect(mapProductIdToEntitlements("weave")).toEqual([
			"weave-premium",
			"ir-premium",
		]);
		expect(mapProductIdToEntitlements("weave-obsidian-plugin")).toEqual([
			"weave-premium",
			"ir-premium",
		]);
	});

	it("maps standalone IR product id to IR entitlement only", () => {
		expect(mapProductIdToEntitlements("weave-incremental-reading")).toEqual([
			"ir-premium",
		]);
	});

	it("allows Weave license to apply to IR but not IR-only to Weave", () => {
		const weaveLicense = createLicense({
			activationCode: "weave-license",
			entitlements: ["weave-premium", "epub-premium", "ir-premium"],
			issuedProductId: "weave",
		});
		const irLicense = createLicense({
			activationCode: "ir-license",
			entitlements: ["ir-premium"],
			issuedProductId: "weave-incremental-reading",
		});

		expect(licenseAppliesToProduct(weaveLicense, LICENSED_PRODUCTS.IR)).toBe(
			true,
		);
		expect(licenseAppliesToProduct(irLicense, LICENSED_PRODUCTS.IR)).toBe(true);
		expect(licenseAppliesToProduct(irLicense, LICENSED_PRODUCTS.WEAVE)).toBe(
			false,
		);
	});

	it("includes inherited Weave license when resolving IR effective state", () => {
		const weaveLicense = createLicense({
			activationCode: "weave-license",
			entitlements: ["weave-premium", "ir-premium"],
			issuedProductId: "weave",
		});

		const effectiveState = resolveEffectiveLicenseState({
			product: LICENSED_PRODUCTS.IR,
			inheritedLicenses: [
				cloneLicenseAsInherited(weaveLicense, LICENSED_PRODUCTS.WEAVE),
			],
		});

		expect(effectiveState.isPremiumActive).toBe(true);
		expect(effectiveState.primaryLicense?.source).toBe("inherited");
		expect(effectiveState.entitlements).toContain("ir-premium");
	});

	it("prefers local IR license while keeping inherited Weave license available", () => {
		const localIrLicense = createLicense({
			activationCode: "ir-local",
			entitlements: ["ir-premium"],
			issuedProductId: "weave-incremental-reading",
		});
		const inheritedWeaveLicense = cloneLicenseAsInherited(
			createLicense({
				activationCode: "weave-parent",
				entitlements: ["weave-premium", "ir-premium"],
				issuedProductId: "weave",
			}),
			LICENSED_PRODUCTS.WEAVE,
		);

		const effectiveState = resolveEffectiveLicenseState({
			product: LICENSED_PRODUCTS.IR,
			localLicenses: [localIrLicense],
			inheritedLicenses: [inheritedWeaveLicense],
		});

		expect(effectiveState.isPremiumActive).toBe(true);
		expect(effectiveState.primaryLicense?.activationCode).toBe("ir-local");
		expect(effectiveState.activeLicenses).toHaveLength(2);
	});

	it("treats a persisted empty local store as authoritative when explicitly cleared", () => {
		const legacyLicense = createLicense({
			activationCode: "legacy-ir-license",
			entitlements: ["ir-premium"],
			issuedProductId: "weave-incremental-reading",
		});

		const normalizedStore = normalizeLicenseStore(legacyLicense, {
			localLicenses: [],
			updatedAt: "2026-05-08T12:00:00.000Z",
			localLicensesClearedAt: "2026-05-08T12:00:00.000Z",
		});

		expect(normalizedStore.localLicenses).toEqual([]);
		expect(normalizedStore.localLicensesClearedAt).toBe(
			"2026-05-08T12:00:00.000Z",
		);
	});

	it("migrates stale empty local store when legacy activation is still present", () => {
		const legacyLicense = createLicense({
			activationCode: "legacy-ir-license",
			entitlements: ["ir-premium"],
			issuedProductId: "weave-incremental-reading",
		});

		const normalizedStore = normalizeLicenseStore(legacyLicense, {
			localLicenses: [],
			updatedAt: "2026-05-08T12:00:00.000Z",
		});

		expect(normalizedStore.localLicenses).toHaveLength(1);
		expect(normalizedStore.localLicenses[0]?.activationCode).toBe(
			"legacy-ir-license",
		);
	});
});
