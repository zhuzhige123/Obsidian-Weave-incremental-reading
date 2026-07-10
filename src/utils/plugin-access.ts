import type { App } from "obsidian";
import type { LicenseInfo, LicenseStore } from "../types/license";
import {
	cloneLicenseAsInherited,
	dedupeLicenses,
	normalizeLicenseStore,
} from "./license-state";
import { WEAVE_MAIN_PLUGIN_ID } from "./weave-reader-access";

export type PluginLookupApp = App;

type CompatiblePlugin = {
	manifest?: {
		id?: string;
	};
	settings?: {
		license?: Partial<LicenseInfo>;
		licenseState?: Partial<LicenseStore>;
	};
	getLocalLicenses?: () => LicenseInfo[];
	getEffectiveLicenseState?: () => { activeLicenses?: LicenseInfo[] };
};

function getPluginById(
	app: PluginLookupApp | undefined,
	pluginId: string,
): CompatiblePlugin | null {
	if (!app) {
		return null;
	}

	const plugin = app.plugins.getPlugin(pluginId);
	return plugin && typeof plugin === "object"
		? (plugin as CompatiblePlugin)
		: null;
}

function getLegacyWeavePlugin(
	app: PluginLookupApp | undefined,
): CompatiblePlugin | null {
	return getPluginById(app, WEAVE_MAIN_PLUGIN_ID);
}

function getPluginLocalLicenses(plugin: CompatiblePlugin): LicenseInfo[] {
	if (typeof plugin.getLocalLicenses === "function") {
		return plugin.getLocalLicenses();
	}

	return normalizeLicenseStore(
		plugin.settings?.license,
		plugin.settings?.licenseState,
	).localLicenses;
}

function getPluginActiveLicenses(plugin: CompatiblePlugin): LicenseInfo[] {
	if (typeof plugin.getEffectiveLicenseState === "function") {
		return plugin.getEffectiveLicenseState().activeLicenses ?? [];
	}

	return getPluginLocalLicenses(plugin);
}

export function getInheritedLicensesFromLegacyWeave(
	app: PluginLookupApp | undefined,
): LicenseInfo[] {
	const legacyPlugin = getLegacyWeavePlugin(app);
	if (!legacyPlugin) {
		return [];
	}

	const sourcePluginId =
		String(legacyPlugin.manifest?.id || WEAVE_MAIN_PLUGIN_ID).trim() ||
		WEAVE_MAIN_PLUGIN_ID;

	return dedupeLicenses(
		getPluginActiveLicenses(legacyPlugin).map((license) =>
			cloneLicenseAsInherited(license, sourcePluginId),
		),
	);
}
