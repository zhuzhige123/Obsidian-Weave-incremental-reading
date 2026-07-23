/**
 * Migrate IR vault data root from the shared Weave-series layout
 * (`weave/incremental-reading` or `{parent}/weave/incremental-reading`)
 * to the standalone parent folder model
 * (`weave Incremental reading` / user-chosen root, with points/ etc. directly under it).
 */
import { type App, normalizePath } from "obsidian";
import {
	LEGACY_IR_DATA_ROOT,
	getLegacyIRDataRoot,
	getReadableWeaveRoot,
	normalizeWeaveParentFolder,
} from "../../config/paths";
import { logger } from "../../utils/logger";

export type IRDataRootMigrationHost = {
	app: App;
	settings: {
		weaveParentFolder: string;
	};
	saveSettings: () => Promise<void>;
};

export type IRDataRootMigrationResult = {
	renamedDefaultRoot: boolean;
	reboundCustomParent: boolean;
	from?: string;
	to?: string;
};

async function pathExists(app: App, path: string): Promise<boolean> {
	try {
		return await app.vault.adapter.exists(normalizePath(path));
	} catch {
		return false;
	}
}

async function hasIRPayload(app: App, root: string): Promise<boolean> {
	const normalized = normalizePath(root);
	const markers = [
		`${normalized}/points`,
		`${normalized}/registry`,
		`${normalized}/materials`,
		`${normalized}/topics.json`,
		`${normalized}/blocks.json`,
		`${normalized}/schema-version.json`,
	];
	for (const marker of markers) {
		if (await pathExists(app, marker)) return true;
	}
	return false;
}

/**
 * One-shot vault/settings migration for the IR data parent folder.
 * Safe to call on every startup; no-ops when already on the new layout.
 */
export async function migrateIRDataRootIfNeeded(
	host: IRDataRootMigrationHost,
): Promise<IRDataRootMigrationResult> {
	const result: IRDataRootMigrationResult = {
		renamedDefaultRoot: false,
		reboundCustomParent: false,
	};

	const parent = normalizeWeaveParentFolder(host.settings.weaveParentFolder);
	const currentRoot = normalizePath(getReadableWeaveRoot(parent));

	// Case A: default root — rename weave/incremental-reading → weave Incremental reading
	if (!parent) {
		const legacyRoot = LEGACY_IR_DATA_ROOT;
		const legacyExists = await pathExists(host.app, legacyRoot);
		const currentExists = await pathExists(host.app, currentRoot);
		const legacyHasData = legacyExists && (await hasIRPayload(host.app, legacyRoot));
		const currentHasData =
			currentExists && (await hasIRPayload(host.app, currentRoot));

		if (legacyHasData && !currentHasData) {
			try {
				if (currentExists) {
					// Target folder exists but empty of IR payload — prefer rename into place fails;
					// leave dual-read to IRStorageService.
					logger.info(
						`[IRDataRootMigration] skip rename: target exists without payload (${currentRoot})`,
					);
				} else {
					await host.app.vault.adapter.rename(legacyRoot, currentRoot);
					result.renamedDefaultRoot = true;
					result.from = legacyRoot;
					result.to = currentRoot;
					logger.info(
						`[IRDataRootMigration] renamed IR data root: ${legacyRoot} → ${currentRoot}`,
					);
				}
			} catch (error) {
				logger.warn(
					`[IRDataRootMigration] rename failed (${legacyRoot} → ${currentRoot})`,
					error,
				);
			}
		}
		return result;
	}

	// Case B: custom parent used old "prefix above weave" semantics
	const legacyUnderParent = normalizePath(getLegacyIRDataRoot(parent));
	if (
		legacyUnderParent === currentRoot ||
		parent === LEGACY_IR_DATA_ROOT ||
		parent.endsWith(`/${LEGACY_IR_DATA_ROOT}`)
	) {
		return result;
	}

	const legacyHasData =
		(await pathExists(host.app, legacyUnderParent)) &&
		(await hasIRPayload(host.app, legacyUnderParent));
	const currentHasData =
		(await pathExists(host.app, currentRoot)) &&
		(await hasIRPayload(host.app, currentRoot));

	if (legacyHasData && !currentHasData) {
		host.settings.weaveParentFolder = legacyUnderParent;
		await host.saveSettings();
		result.reboundCustomParent = true;
		result.from = parent;
		result.to = legacyUnderParent;
		logger.info(
			`[IRDataRootMigration] rebound custom parent to legacy IR root: ${parent} → ${legacyUnderParent}`,
		);
	}

	return result;
}
