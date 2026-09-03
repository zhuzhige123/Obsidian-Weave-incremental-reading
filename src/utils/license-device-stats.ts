import { LICENSE_CLOUD_MAX_DEVICES } from "../config/license-cloud-config";
import { LEGACY_WEAVE_PRODUCT_IDS } from "../config/plugin-runtime";
import type { LicenseInfo } from "../types/license";
import {
	type PluginLookupApp,
	getInheritedLicensesFromLegacyWeave,
} from "./plugin-access";

export interface LicenseDeviceStats {
	used: number;
	max: number;
}

/** Seat pool: suite codes vs standalone IR codes. */
export type LicenseDevicePoolKind = "suite" | "standalone-ir" | "unknown";

export function resolveLicenseDevicePoolKind(
	license: LicenseInfo | null | undefined,
): LicenseDevicePoolKind {
	if (!license?.isActivated) {
		return "unknown";
	}
	if (isWeavePrimaryLicense(license)) {
		return "suite";
	}
	if (
		license.issuedProductId === "weave-incremental-reading" ||
		Boolean(license.entitlements?.includes("ir-premium"))
	) {
		return "standalone-ir";
	}
	return "unknown";
}

export function isWeavePrimaryLicense(
	license: LicenseInfo | null | undefined,
): boolean {
	if (!license) {
		return false;
	}

	return (
		LEGACY_WEAVE_PRODUCT_IDS.has(license.issuedProductId ?? "") ||
		Boolean(license.entitlements?.includes("weave-premium"))
	);
}

export function getLicenseDeviceStats(
	license: LicenseInfo | null | undefined,
): LicenseDeviceStats | null {
	if (!license?.isActivated) {
		return null;
	}

	const max =
		license.cloudSync?.devicesMax ??
		license.maxDevices ??
		LICENSE_CLOUD_MAX_DEVICES;

	if (typeof license.cloudSync?.devicesUsed === "number") {
		return { used: license.cloudSync.devicesUsed, max };
	}

	if (license.boundEmail) {
		return { used: 1, max };
	}

	return null;
}

/**
 * 使用 Weave 主插件的云端设备统计（与主插件一致），避免本插件旧指纹导致多计设备。
 */
export function resolveLicenseDeviceStats(
	license: LicenseInfo | null | undefined,
	app?: PluginLookupApp,
): LicenseDeviceStats | null {
	if (!license?.isActivated) {
		return null;
	}

	if (isWeavePrimaryLicense(license) && app) {
		const weaveLicenses = getInheritedLicensesFromLegacyWeave(app);
		const matchingWeaveLicense = weaveLicenses.find(
			(candidate) =>
				candidate.isActivated &&
				candidate.activationCode &&
				(!license.activationCode ||
					candidate.activationCode === license.activationCode),
		);
		const weaveStats = getLicenseDeviceStats(
			matchingWeaveLicense ?? weaveLicenses[0],
		);
		if (weaveStats) {
			return weaveStats;
		}
	}

	return getLicenseDeviceStats(license);
}

export function formatLicenseDeviceStats(stats: LicenseDeviceStats): string {
	return `${stats.used}/${stats.max}`;
}
