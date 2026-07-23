import { type App, TFile, normalizePath } from "obsidian";
import { isHttpUrl } from "../obsidian/obsidian-open-web-url";
import type { ScheduleItem } from "./IRCalendarScheduleItem";
import { resolveScheduleItemTypeBadge } from "./IRCalendarScheduleItemTypeBadge";
import { resolveScheduleItemWebUrl } from "./ir-web-reading-point";

export interface ScheduleItemSourceExistenceResult {
	checkable: boolean;
	missing: boolean;
	path: string;
}

/**
 * Vault-backed reading points (md / canvas / pdf / epub / chunk) should be
 * checked. Web/link targets have no vault source file.
 */
export function shouldCheckScheduleItemSourceExistence(
	app: App,
	item: ScheduleItem,
): boolean {
	if (resolveScheduleItemWebUrl(app, item)) {
		return false;
	}

	const resumeLink = String(item.resumeLink || "").trim();
	if (isHttpUrl(resumeLink)) {
		return false;
	}

	if (resolveScheduleItemTypeBadge(app, item) === "link") {
		return false;
	}

	return true;
}

export function resolveScheduleItemVaultSourcePath(item: ScheduleItem): string {
	const raw = String(item.sourceFile || "").trim();
	if (!raw) {
		return "";
	}
	return normalizePath(raw);
}

export function isVaultSourcePathPresent(app: App, path: string): boolean {
	const normalized = normalizePath(String(path || "").trim());
	if (!normalized) {
		return false;
	}
	return app.vault.getAbstractFileByPath(normalized) instanceof TFile;
}

/**
 * Lightweight list-badge check. Does not run rename recovery (chunk_id scan).
 * Optional pathExistsCache reuses results for the same vault path.
 */
export function evaluateScheduleItemSourceMissing(
	app: App,
	item: ScheduleItem,
	pathExistsCache?: Map<string, boolean>,
): ScheduleItemSourceExistenceResult {
	if (!shouldCheckScheduleItemSourceExistence(app, item)) {
		return { checkable: false, missing: false, path: "" };
	}

	const path = resolveScheduleItemVaultSourcePath(item);
	if (!path) {
		return { checkable: true, missing: true, path: "" };
	}

	let exists: boolean;
	if (pathExistsCache?.has(path)) {
		exists = pathExistsCache.get(path) === true;
	} else {
		exists = isVaultSourcePathPresent(app, path);
		pathExistsCache?.set(path, exists);
	}

	return { checkable: true, missing: !exists, path };
}
