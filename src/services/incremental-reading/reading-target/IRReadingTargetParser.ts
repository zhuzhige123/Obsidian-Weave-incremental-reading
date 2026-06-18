import { normalizePath, type App } from "obsidian";
import { parsePdfCallouts } from "../../../utils/pdf-callout-parser";
import { i18n } from "../../../utils/i18n";
import { EpubLinkService } from "../../epub-integration/EpubLinkService";
import { EPUB_RUNTIME } from "../../epub-integration/epub-runtime";
import { isHttpUrl } from "../../obsidian/obsidian-open-web-url";
import {
	extractWikiLinkTarget,
	normalizeObsidianBlockId,
} from "../paragraph-workbench/paragraph-block-reference";
import type { ParsedReadingTarget } from "./IRReadingTargetTypes";

const WIKI_LINK_CAPTURE_REGEX = /!?\[\[([^\]]+)\]\]/;

function stripOuterWikiSyntax(raw: string): string {
	return String(raw || "")
		.trim()
		.replace(/^!?\[\[/, "")
		.replace(/\]\]$/, "")
		.trim();
}

function splitWikiLinkParts(inner: string): { pathPart: string; alias?: string } {
	const pipeIndex = inner.indexOf("|");
	if (pipeIndex < 0) {
		return { pathPart: inner.trim() };
	}
	return {
		pathPart: inner.slice(0, pipeIndex).trim(),
		alias: inner.slice(pipeIndex + 1).trim() || undefined,
	};
}

function parseWikiLinkInner(inner: string): {
	filePart: string;
	fragment?: string;
	blockId?: string;
	alias?: string;
} {
	const { pathPart, alias } = splitWikiLinkParts(inner);
	const hashIndex = pathPart.indexOf("#");
	if (hashIndex < 0) {
		return { filePart: pathPart, alias };
	}

	const filePart = pathPart.slice(0, hashIndex).trim();
	const fragment = pathPart.slice(hashIndex + 1).trim();
	const blockId = fragment.startsWith("^")
		? normalizeObsidianBlockId(fragment)
		: undefined;
	return {
		filePart,
		fragment: fragment || undefined,
		blockId: blockId || undefined,
		alias,
	};
}

function extractWikiLinkFromText(raw: string): string {
	const match = String(raw || "").trim().match(WIKI_LINK_CAPTURE_REGEX);
	if (match?.[1]) {
		return match[1];
	}
	const stripped = stripOuterWikiSyntax(raw);
	return stripped.includes("#") || stripped.includes("|") || stripped.includes("/") || stripped.endsWith(".md")
		? stripped
		: "";
}

function matchesEpubProtocolHref(value: string): boolean {
	return EPUB_RUNTIME.protocol.allNames.some((name) => value.startsWith(`obsidian://${name}?`));
}

function parseObsidianOpenUri(raw: string): string | null {
	const normalized = String(raw || "").trim();
	if (!/^obsidian:\/\//i.test(normalized)) {
		return null;
	}
	if (matchesEpubProtocolHref(normalized)) {
		return null;
	}

	try {
		const url = new URL(normalized);
		const fileParam = url.searchParams.get("file") || url.searchParams.get("filepath");
		if (fileParam) {
			return decodeURIComponent(fileParam);
		}
	} catch {
		return null;
	}

	return null;
}

function extractMarkdownLinkLabel(raw: string): string | undefined {
	const match = String(raw || "").trim().match(/^\[([^\]]+)\]\(/);
	return match?.[1]?.trim() || undefined;
}

function normalizeEpubResumeLink(raw: string): string {
	const trimmed = String(raw || "").trim();
	if (matchesEpubProtocolHref(trimmed)) {
		return trimmed;
	}
	const match = trimmed.match(/\((obsidian:\/\/[^)]+)\)/i);
	return match?.[1] || trimmed;
}

function parseEpubReadingTarget(app: App, raw: string): ParsedReadingTarget | null {
	const label = extractMarkdownLinkLabel(raw);
	const parsed = EpubLinkService.parseLinkMarkup(raw);
	if (!parsed?.cfi && !parsed?.tocHref) {
		return null;
	}

	const filePath = parsed.filePath ? normalizePath(parsed.filePath) : "";
	const sourceId = String(parsed.sourceId || "").trim() || undefined;
	const hasVaultFile = Boolean(filePath && app.vault.getAbstractFileByPath(filePath));
	const normalizedResumeLink = normalizeEpubResumeLink(raw);

	if (!hasVaultFile && !sourceId) {
		return {
			kind: "epub",
			rawInput: raw,
			resumeLink: normalizedResumeLink,
			epubResumeLink: normalizedResumeLink,
			epubCfi: parsed.cfi || undefined,
			epubSourceId: sourceId,
			epubChapter: parsed.chapter,
			epubTocHref: parsed.tocHref,
			sourceFilePath: filePath || undefined,
			alias: label || parsed.text || undefined,
			titleHint: label || parsed.text || undefined,
			validationError: filePath
				? i18n.t("irAddTarget.parser.epubFileNotFound", { filePath })
				: i18n.t("irAddTarget.parser.epubMissingFileOrSid"),
		};
	}

	const tocHref =
		parsed.tocHref ||
		(typeof parsed.chapter === "number" && Number.isFinite(parsed.chapter)
			? `#chapter-${parsed.chapter}`
			: parsed.cfi
				? undefined
				: filePath);

	return {
		kind: "epub",
		rawInput: raw,
		resumeLink: normalizedResumeLink,
		epubResumeLink: normalizedResumeLink,
		epubCfi: parsed.cfi || undefined,
		epubSourceId: sourceId,
		epubChapter: parsed.chapter,
		epubTocHref: tocHref,
		sourceFilePath: filePath || undefined,
		alias: label || parsed.text || undefined,
		titleHint: label || parsed.text || undefined,
	};
}

function resolveVaultFilePath(app: App, linkPath: string, contextPath = ""): string | null {
	const normalized = String(linkPath || "").trim();
	if (!normalized) {
		return null;
	}

	const dest = app.metadataCache.getFirstLinkpathDest(normalized, contextPath);
	if (dest) {
		return normalizePath(dest.path);
	}

	const direct = app.vault.getAbstractFileByPath(normalizePath(normalized));
	return direct ? normalizePath(direct.path) : null;
}

function validateVaultBlock(app: App, filePath: string, blockId: string): string | null {
	const cache = app.metadataCache.getCache(filePath);
	const blockRef = cache?.blocks?.[blockId];
	if (!blockRef) {
		return i18n.t("irAddTarget.parser.blockRefNotFound", { filePath, blockId });
	}
	return null;
}

export function parseReadingTargetInput(app: App, rawInput: string, contextPath = ""): ParsedReadingTarget {
	const raw = String(rawInput || "").trim();
	if (!raw) {
		return {
			kind: "unknown",
			rawInput: raw,
			resumeLink: "",
			validationError: i18n.t("irAddTarget.parser.emptyInput"),
		};
	}

	if (isHttpUrl(raw)) {
		return {
			kind: "web",
			rawInput: raw,
			resumeLink: raw,
			webUrl: raw,
		};
	}

	const epubTarget = parseEpubReadingTarget(app, raw);
	if (epubTarget) {
		return epubTarget;
	}

	const obsidianFile = parseObsidianOpenUri(raw);
	if (obsidianFile) {
		return parseReadingTargetInput(app, `[[${obsidianFile}]]`, contextPath);
	}

	if (/>\s*\[!PDF/i.test(raw)) {
		const pdfPoints = parsePdfCallouts(raw).map((point) => ({
			title: point.title,
			resumeLink: point.resumeLink,
			pdfPath: point.pdfFilePath,
		}));
		if (pdfPoints.length === 0) {
			return {
				kind: "unknown",
				rawInput: raw,
				resumeLink: "",
				validationError: i18n.t("irAddTarget.parser.pdfParseFailed"),
			};
		}
		if (pdfPoints.length === 1) {
			const point = pdfPoints[0];
			return {
				kind: "pdf",
				rawInput: raw,
				resumeLink: point.resumeLink,
				sourceFilePath: normalizePath(point.pdfPath),
				pdfPath: normalizePath(point.pdfPath),
				titleHint: point.title,
				alias: point.title,
			};
		}
		return {
			kind: "pdf-batch",
			rawInput: raw,
			resumeLink: pdfPoints[0].resumeLink,
			pdfPoints,
			pdfPath: normalizePath(pdfPoints[0].pdfPath),
		};
	}

	const wikiInner = extractWikiLinkFromText(raw);
	if (!wikiInner) {
		return {
			kind: "unknown",
			rawInput: raw,
			resumeLink: raw,
			validationError: i18n.t("irAddTarget.parser.unknownFormat"),
		};
	}

	const parsed = parseWikiLinkInner(wikiInner);
	const resolvedPath = resolveVaultFilePath(app, parsed.filePart, contextPath);
	if (!resolvedPath) {
		return {
			kind: "unknown",
			rawInput: raw,
			resumeLink: wikiInner,
			validationError: i18n.t("irAddTarget.parser.fileNotFound", { filePath: parsed.filePart }),
		};
	}

	if (/\.epub$/i.test(resolvedPath)) {
		return {
			kind: "unknown",
			rawInput: raw,
			resumeLink: resolvedPath,
			sourceFilePath: resolvedPath,
			validationError: i18n.t("irAddTarget.parser.epubCfiRequired"),
		};
	}

	const resumeLink = parsed.blockId
		? `${resolvedPath}#^${parsed.blockId}`
		: parsed.fragment
			? `${resolvedPath}#${parsed.fragment}`
			: resolvedPath;
	const displayLink = parsed.alias
		? `[[${resumeLink}|${parsed.alias}]]`
		: `[[${resumeLink}]]`;

	if (parsed.blockId) {
		const blockError = validateVaultBlock(app, resolvedPath, parsed.blockId);
		if (blockError) {
			return {
				kind: "vault-block",
				rawInput: raw,
				resumeLink,
				displayLink,
				sourceFilePath: resolvedPath,
				blockId: parsed.blockId,
				alias: parsed.alias,
				titleHint: parsed.alias,
				validationError: blockError,
			};
		}
		return {
			kind: "vault-block",
			rawInput: raw,
			resumeLink,
			displayLink,
			sourceFilePath: resolvedPath,
			blockId: parsed.blockId,
			alias: parsed.alias,
			titleHint: parsed.alias,
		};
	}

	if (/page=\d+/i.test(parsed.fragment || resumeLink) && /\.pdf$/i.test(resolvedPath)) {
		return {
			kind: "pdf",
			rawInput: raw,
			resumeLink,
			displayLink,
			sourceFilePath: resolvedPath,
			pdfPath: resolvedPath,
			titleHint: parsed.alias,
			alias: parsed.alias,
		};
	}

	if (parsed.fragment) {
		return {
			kind: "vault-link",
			rawInput: raw,
			resumeLink,
			displayLink,
			sourceFilePath: resolvedPath,
			alias: parsed.alias,
			titleHint: parsed.alias || parsed.fragment,
		};
	}

	return {
		kind: "vault-file",
		rawInput: raw,
		resumeLink: resolvedPath,
		displayLink,
		sourceFilePath: resolvedPath,
		alias: parsed.alias,
		titleHint: parsed.alias,
	};
}
