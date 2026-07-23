/**
 * Merge IR search tag suggestion sources:
 * - catalog: getAllKnownTags() (edit-tags modal source of truth for suggestions)
 * - material map: per-schedule-item tags used for tag: filtering
 */
export function mergeSearchAvailableTags(
	catalogTags: string[],
	materialTagsById: Record<string, string[]>,
): string[] {
	const merged = new Set<string>();
	for (const tag of catalogTags || []) {
		const normalized = String(tag || "").trim();
		if (normalized) merged.add(normalized);
	}
	for (const tags of Object.values(materialTagsById || {})) {
		for (const tag of tags || []) {
			const normalized = String(tag || "").trim();
			if (normalized) merged.add(normalized);
		}
	}
	return Array.from(merged).sort((left, right) =>
		left.localeCompare(right, "zh-CN"),
	);
}
