import { normalizeReadingPointTags } from "../IRPointTagService";

/**
 * Commit unconfirmed tag-input draft text into the chip list.
 * Save / close flows must call this — otherwise typing without Enter is silently dropped.
 */
export function commitReadingPointTagDraft(
	tags: string[],
	draft: string,
): string[] {
	const [normalized] = normalizeReadingPointTags([draft]);
	if (!normalized) {
		return Array.isArray(tags) ? [...tags] : [];
	}

	const current = Array.isArray(tags) ? [...tags] : [];
	if (current.some((tag) => tag.toLowerCase() === normalized.toLowerCase())) {
		return current;
	}
	return [...current, normalized];
}

export function hasReadingPointTagDraft(draft: string): boolean {
	return Boolean(normalizeReadingPointTags([draft])[0]);
}
