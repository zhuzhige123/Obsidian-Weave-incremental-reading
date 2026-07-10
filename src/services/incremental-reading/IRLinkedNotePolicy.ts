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
