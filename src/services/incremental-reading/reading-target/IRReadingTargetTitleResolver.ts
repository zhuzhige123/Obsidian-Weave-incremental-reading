import { TFile, normalizePath, type App } from "obsidian";
import { deriveWebPageTitleFromUrl } from "../ir-web-reading-point";
import type { ParsedReadingTarget } from "./IRReadingTargetTypes";

function findNearestHeading(
	headings: Array<{ heading: string; level: number; position: { start: { line: number } } }> | null | undefined,
	targetLine: number
): string | null {
	if (!Array.isArray(headings) || headings.length === 0) {
		return null;
	}

	let candidate: string | null = null;
	for (const heading of headings) {
		if (heading.position.start.line <= targetLine) {
			candidate = heading.heading;
		} else {
			break;
		}
	}
	return candidate;
}

async function readBlockTextPreview(app: App, filePath: string, blockId: string): Promise<string | null> {
	const cache = app.metadataCache.getCache(filePath);
	const blockRef = cache?.blocks?.[blockId];
	if (!blockRef) {
		return null;
	}

	const file = app.vault.getAbstractFileByPath(filePath);
	if (!(file instanceof TFile)) {
		return null;
	}

	try {
		const content = await app.vault.cachedRead(file);
		const lines = content.split(/\r\n?/);
		const start = Math.max(0, blockRef.position.start.line);
		const end = Math.min(lines.length - 1, blockRef.position.end.line);
		const snippet = lines
			.slice(start, end + 1)
			.join(" ")
			.replace(/\s+/g, " ")
			.replace(/\^[A-Za-z0-9_-]+\s*/g, "")
			.trim();
		if (!snippet) {
			return null;
		}
		return snippet.length > 80 ? `${snippet.slice(0, 80).trim()}…` : snippet;
	} catch {
		return null;
	}
}

export interface ReadingTargetTitleDraft {
	title: string;
	titleDetected: boolean;
}

export async function resolveReadingTargetTitleDraft(
	app: App,
	target: ParsedReadingTarget
): Promise<ReadingTargetTitleDraft> {
	const alias = String(target.alias || target.titleHint || "").trim();
	if (alias) {
		return { title: alias, titleDetected: true };
	}

	if (target.kind === "epub") {
		const derived = String(target.alias || target.titleHint || "").trim();
		if (derived) {
			return { title: derived, titleDetected: true };
		}
	}

	if (target.kind === "web" && target.webUrl) {
		const derived = deriveWebPageTitleFromUrl(target.webUrl);
		if (derived) {
			return { title: derived, titleDetected: false };
		}
	}

	if (target.sourceFilePath) {
		const filePath = normalizePath(target.sourceFilePath);
		const cache = app.metadataCache.getCache(filePath);

		if (target.blockId && cache?.blocks?.[target.blockId]) {
			const heading = findNearestHeading(cache.headings, cache.blocks[target.blockId].position.start.line);
			if (heading) {
				return { title: heading, titleDetected: true };
			}
			const preview = await readBlockTextPreview(app, filePath, target.blockId);
			if (preview) {
				return { title: preview, titleDetected: false };
			}
		}

		if (target.kind === "vault-link" && target.resumeLink.includes("#")) {
			const fragment = target.resumeLink.split("#").pop()?.trim();
			if (fragment && !fragment.startsWith("^")) {
				return { title: decodeURIComponent(fragment), titleDetected: true };
			}
		}

		const basename = filePath.split("/").pop()?.replace(/\.[^.]+$/u, "").trim();
		if (basename) {
			return { title: basename, titleDetected: false };
		}
	}

	if (target.kind === "pdf-batch" && target.pdfPoints?.[0]?.title) {
		return { title: target.pdfPoints[0].title, titleDetected: true };
	}

	return { title: "未命名阅读点", titleDetected: false };
}

export function getReadingTargetKindLabel(kind: ParsedReadingTarget["kind"]): string {
	switch (kind) {
		case "web":
			return "网页链接";
		case "vault-block":
			return "Vault 块引用";
		case "vault-link":
			return "标题锚点";
		case "vault-file":
			return "Vault 文件";
		case "pdf":
			return "PDF 定位";
		case "pdf-batch":
			return "PDF++ 批量链接";
		case "epub":
			return "EPUB 阅读定位";
		default:
			return "未知类型";
	}
}
