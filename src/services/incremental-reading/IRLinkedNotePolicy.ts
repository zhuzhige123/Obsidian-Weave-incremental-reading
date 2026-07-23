import { App, TFile, normalizePath } from "obsidian";
import { isEpubBookmarkTaskId } from "./IREpubBookmarkTaskService";
import { isPdfBookmarkTaskId } from "./IRPdfBookmarkTaskService";

const PDF_EPUB_SOURCE_TYPES = new Set([
	"pdf",
	"epub",
	"pdf-bookmark",
	"epub-bookmark",
]);

export interface PointLinkedNotesScheduleCarrier {
	id?: string;
	sourceType?: string | null;
	sourceFile?: string | null;
	/** Used to detect web reading points when the MD carrier path is missing. */
	resumeLink?: string | null;
}

function normalizeSourceType(sourceType?: string | null): string {
	return String(sourceType || "")
		.trim()
		.toLowerCase();
}

export function supportsPointLinkedNotes(sourceType?: string | null): boolean {
	return PDF_EPUB_SOURCE_TYPES.has(normalizeSourceType(sourceType));
}

export function supportsPointLinkedNotesForSourcePath(
	sourcePath?: string | null,
): boolean {
	const normalized = normalizePath(
		String(sourcePath || "").trim(),
	).toLowerCase();
	if (!normalized) {
		return false;
	}
	return normalized.endsWith(".pdf") || normalized.endsWith(".epub");
}

export function supportsPointLinkedNotesForScheduleItem(
	item?: PointLinkedNotesScheduleCarrier | null,
): boolean {
	if (!item) {
		return false;
	}

	if (supportsPointLinkedNotes(item.sourceType)) {
		return true;
	}

	const id = String(item.id || "").trim();
	if (isPdfBookmarkTaskId(id) || isEpubBookmarkTaskId(id)) {
		return true;
	}

	return supportsPointLinkedNotesForSourcePath(item.sourceFile);
}

/** How associated notes are resolved for a reading point. */
export type AssociatedNoteRelationMode =
	| "curated"
	| "derived-outlinks"
	| "unavailable";

/**
 * Vault note carriers (Markdown / Canvas) derive related notes from Obsidian
 * outbound links instead of writing curated `linkedNotePaths`.
 */
export function isVaultNoteCarrierSourcePath(
	sourcePath?: string | null,
): boolean {
	const normalized = normalizePath(
		String(sourcePath || "").trim(),
	).toLowerCase();
	if (!normalized) {
		return false;
	}
	return (
		normalized.endsWith(".md") ||
		normalized.endsWith(".markdown") ||
		normalized.endsWith(".canvas")
	);
}

export function supportsDerivedOutlinkNotesForScheduleItem(
	item?: PointLinkedNotesScheduleCarrier | null,
): boolean {
	if (!item) {
		return false;
	}
	// Curated PDF/EPUB always wins over derived outlinks.
	if (supportsPointLinkedNotesForScheduleItem(item)) {
		return false;
	}

	// Vault note carriers (including deleted paths that still look like notes).
	if (isVaultNoteCarrierSourcePath(item.sourceFile)) {
		return true;
	}

	// Web reading point with missing carrier path: still offer recover via URL.
	const resumeLink = String(item.resumeLink || "")
		.trim()
		.toLowerCase();
	return resumeLink.startsWith("http://") || resumeLink.startsWith("https://");
}

export function resolveAssociatedNoteRelationMode(
	item?: PointLinkedNotesScheduleCarrier | null,
): AssociatedNoteRelationMode {
	if (supportsPointLinkedNotesForScheduleItem(item)) {
		return "curated";
	}
	if (supportsDerivedOutlinkNotesForScheduleItem(item)) {
		return "derived-outlinks";
	}
	return "unavailable";
}

export function resolveExternalBookmarkTaskKind(
	item?: PointLinkedNotesScheduleCarrier | null,
): "pdf" | "epub" | null {
	if (!item) {
		return null;
	}

	const id = String(item.id || "").trim();
	if (isPdfBookmarkTaskId(id)) {
		return "pdf";
	}
	if (isEpubBookmarkTaskId(id)) {
		return "epub";
	}

	const sourceType = normalizeSourceType(item.sourceType);
	if (sourceType === "pdf" || sourceType === "pdf-bookmark") {
		return "pdf";
	}
	if (sourceType === "epub" || sourceType === "epub-bookmark") {
		return "epub";
	}

	const sourcePath = normalizePath(
		String(item.sourceFile || "").trim(),
	).toLowerCase();
	if (sourcePath.endsWith(".pdf")) {
		return "pdf";
	}
	if (sourcePath.endsWith(".epub")) {
		return "epub";
	}

	return null;
}

function hasExplicitExtension(path: string): boolean {
	return /\.[^/.]+$/i.test(path);
}

export function isLinkableVaultNotePath(
	path: string | undefined | null,
): boolean {
	const normalized = normalizePath(String(path || "").trim());
	if (!normalized) {
		return false;
	}

	const lower = normalized.toLowerCase();
	if (lower.endsWith(".canvas")) {
		return true;
	}

	if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
		return true;
	}

	// Obsidian wikilink-style paths without extension are markdown notes.
	return !hasExplicitExtension(normalized);
}

export function isLinkableVaultNoteFile(file: TFile): boolean {
	return isLinkableVaultNotePath(file.path);
}

export function listLinkableVaultNoteFiles(app: App): TFile[] {
	return app.vault.getFiles().filter((file) => isLinkableVaultNoteFile(file));
}

export function getLinkableVaultNoteIcon(
	path: string | undefined | null,
): string {
	const normalized = normalizePath(String(path || "").trim()).toLowerCase();
	if (normalized.endsWith(".canvas")) {
		return "layout-grid";
	}
	if (normalized.includes(".excalidraw.")) {
		return "pencil";
	}
	return "file-text";
}
