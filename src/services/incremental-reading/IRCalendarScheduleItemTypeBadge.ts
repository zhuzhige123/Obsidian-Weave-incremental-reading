import type { App } from "obsidian";
import { isHttpUrl } from "../obsidian/obsidian-open-web-url";
import type { ScheduleItem } from "./IRCalendarScheduleItem";
import { isEpubBookmarkTaskId } from "./IREpubBookmarkTaskService";
import { isPdfBookmarkTaskId } from "./IRPdfBookmarkTaskService";
import { resolveScheduleItemWebUrl } from "./ir-web-reading-point";

export type ScheduleItemTypeBadge = "canvas" | "epub" | "pdf" | "md" | "link";

export const SCHEDULE_ITEM_TYPE_BADGES: readonly ScheduleItemTypeBadge[] = [
	"md",
	"canvas",
	"epub",
	"pdf",
	"link",
] as const;

const SCHEDULE_ITEM_TYPE_SEARCH_ALIASES: Record<string, ScheduleItemTypeBadge> =
	{
		md: "md",
		markdown: "md",
		canvas: "canvas",
		epub: "epub",
		pdf: "pdf",
		link: "link",
		web: "link",
		url: "link",
		链接: "link",
		网页: "link",
	};

const SCHEDULE_ITEM_TYPE_ICON: Record<ScheduleItemTypeBadge, string> = {
	canvas: "layout-grid",
	epub: "book-open",
	pdf: "file",
	md: "file-text",
	link: "globe",
};

export function resolveScheduleItemTypeIcon(
	badge: ScheduleItemTypeBadge,
): string {
	return SCHEDULE_ITEM_TYPE_ICON[badge];
}

export function resolveScheduleItemTypeBadge(
	app: App,
	material: ScheduleItem,
): ScheduleItemTypeBadge | null {
	if (resolveScheduleItemWebUrl(app, material)) {
		return "link";
	}

	const resumeLink = String(material.resumeLink || "").trim();
	if (isHttpUrl(resumeLink)) {
		return "link";
	}

	const sourceFile = String(material.sourceFile || "")
		.trim()
		.toLowerCase();

	if (
		isPdfBookmarkTaskId(material.id) ||
		material.sourceType === "pdf" ||
		sourceFile.endsWith(".pdf")
	) {
		return "pdf";
	}

	if (
		isEpubBookmarkTaskId(material.id) ||
		material.sourceType === "epub" ||
		sourceFile.endsWith(".epub")
	) {
		return "epub";
	}

	if (sourceFile.endsWith(".canvas")) {
		return "canvas";
	}

	if (sourceFile.endsWith(".md") || sourceFile.endsWith(".markdown")) {
		return "md";
	}

	return null;
}

export function normalizeScheduleItemTypeSearchToken(
	token: string,
): ScheduleItemTypeBadge | null {
	const normalized = String(token || "")
		.trim()
		.toLowerCase()
		.replace(/^['"]+|['"]+$/g, "");
	if (!normalized) {
		return null;
	}

	return SCHEDULE_ITEM_TYPE_SEARCH_ALIASES[normalized] ?? null;
}

export function matchesScheduleItemTypeSearch(
	app: App,
	material: ScheduleItem,
	includeTokens: string[],
	excludeTokens: string[] = [],
): boolean {
	const badge = resolveScheduleItemTypeBadge(app, material);
	if (!badge) {
		return includeTokens.length === 0;
	}

	if (excludeTokens.length > 0) {
		const excluded = excludeTokens.some((token) => {
			const normalized = normalizeScheduleItemTypeSearchToken(token);
			return normalized !== null && normalized === badge;
		});
		if (excluded) {
			return false;
		}
	}

	if (includeTokens.length === 0) {
		return true;
	}

	return includeTokens.some((token) => {
		const normalized = normalizeScheduleItemTypeSearchToken(token);
		return normalized !== null && normalized === badge;
	});
}
