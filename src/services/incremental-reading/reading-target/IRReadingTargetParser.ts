import { type App, TFile, normalizePath } from "obsidian";
import { i18n } from "../../../utils/i18n";
import { parsePdfCallouts } from "../../../utils/pdf-callout-parser";
import { EpubLinkService } from "../../epub-integration/EpubLinkService";
import { EPUB_RUNTIME } from "../../epub-integration/epub-runtime";
import { isHttpUrl } from "../../obsidian/obsidian-open-web-url";
import {
	OBSIDIAN_BLOCK_ID_LINE_REGEX,
	normalizeObsidianBlockId,
} from "../paragraph-workbench/paragraph-block-reference";
import {
	buildCanvasParsedReadingTarget,
	parseCanvasNodeFragment,
} from "./IRReadingTargetCanvas";
import type { ParsedReadingTarget } from "./IRReadingTargetTypes";

const WIKI_LINK_CAPTURE_REGEX = /!?\[\[([^\]]+)\]\]/;
const MARKDOWN_HTTP_LINK_REGEX =
	/^\[([^\]]*)\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)$/i;

function parseMarkdownHttpLink(
	raw: string,
): { title?: string; url: string } | null {
	const match = String(raw || "")
		.trim()
		.match(MARKDOWN_HTTP_LINK_REGEX);
	if (!match?.[2]) {
		return null;
	}
	const title = String(match[1] || "").trim() || undefined;
	return { title, url: match[2] };
}

function stripOuterWikiSyntax(raw: string): string {
	return String(raw || "")
		.trim()
		.replace(/^!?\[\[/, "")
		.replace(/\]\]$/, "")
		.trim();
}

function splitWikiLinkParts(inner: string): {
	pathPart: string;
	alias?: string;
} {
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
	const match = String(raw || "")
		.trim()
		.match(WIKI_LINK_CAPTURE_REGEX);
	if (match?.[1]) {
		return match[1];
	}
	const stripped = stripOuterWikiSyntax(raw);
	return stripped.includes("#") ||
		stripped.includes("|") ||
		stripped.includes("/") ||
		stripped.endsWith(".md")
		? stripped
		: "";
}

function matchesEpubProtocolHref(value: string): boolean {
	return EPUB_RUNTIME.protocol.allNames.some((name) =>
		value.startsWith(`obsidian://${name}?`),
	);
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
		const fileParam =
			url.searchParams.get("file") || url.searchParams.get("filepath");
		if (fileParam) {
			return decodeURIComponent(fileParam);
		}
	} catch {
		return null;
	}

	return null;
}

function extractMarkdownLinkLabel(raw: string): string | undefined {
	const match = String(raw || "")
		.trim()
		.match(/^\[([^\]]+)\]\(/);
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

function parseEpubReadingTarget(
	app: App,
	raw: string,
): ParsedReadingTarget | null {
	const label = extractMarkdownLinkLabel(raw);
	const parsed = EpubLinkService.parseLinkMarkup(raw);
	if (!parsed?.cfi && !parsed?.tocHref) {
		return null;
	}

	const filePath = parsed.filePath ? normalizePath(parsed.filePath) : "";
	const sourceId = String(parsed.sourceId || "").trim() || undefined;
	const hasVaultFile = Boolean(
		filePath && app.vault.getAbstractFileByPath(filePath),
	);
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

function resolveVaultFilePath(
	app: App,
	linkPath: string,
	contextPath = "",
): string | null {
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

function validateVaultBlock(
	app: App,
	filePath: string,
	blockId: string,
): string | null {
	const normalizedBlockId = normalizeObsidianBlockId(blockId);
	if (!normalizedBlockId) {
		return i18n.t("irAddTarget.parser.blockRefNotFound", { filePath, blockId });
	}
	const cache = app.metadataCache.getCache(filePath);
	if (cache?.blocks?.[normalizedBlockId]) {
		return null;
	}
	return i18n.t("irAddTarget.parser.blockRefNotFound", {
		filePath,
		blockId: normalizedBlockId,
	});
}

/**
 * True when markdown source already contains an Obsidian block id marker.
 * Used when metadataCache lags behind a freshly written `^blockId`.
 */
export function markdownContentHasObsidianBlockId(
	content: string,
	blockId: string,
): boolean {
	const normalizedBlockId = normalizeObsidianBlockId(blockId);
	if (!normalizedBlockId) {
		return false;
	}
	const lines = String(content || "").split(/\r\n|\n|\r/);
	for (const line of lines) {
		const match = String(line || "").match(OBSIDIAN_BLOCK_ID_LINE_REGEX);
		if (match?.[1] === normalizedBlockId) {
			return true;
		}
		// Prefer end-of-line markers (Obsidian standard), but also accept mid-line.
		const trimmed = String(line || "").trimEnd();
		if (
			trimmed === `^${normalizedBlockId}` ||
			trimmed.endsWith(` ^${normalizedBlockId}`)
		) {
			return true;
		}
	}
	return false;
}

/**
 * Cache-first block validation with vault content fallback.
 * Freshly inserted block ids are often missing from metadataCache for a short window.
 */
export async function resolveVaultBlockValidationError(
	app: App,
	filePath: string,
	blockId: string,
): Promise<string | null> {
	const cacheError = validateVaultBlock(app, filePath, blockId);
	if (!cacheError) {
		return null;
	}

	const normalizedPath = normalizePath(String(filePath || "").trim());
	const file = app.vault.getAbstractFileByPath(normalizedPath);
	if (!file) {
		return cacheError;
	}

	try {
		if (!(file instanceof TFile)) {
			return cacheError;
		}
		const content = await app.vault.cachedRead(file);
		if (markdownContentHasObsidianBlockId(content, blockId)) {
			return null;
		}
	} catch {
		return cacheError;
	}
	return cacheError;
}

/** Re-check vault-block targets when metadataCache has not indexed a fresh ^id yet. */
export async function refineParsedReadingTargetValidation(
	app: App,
	target: ParsedReadingTarget,
): Promise<ParsedReadingTarget> {
	if (
		target.kind !== "vault-block" ||
		!target.validationError ||
		!target.sourceFilePath ||
		!target.blockId
	) {
		return target;
	}

	const error = await resolveVaultBlockValidationError(
		app,
		target.sourceFilePath,
		target.blockId,
	);
	if (error) {
		return {
			...target,
			validationError: error,
		};
	}
	return {
		...target,
		validationError: undefined,
	};
}

export function parseReadingTargetInput(
	app: App,
	rawInput: string,
	contextPath = "",
): ParsedReadingTarget {
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

	const markdownHttp = parseMarkdownHttpLink(raw);
	if (markdownHttp) {
		return {
			kind: "web",
			rawInput: raw,
			resumeLink: markdownHttp.url,
			webUrl: markdownHttp.url,
			titleHint: markdownHttp.title,
			alias: markdownHttp.title,
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
			validationError: i18n.t("irAddTarget.parser.fileNotFound", {
				filePath: parsed.filePart,
			}),
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

	if (/\.canvas$/i.test(resolvedPath)) {
		const canvasNode = parseCanvasNodeFragment(parsed.fragment);
		if (!canvasNode) {
			return {
				kind: "unknown",
				rawInput: raw,
				resumeLink: resolvedPath,
				sourceFilePath: resolvedPath,
				validationError: i18n.t("irAddTarget.parser.canvasNodeRequired"),
			};
		}
		return buildCanvasParsedReadingTarget({
			rawInput: raw,
			sourceFilePath: resolvedPath,
			nodeId: canvasNode.nodeId,
			fragmentWithQuery: canvasNode.fragmentWithQuery,
			alias: parsed.alias,
		});
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

	if (
		/page=\d+/i.test(parsed.fragment || resumeLink) &&
		/\.pdf$/i.test(resolvedPath)
	) {
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
