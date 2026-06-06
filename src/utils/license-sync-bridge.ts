import type { Plugin } from "obsidian";
import type { EffectiveLicenseState } from "../types/license";
import { WEAVE_MAIN_PLUGIN_ID } from "./weave-reader-access";

/**
 * @see docs/LICENSE_MULTI_PLUGIN_AUDIT.md
 * @see weave-epub-reader/docs/LICENSE_MULTI_PLUGIN.md
 */
export const WEAVE_LICENSE_CHANGED_WORKSPACE_EVENT = "Weave:license-changed";

export const WEAVE_LICENSE_CHANGED_WINDOW_EVENT = WEAVE_LICENSE_CHANGED_WORKSPACE_EVENT;

type LicenseChangeEmitterApp = {
	workspace?: {
		trigger?: (name: string, ...args: unknown[]) => void;
	};
};

export function emitWeaveLicenseChanged(app: LicenseChangeEmitterApp): void {
	app.workspace?.trigger?.(WEAVE_LICENSE_CHANGED_WORKSPACE_EVENT);
	if (typeof window !== "undefined") {
		window.dispatchEvent(new CustomEvent(WEAVE_LICENSE_CHANGED_WINDOW_EVENT));
	}
}

const LICENSE_SYNC_DEBOUNCE_MS = 120;

export interface LicenseSyncCapablePlugin {
	app?: Plugin["app"];
	settings?: {
		allowInheritedLicenses?: boolean;
	};
	getEffectiveLicenseState(): EffectiveLicenseState;
	refreshPremiumState(): Promise<void>;
}

export interface LicenseSyncBridgeOptions {
	debounceMs?: number;
}

function buildLicenseSyncFingerprint(plugin: LicenseSyncCapablePlugin): string {
	const state = plugin.getEffectiveLicenseState();
	const codes = (licenses: typeof state.localLicenses) =>
		licenses
			.map((license) => String(license.activationCode || "").trim())
			.filter(Boolean)
			.sort()
			.join("|");

	return JSON.stringify({
		allowInherited: plugin.settings?.allowInheritedLicenses !== false,
		local: codes(state.localLicenses),
		inherited: codes(state.inheritedLicenses),
		premium: state.isPremiumActive,
		weaveInstalled: Boolean(
			(plugin.app as { plugins?: { getPlugin?: (id: string) => unknown } } | undefined)?.plugins
				?.getPlugin?.(WEAVE_MAIN_PLUGIN_ID)
		),
	});
}

export function registerLicenseSyncBridge(
	plugin: Plugin,
	target: LicenseSyncCapablePlugin,
	options?: LicenseSyncBridgeOptions
): () => void {
	const debounceMs = options?.debounceMs ?? LICENSE_SYNC_DEBOUNCE_MS;
	let lastFingerprint = buildLicenseSyncFingerprint(target);
	let pendingTimer: number | null = null;
	let syncInFlight: Promise<void> | null = null;

	const runSync = async (force = false): Promise<void> => {
		const nextFingerprint = buildLicenseSyncFingerprint(target);
		if (!force && nextFingerprint === lastFingerprint) {
			return;
		}

		if (syncInFlight) {
			await syncInFlight;
			const fingerprintAfterWait = buildLicenseSyncFingerprint(target);
			if (!force && fingerprintAfterWait === lastFingerprint) {
				return;
			}
		}

		lastFingerprint = nextFingerprint;
		syncInFlight = target.refreshPremiumState().finally(() => {
			syncInFlight = null;
			lastFingerprint = buildLicenseSyncFingerprint(target);
		});
		await syncInFlight;
	};

	const scheduleSync = (force = false) => {
		if (typeof window === "undefined") {
			void runSync(force);
			return;
		}

		if (pendingTimer !== null) {
			window.clearTimeout(pendingTimer);
		}

		pendingTimer = window.setTimeout(() => {
			pendingTimer = null;
			void runSync(force);
		}, debounceMs);
	};

	const handleLicenseChanged = () => {
		scheduleSync(true);
	};

	const handlePassiveSync = () => {
		scheduleSync(false);
	};

	plugin.registerEvent(
		(plugin.app.workspace as any).on(WEAVE_LICENSE_CHANGED_WORKSPACE_EVENT, handleLicenseChanged)
	);
	plugin.registerDomEvent(window, WEAVE_LICENSE_CHANGED_WINDOW_EVENT as any, handleLicenseChanged);
	plugin.registerDomEvent(window, "focus", handlePassiveSync);
	plugin.registerDomEvent(document, "visibilitychange", () => {
		if (!document.hidden) {
			handlePassiveSync();
		}
	});
	plugin.registerEvent(plugin.app.workspace.on("layout-change", handlePassiveSync));

	if (typeof plugin.app.workspace.onLayoutReady === "function") {
		plugin.app.workspace.onLayoutReady(() => {
			scheduleSync(true);
		});
	} else {
		scheduleSync(true);
	}

	return () => {
		if (pendingTimer !== null && typeof window !== "undefined") {
			window.clearTimeout(pendingTimer);
			pendingTimer = null;
		}
	};
}

export { buildLicenseSyncFingerprint };
