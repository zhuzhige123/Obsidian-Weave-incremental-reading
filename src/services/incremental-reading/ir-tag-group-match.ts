import type { IRTagGroup } from "../../types/ir-types";

export function normalizeTagGroupCandidateTags(tags: string[]): string[] {
	const ordered = new Map<string, string>();
	for (const rawTag of Array.isArray(tags) ? tags : []) {
		const normalized = String(rawTag || "")
			.trim()
			.replace(/^#/, "")
			.toLowerCase();
		if (!normalized || ordered.has(normalized)) continue;
		ordered.set(normalized, normalized);
	}
	return Array.from(ordered.values());
}

export function matchTagGroupByTags(
	groups: Pick<IRTagGroup, "id" | "matchAnyTags" | "matchPriority">[],
	tags: string[],
): string {
	const normalizedTags = normalizeTagGroupCandidateTags(tags);
	if (normalizedTags.length === 0) {
		return "default";
	}

	const normalizedSet = new Set(normalizedTags);
	const sortedGroups = [...groups]
		.filter((group) => group.id !== "default")
		.sort((a, b) => (a.matchPriority ?? 0) - (b.matchPriority ?? 0));

	for (const group of sortedGroups) {
		const groupTags = normalizeTagGroupCandidateTags(group.matchAnyTags || []);
		if (groupTags.some((tag) => normalizedSet.has(tag))) {
			return group.id;
		}
	}

	return "default";
}
