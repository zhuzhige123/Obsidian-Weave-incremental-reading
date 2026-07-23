import { normalizePath } from "obsidian";
import {
	type AssociatedNoteRelationMode,
	type PointLinkedNotesScheduleCarrier,
	resolveAssociatedNoteRelationMode,
	supportsPointLinkedNotesForScheduleItem,
} from "./IRLinkedNotePolicy";

export interface AssociatedNoteCarrier extends PointLinkedNotesScheduleCarrier {
	primaryAssociatedNotePath?: string;
	associatedNotePath?: string;
	associatedNotePaths?: string[];
	associatedNoteScope?: "point" | "material";
	sourceType?: string;
}

export function normalizeAssociatedNotePath(path?: string | null): string {
	return path ? normalizePath(path) : "";
}

export function getVisibleAssociatedNotePath(
	material?: AssociatedNoteCarrier | null,
): string {
	return (
		normalizeAssociatedNotePath(material?.primaryAssociatedNotePath) ||
		normalizeAssociatedNotePath(material?.associatedNotePath) ||
		(Array.isArray(material?.associatedNotePaths)
			? material.associatedNotePaths
					.map((path) => normalizeAssociatedNotePath(path))
					.find(Boolean) || ""
			: "")
	);
}

export function getPointAssociatedNotePath(
	material?: AssociatedNoteCarrier | null,
): string {
	const normalizedPath = getVisibleAssociatedNotePath(material);
	if (!normalizedPath) return "";
	return material?.associatedNoteScope === "material" ? "" : normalizedPath;
}

/** True when curated linked-note writes are allowed (PDF/EPUB). */
export function canUsePointLinkedNotes(
	material?: AssociatedNoteCarrier | null,
): boolean {
	return supportsPointLinkedNotesForScheduleItem(material);
}

export {
	resolveAssociatedNoteRelationMode as getAssociatedNoteRelationMode,
	type AssociatedNoteRelationMode,
};

/**
 * Calendar / context-menu offer for associated notes.
 *
 * - curated: PDF/EPUB manual linked notes
 * - derived: MD / web carrier outbound links (read-only)
 * Premium preview must never surface the entry on unavailable types.
 */
export type AssociatedNoteMenuOffer =
	| { kind: "hidden" }
	| { kind: "premium-gate" }
	| { kind: "manage-curated" }
	| { kind: "manage-derived" };

export function resolveAssociatedNoteMenuOffer(
	material: AssociatedNoteCarrier | null | undefined,
	access: {
		canUseFeature: boolean;
		shouldShowFeatureEntry: boolean;
	},
): AssociatedNoteMenuOffer {
	const mode = resolveAssociatedNoteRelationMode(material);
	if (mode === "unavailable") {
		return { kind: "hidden" };
	}
	if (access.canUseFeature) {
		return mode === "curated"
			? { kind: "manage-curated" }
			: { kind: "manage-derived" };
	}
	if (access.shouldShowFeatureEntry) {
		return { kind: "premium-gate" };
	}
	return { kind: "hidden" };
}

export function hasVisibleAssociatedNote(
	material?: AssociatedNoteCarrier | null,
): boolean {
	if (!canUsePointLinkedNotes(material)) {
		return false;
	}
	return getVisibleAssociatedNotePath(material).length > 0;
}

export function hasPointAssociatedNote(
	material?: AssociatedNoteCarrier | null,
): boolean {
	if (!canUsePointLinkedNotes(material)) {
		return false;
	}
	return getPointAssociatedNotePath(material).length > 0;
}
