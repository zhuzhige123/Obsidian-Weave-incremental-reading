import { type App, TFile, normalizePath } from "obsidian";
import { EpubLinkService } from "../epub-integration/EpubLinkService";
import {
	isObsidianProtocolUrl,
	resolveResumeLinkForOpen,
} from "../obsidian/obsidian-open-protocol-url";
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

function pushUniquePath(paths: string[], seen: Set<string>, raw: string): void {
	const normalized = normalizePath(String(raw || "").trim());
	if (!normalized || seen.has(normalized)) {
		return;
	}
	seen.add(normalized);
	paths.push(normalized);
}

function pushPathAndBasename(
	paths: string[],
	seen: Set<string>,
	raw: string,
): void {
	const normalized = normalizePath(String(raw || "").trim());
	if (!normalized) {
		return;
	}
	pushUniquePath(paths, seen, normalized);
	const slash = normalized.lastIndexOf("/");
	if (slash >= 0 && slash < normalized.length - 1) {
		pushUniquePath(paths, seen, normalized.slice(slash + 1));
	}
}

/**
 * Pull vault path from resumeLink (wikilink / markdown / EPUB protocol).
 * Aligns with open-path peeling, but accepts protocol links that only carry
 * `file=` (EpubLinkService.parseProtocolParams requires cfi/tocHref).
 */
export function extractVaultPathCandidateFromResumeLink(raw: string): string {
	const trimmed = String(raw || "").trim();
	if (!trimmed || isHttpUrl(trimmed)) {
		return "";
	}

	const epubPath = EpubLinkService.extractFilePathFromEpubLinkMarkup(trimmed);
	if (epubPath) {
		return normalizePath(epubPath);
	}

	const openable = resolveResumeLinkForOpen(trimmed);
	if (openable) {
		if (isObsidianProtocolUrl(openable)) {
			const fromQuery = extractFileParamFromObsidianHref(openable);
			if (fromQuery) {
				return fromQuery;
			}
		} else if (!isHttpUrl(openable)) {
			const filePart = openable.split("#")[0].trim();
			if (filePart) {
				return normalizePath(filePart);
			}
		}
	}

	const protocolHref = extractObsidianProtocolHrefFromMarkup(trimmed);
	if (protocolHref) {
		const fromQuery = extractFileParamFromObsidianHref(protocolHref);
		if (fromQuery) {
			return fromQuery;
		}
	}

	return "";
}

function extractObsidianProtocolHrefFromMarkup(markup: string): string {
	const trimmed = String(markup || "").trim();
	if (!trimmed) {
		return "";
	}
	if (isObsidianProtocolUrl(trimmed)) {
		return trimmed;
	}
	const start = trimmed.search(/obsidian:\/\//i);
	if (start < 0) {
		return "";
	}
	const openParenIndex = start > 0 ? start - 1 : -1;
	if (openParenIndex >= 0 && trimmed[openParenIndex] === "(") {
		const closeParenIndex = trimmed.lastIndexOf(")");
		if (closeParenIndex > openParenIndex) {
			return trimmed.slice(openParenIndex + 1, closeParenIndex).trim();
		}
	}
	return trimmed.slice(start).trim();
}

function extractFileParamFromObsidianHref(href: string): string {
	const normalized = String(href || "").trim();
	if (!normalized) {
		return "";
	}
	try {
		const file = new URL(normalized).searchParams.get("file");
		if (file?.trim()) {
			return normalizePath(file.trim());
		}
	} catch {
		const match = normalized.match(/[?&]file=([^&]*)/i);
		if (match?.[1]) {
			try {
				return normalizePath(decodeURIComponent(match[1]));
			} catch {
				return normalizePath(match[1]);
			}
		}
	}
	return "";
}

/**
 * Path candidates aligned with open/navigation soft resolution:
 * stored sourceFile, its basename (moved-file soft hit), and resumeLink file part.
 * Does not run rename recovery (chunk_id vault scan).
 */
export function collectScheduleItemVaultSourcePathCandidates(
	item: ScheduleItem,
): string[] {
	const paths: string[] = [];
	const seen = new Set<string>();

	pushPathAndBasename(paths, seen, String(item.sourceFile || ""));
	pushPathAndBasename(
		paths,
		seen,
		extractVaultPathCandidateFromResumeLink(String(item.resumeLink || "")),
	);

	return paths;
}

/**
 * Soft vault presence: exact path, then metadataCache linkpath (same as open).
 */
export function resolveVaultSourcePathIfPresent(
	app: App,
	path: string,
): string | null {
	const normalized = normalizePath(String(path || "").trim());
	if (!normalized) {
		return null;
	}

	const direct = app.vault.getAbstractFileByPath(normalized);
	if (direct instanceof TFile) {
		return normalizePath(direct.path);
	}

	const dest = app.metadataCache.getFirstLinkpathDest?.(normalized, "");
	if (dest instanceof TFile) {
		return normalizePath(dest.path);
	}

	return null;
}

export function isVaultSourcePathPresent(app: App, path: string): boolean {
	return resolveVaultSourcePathIfPresent(app, path) !== null;
}

function lookupPathPresence(
	app: App,
	path: string,
	pathExistsCache?: Map<string, boolean>,
): boolean {
	if (pathExistsCache?.has(path)) {
		return pathExistsCache.get(path) === true;
	}

	const resolved = resolveVaultSourcePathIfPresent(app, path);
	const exists = resolved !== null;
	pathExistsCache?.set(path, exists);
	if (resolved && resolved !== path) {
		pathExistsCache?.set(resolved, true);
	}
	return exists;
}

/**
 * Lightweight list-badge check aligned with open soft resolution.
 * Does not run rename recovery (chunk_id scan).
 * Optional pathExistsCache reuses results for the same vault path candidate.
 */
export function evaluateScheduleItemSourceMissing(
	app: App,
	item: ScheduleItem,
	pathExistsCache?: Map<string, boolean>,
): ScheduleItemSourceExistenceResult {
	if (!shouldCheckScheduleItemSourceExistence(app, item)) {
		return { checkable: false, missing: false, path: "" };
	}

	const primaryPath = resolveScheduleItemVaultSourcePath(item);
	const candidates = collectScheduleItemVaultSourcePathCandidates(item);
	if (candidates.length === 0) {
		return { checkable: true, missing: true, path: "" };
	}

	for (const candidate of candidates) {
		if (lookupPathPresence(app, candidate, pathExistsCache)) {
			return {
				checkable: true,
				missing: false,
				path: primaryPath || candidate,
			};
		}
	}

	return {
		checkable: true,
		missing: true,
		path: primaryPath || candidates[0] || "",
	};
}
