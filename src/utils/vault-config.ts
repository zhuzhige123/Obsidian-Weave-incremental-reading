import type { App } from "obsidian";

type VaultConfigLike = {
	getConfig?: (key: string) => unknown;
	config?: Record<string, unknown>;
};

export function readVaultConfigValue(app: App, key: string): unknown {
	try {
		const vault = app.vault as VaultConfigLike;
		const getterValue = vault.getConfig?.(key);
		if (getterValue !== undefined) {
			return getterValue;
		}
		return vault.config?.[key];
	} catch {
		return undefined;
	}
}
