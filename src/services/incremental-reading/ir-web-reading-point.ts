import type { App } from "obsidian";
import { isHttpUrl } from "../obsidian/obsidian-open-web-url";
import type { ScheduleItem } from "./IRCalendarScheduleItem";

export const IR_WEB_URL_FRONTMATTER_KEY = "weave-ir-web-url";
export const IR_WEB_CHUNK_META_URL_KEY = "webUrl";

export function deriveWebPageTitleFromUrl(url: string): string {
	const normalized = String(url || "").trim();
	if (!normalized) {
		return "";
	}

	try {
		const parsed = new URL(normalized);
		const host = parsed.hostname.replace(/^www\./i, "");
		const path =
			parsed.pathname && parsed.pathname !== "/"
				? parsed.pathname.replace(/\/$/, "")
				: "";
		const candidate = decodeURIComponent(`${host}${path}`).trim();
		return candidate.slice(0, 120) || normalized.slice(0, 120);
	} catch {
		return normalized.slice(0, 120);
	}
}

export function resolveScheduleItemWebUrl(
	app: App,
	material: ScheduleItem,
): string | null {
	const resumeLink = String(material.resumeLink || "").trim();
	if (isHttpUrl(resumeLink)) {
		return resumeLink;
	}

	const sourceFile = String(material.sourceFile || "").trim();
	if (!sourceFile) {
		return null;
	}

	const cache = app.metadataCache.getCache(sourceFile);
	const frontmatterUrl = String(
		cache?.frontmatter?.[IR_WEB_URL_FRONTMATTER_KEY] || "",
	).trim();
	if (isHttpUrl(frontmatterUrl)) {
		return frontmatterUrl;
	}

	return null;
}

export function buildWebReadingPointMarkdown(
	title: string,
	url: string,
	options?: { selectedText?: string },
): string {
	const safeTitle =
		String(title || "").trim() ||
		deriveWebPageTitleFromUrl(url) ||
		"网页阅读点";
	const safeUrl = String(url || "").trim();
	const selectedText = String(options?.selectedText || "")
		.replace(/\r\n?/g, "\n")
		.trim();
	const bodyParts = [`# ${safeTitle}`, "", `[${safeTitle}](${safeUrl})`];
	if (selectedText) {
		bodyParts.push("", "## 选区摘录", "", selectedText);
	}
	bodyParts.push("");
	const body = bodyParts.join("\n");
	const frontmatter = [
		"---",
		`${IR_WEB_URL_FRONTMATTER_KEY}: ${JSON.stringify(safeUrl)}`,
		"---",
		"",
	].join("\n");
	return `${frontmatter}${body}`;
}
