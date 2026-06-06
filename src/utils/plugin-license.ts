import {
	DEFAULT_LICENSE_INFO,
	type EffectiveLicenseState,
	type LicenseInfo,
	type LicenseStore,
	type LicensedProduct,
} from "../types/license";
import {
	getLegacyPrimaryLicense,
	getProductFromPluginId,
	normalizeLicenseStore,
	resolveEffectiveLicenseState,
} from "./license-state";

export type PluginActivationRemovalKind =
	| "none"
	| "local-only"
	| "inherited-only"
	| "local-and-inherited";

export interface RemovePluginActivationOptions {
	disableInheritedLicenses?: boolean;
}

export interface RemovePluginActivationResult {
	removalKind: PluginActivationRemovalKind;
	nextState: EffectiveLicenseState;
}

export interface LicenseCapablePluginLike {
	manifest?: {
		id?: string;
	};
	settings?: {
		license?: LicenseInfo;
		licenseState?: LicenseStore;
		allowInheritedLicenses?: boolean;
	};
	getLicensedProductId?: () => LicensedProduct;
	getLocalLicenses?: () => LicenseInfo[];
	getEffectiveLicenseState?: () => EffectiveLicenseState;
}

export function getPluginLicensedProduct(
	plugin: LicenseCapablePluginLike | null | undefined
): LicensedProduct {
	return plugin?.getLicensedProductId?.() ?? getProductFromPluginId(plugin?.manifest?.id);
}

export function getPluginLocalLicenses(
	plugin: LicenseCapablePluginLike | null | undefined
): LicenseInfo[] {
	if (!plugin) {
		return [];
	}

	if (typeof plugin.getLocalLicenses === "function") {
		return plugin.getLocalLicenses();
	}

	return normalizeLicenseStore(plugin.settings?.license, plugin.settings?.licenseState)
		.localLicenses;
}

export function getPluginEffectiveLicenseState(
	plugin: LicenseCapablePluginLike | null | undefined
): EffectiveLicenseState {
	if (plugin?.getEffectiveLicenseState) {
		return plugin.getEffectiveLicenseState();
	}

	return resolveEffectiveLicenseState({
		product: getPluginLicensedProduct(plugin),
		localLicenses: getPluginLocalLicenses(plugin),
	});
}

export function syncPluginLicenseSettings(
	plugin: LicenseCapablePluginLike | null | undefined
): void {
	if (!plugin?.settings) {
		return;
	}

	const normalizedStore = normalizeLicenseStore(
		plugin.settings.license,
		plugin.settings.licenseState
	);
	plugin.settings.licenseState = normalizedStore;
	plugin.settings.license = getLegacyPrimaryLicense(normalizedStore.localLicenses);
}

export function upsertPluginLocalLicense(
	plugin: LicenseCapablePluginLike | null | undefined,
	license: LicenseInfo
): void {
	if (!plugin?.settings) {
		return;
	}

	const existingLicenses = getPluginLocalLicenses(plugin);
	const nextLicenses = existingLicenses.filter(
		(existingLicense) => existingLicense.activationCode !== license.activationCode
	);
	nextLicenses.unshift(license);

	plugin.settings.licenseState = {
		localLicenses: nextLicenses,
		updatedAt: new Date().toISOString(),
	};
	syncPluginLicenseSettings(plugin);
}

export function markPluginLocalLicensesCleared(
	plugin: LicenseCapablePluginLike | null | undefined
): void {
	if (!plugin?.settings) {
		return;
	}

	const clearedAt = new Date().toISOString();
	plugin.settings.license = {
		...DEFAULT_LICENSE_INFO,
	};
	plugin.settings.licenseState = {
		localLicenses: [],
		updatedAt: clearedAt,
		localLicensesClearedAt: clearedAt,
	};
	syncPluginLicenseSettings(plugin);
}

export function getPluginActivationRemovalKind(
	plugin: LicenseCapablePluginLike | null | undefined,
	options?: RemovePluginActivationOptions
): PluginActivationRemovalKind {
	const hasLocalLicenses = getPluginLocalLicenses(plugin).length > 0;
	const effectiveState = getPluginEffectiveLicenseState(plugin);
	const canDisableInheritedLicenses = Boolean(
		options?.disableInheritedLicenses &&
			plugin?.settings &&
			typeof plugin.settings.allowInheritedLicenses === "boolean" &&
			plugin.settings.allowInheritedLicenses !== false &&
			effectiveState.inheritedLicenses.length > 0
	);

	if (hasLocalLicenses && canDisableInheritedLicenses) {
		return "local-and-inherited";
	}

	if (hasLocalLicenses) {
		return "local-only";
	}

	if (canDisableInheritedLicenses) {
		return "inherited-only";
	}

	return "none";
}

export function removePluginActivation(
	plugin: LicenseCapablePluginLike | null | undefined,
	options?: RemovePluginActivationOptions
): RemovePluginActivationResult {
	const removalKind = getPluginActivationRemovalKind(plugin, options);

	if (removalKind === "none") {
		return {
			removalKind,
			nextState: getPluginEffectiveLicenseState(plugin),
		};
	}

	if (
		(removalKind === "inherited-only" || removalKind === "local-and-inherited") &&
		plugin?.settings &&
		typeof plugin.settings.allowInheritedLicenses === "boolean"
	) {
		plugin.settings.allowInheritedLicenses = false;
	}

	if (removalKind === "local-only" || removalKind === "local-and-inherited") {
		clearPluginLocalLicenses(plugin);
	}

	return {
		removalKind,
		nextState: getPluginEffectiveLicenseState(plugin),
	};
}

export function clearPluginLocalLicenses(
	plugin: LicenseCapablePluginLike | null | undefined
): void {
	markPluginLocalLicensesCleared(plugin);
}
