import { normalizePath } from "obsidian";
import {
	supportsPointLinkedNotesForScheduleItem,
	type PointLinkedNotesScheduleCarrier,
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

export function getVisibleAssociatedNotePath(material?: AssociatedNoteCarrier | null): string {
	return (
		normalizeAssociatedNotePath(material?.primaryAssociatedNotePath) ||
		normalizeAssociatedNotePath(material?.associatedNotePath) ||
		(Array.isArray(material?.associatedNotePaths)
			? material.associatedNotePaths.map((path) => normalizeAssociatedNotePath(path)).find(Boolean) || ""
			: "")
	);
}

export function getPointAssociatedNotePath(material?: AssociatedNoteCarrier | null): string {
	const normalizedPath = getVisibleAssociatedNotePath(material);
	if (!normalizedPath) return "";
	return material?.associatedNoteScope === "material" ? "" : normalizedPath;
}

export function canUsePointLinkedNotes(material?: AssociatedNoteCarrier | null): boolean {
	return supportsPointLinkedNotesForScheduleItem(material);
}

export function hasVisibleAssociatedNote(material?: AssociatedNoteCarrier | null): boolean {
	if (!canUsePointLinkedNotes(material)) {
		return false;
	}
	return getVisibleAssociatedNotePath(material).length > 0;
}

export function hasPointAssociatedNote(material?: AssociatedNoteCarrier | null): boolean {
	if (!canUsePointLinkedNotes(material)) {
		return false;
	}
	return getPointAssociatedNotePath(material).length > 0;
}
