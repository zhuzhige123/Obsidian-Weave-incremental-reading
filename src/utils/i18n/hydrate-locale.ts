import type { TranslationKey } from "./types";

function isTranslationBranch(
	value: string | TranslationKey | undefined,
): value is TranslationKey {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Deep-clone a nested translation tree. */
export function cloneTranslationTree(tree: TranslationKey): TranslationKey {
	const cloned: TranslationKey = {};
	for (const [key, value] of Object.entries(tree)) {
		cloned[key] = isTranslationBranch(value)
			? cloneTranslationTree(value)
			: value;
	}
	return cloned;
}

/** Flatten a nested translation tree into dotted-key → string. */
export function flattenTranslationTree(
	tree: TranslationKey,
	prefix = "",
): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [key, value] of Object.entries(tree)) {
		const nextKey = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "string") {
			result[nextKey] = value;
		} else if (isTranslationBranch(value)) {
			Object.assign(result, flattenTranslationTree(value, nextKey));
		}
	}
	return result;
}

/**
 * Overlay flat dotted-key translations onto a cloned base tree.
 * Missing overlay keys keep the base value (graceful partial locales).
 */
export function applyFlatOverlay(
	baseTree: TranslationKey,
	flat: Record<string, string>,
): TranslationKey {
	const result = cloneTranslationTree(baseTree);

	for (const [dottedKey, text] of Object.entries(flat)) {
		if (typeof text !== "string") {
			continue;
		}
		const parts = dottedKey.split(".");
		if (parts.length === 0 || parts.some((part) => !part)) {
			continue;
		}

		let cursor: TranslationKey = result;
		for (let i = 0; i < parts.length - 1; i += 1) {
			const part = parts[i];
			if (!part) {
				continue;
			}
			const existing = cursor[part];
			if (!isTranslationBranch(existing)) {
				const next: TranslationKey = {};
				cursor[part] = next;
				cursor = next;
			} else {
				cursor = existing;
			}
		}

		const leaf = parts[parts.length - 1];
		if (!leaf) {
			continue;
		}
		cursor[leaf] = text;
	}

	return result;
}
