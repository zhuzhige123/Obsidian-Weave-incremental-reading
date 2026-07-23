import { type App, normalizePath } from "obsidian";
import { isLinkableVaultNotePath } from "./IRLinkedNotePolicy";

/**
 * Resolve vault note paths linked out from a carrier note via Obsidian's
 * metadata cache (no vault-wide body scan, no IR persistence).
 */
export function resolveDerivedOutlinkNotePaths(
	app: App,
	sourceFilePath?: string | null,
): string[] {
	const sourcePath = normalizePath(String(sourceFilePath || "").trim());
	if (!sourcePath) {
		return [];
	}

	const resolvedLinks = app.metadataCache.resolvedLinks?.[sourcePath];
	if (!resolvedLinks || typeof resolvedLinks !== "object") {
		return [];
	}

	const seen = new Set<string>();
	const paths: string[] = [];
	for (const rawTarget of Object.keys(resolvedLinks)) {
		const targetPath = normalizePath(String(rawTarget || "").trim());
		if (!targetPath || targetPath === sourcePath) {
			continue;
		}
		if (!isLinkableVaultNotePath(targetPath)) {
			continue;
		}
		if (seen.has(targetPath)) {
			continue;
		}
		seen.add(targetPath);
		paths.push(targetPath);
	}

	paths.sort((a, b) => a.localeCompare(b));
	return paths;
}

export function countDerivedOutlinkNotes(
	app: App,
	sourceFilePath?: string | null,
): number {
	return resolveDerivedOutlinkNotePaths(app, sourceFilePath).length;
}

/** Fast existence check for list badges — skips sorting. */
export function hasDerivedOutlinkNotes(
	app: App,
	sourceFilePath?: string | null,
): boolean {
	const sourcePath = normalizePath(String(sourceFilePath || "").trim());
	if (!sourcePath) {
		return false;
	}

	const resolvedLinks = app.metadataCache.resolvedLinks?.[sourcePath];
	if (!resolvedLinks || typeof resolvedLinks !== "object") {
		return false;
	}

	for (const rawTarget of Object.keys(resolvedLinks)) {
		const targetPath = normalizePath(String(rawTarget || "").trim());
		if (
			targetPath &&
			targetPath !== sourcePath &&
			isLinkableVaultNotePath(targetPath)
		) {
			return true;
		}
	}

	return false;
}
