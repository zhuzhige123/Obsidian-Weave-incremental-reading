import type {
	IRTagSourcePolicy,
	IncrementalReadingSettings,
} from "../../types/plugin-settings.d";

/** Obsidian-native YAML tags key (recommended for interoperability). */
export const DEFAULT_MARKDOWN_TAGS_YAML_KEY = "tags";

/** Legacy IR-only dual-write key; still read as fallback when primary is empty. */
export const LEGACY_MARKDOWN_TAGS_YAML_KEY = "weave_tags";

/**
 * Default policy keeps `weave_tags` so existing IR installs do not suddenly
 * match against unrelated Obsidian note `tags:`. Users can switch to `tags`
 * in settings when they want Obsidian-native interoperability.
 */
export const DEFAULT_IR_TAG_SOURCE_POLICY: IRTagSourcePolicy = {
	markdownYamlKey: LEGACY_MARKDOWN_TAGS_YAML_KEY,
};

/**
 * Normalize a YAML property name used for Markdown reading-point tags.
 * Empty / invalid input falls back to the safe legacy `weave_tags` key
 * (not Obsidian `tags`, which may collide with graph/search tags).
 */
export function normalizeMarkdownTagsYamlKey(raw: unknown): string {
	const key = (
		typeof raw === "string"
			? raw
			: typeof raw === "number" || typeof raw === "boolean"
				? String(raw)
				: ""
	)
		.trim()
		.replace(/^frontmatter\./i, "");
	if (!key || key.includes("\n") || key.includes(":") || /\s/.test(key)) {
		return LEGACY_MARKDOWN_TAGS_YAML_KEY;
	}
	return key;
}

export function normalizeIRTagSourcePolicy(
	policy?: Partial<IRTagSourcePolicy> | null,
): IRTagSourcePolicy {
	const rawKey = policy?.markdownYamlKey;
	return {
		markdownYamlKey:
			rawKey === undefined || rawKey === null || String(rawKey).trim() === ""
				? DEFAULT_IR_TAG_SOURCE_POLICY.markdownYamlKey
				: normalizeMarkdownTagsYamlKey(rawKey),
	};
}

export function resolveIRTagSourcePolicy(
	settings?: Partial<IncrementalReadingSettings> | null,
): IRTagSourcePolicy {
	return normalizeIRTagSourcePolicy(settings?.tagSource);
}

export function resolveMarkdownTagsYamlKeyFromSettings(
	settings?: Partial<IncrementalReadingSettings> | null,
): string {
	return resolveIRTagSourcePolicy(settings).markdownYamlKey;
}

/**
 * Read tags from a frontmatter record using the configured primary key,
 * falling back to legacy `weave_tags` when the primary key is empty.
 */
export function readTagsFromFrontmatterRecord(
	frontmatter: Record<string, unknown> | null | undefined,
	primaryKey: string,
): string[] {
	if (!frontmatter) return [];
	const primary = normalizeMarkdownTagsYamlKey(primaryKey);
	const fromPrimary = readRawFrontmatterTagValue(frontmatter[primary]);
	if (fromPrimary.length > 0) {
		return fromPrimary;
	}
	if (primary !== LEGACY_MARKDOWN_TAGS_YAML_KEY) {
		return readRawFrontmatterTagValue(
			frontmatter[LEGACY_MARKDOWN_TAGS_YAML_KEY],
		);
	}
	return [];
}

/** Case-insensitive set equality for tag label lists. */
export function readingPointTagListsEqual(
	left: string[] | null | undefined,
	right: string[] | null | undefined,
): boolean {
	const a = normalizeFrontmatterTagLabels(left || []).map((tag) =>
		tag.toLowerCase(),
	);
	const b = normalizeFrontmatterTagLabels(right || []).map((tag) =>
		tag.toLowerCase(),
	);
	if (a.length !== b.length) return false;
	const setB = new Set(b);
	return a.every((tag) => setB.has(tag));
}

/**
 * Whether it is safe to delete legacy `weave_tags` after writing the primary key.
 * Only clear when legacy is empty or identical to the written value — never
 * discard divergent IR tags while Obsidian `tags:` is the primary store.
 */
export function shouldClearLegacyWeaveTagsAfterWrite(params: {
	primaryKey: string;
	writtenTags: string[];
	legacyTags: string[];
}): boolean {
	const primary = normalizeMarkdownTagsYamlKey(params.primaryKey);
	if (primary === LEGACY_MARKDOWN_TAGS_YAML_KEY) {
		return false;
	}
	const legacy = normalizeFrontmatterTagLabels(params.legacyTags || []);
	if (legacy.length === 0) {
		return true;
	}
	return readingPointTagListsEqual(legacy, params.writtenTags);
}

export function readRawFrontmatterTagValue(rawValue: unknown): string[] {
	if (Array.isArray(rawValue)) {
		return normalizeFrontmatterTagLabels(rawValue.map((tag) => String(tag)));
	}
	if (typeof rawValue === "string") {
		return normalizeFrontmatterTagLabels(
			rawValue
				.split(",")
				.map((tag) => tag.trim())
				.filter(Boolean),
		);
	}
	return [];
}

function normalizeFrontmatterTagLabels(tags: string[]): string[] {
	const ordered = new Map<string, string>();
	for (const rawTag of tags) {
		const label = String(rawTag || "")
			.trim()
			.replace(/^#+/, "");
		const key = label.toLowerCase();
		if (!key || ordered.has(key)) continue;
		ordered.set(key, label);
	}
	return Array.from(ordered.values());
}
