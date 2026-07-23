import {
	type App,
	type EditorPosition,
	MarkdownView,
	type TFile,
	normalizePath,
} from "obsidian";
import {
	buildObsidianEmbedBlockWikiLink,
	extractObsidianBlockIdFromText,
} from "../paragraph-workbench/paragraph-block-reference";
import { parseReadingTargetInput } from "./IRReadingTargetParser";
import type { ParsedReadingTarget } from "./IRReadingTargetTypes";

export interface IRReadingTargetCurrentLocationContext {
	file: TFile;
	selectedText: string;
	cursor: EditorPosition;
	sourceLink: string;
	target: ParsedReadingTarget;
}

function findBlockIdAtLine(app: App, file: TFile, line: number): string | null {
	const cache = app.metadataCache.getFileCache(file);
	const blocks = cache?.blocks;
	if (!blocks) {
		return null;
	}

	for (const [blockId, ref] of Object.entries(blocks)) {
		if (ref.position.start.line <= line && ref.position.end.line >= line) {
			return blockId;
		}
	}
	return null;
}

function readLineText(editor: MarkdownView["editor"], line: number): string {
	return String(editor.getLine(line) || "").trim();
}

export function getCurrentEditorReadingTargetContext(
	app: App,
): IRReadingTargetCurrentLocationContext | null {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	if (!view?.file || view.file.extension !== "md") {
		return null;
	}

	const editor = view.editor;
	const selection = editor.getSelection().replace(/\r\n?/g, "\n").trim();
	const cursor = editor.getCursor();
	const lineText = readLineText(editor, cursor.line);
	if (!selection && !lineText) {
		return null;
	}

	let blockId = findBlockIdAtLine(app, view.file, cursor.line);
	if (!blockId) {
		blockId = extractObsidianBlockIdFromText(lineText);
	}

	const sourcePath = normalizePath(view.file.path);
	let sourceLink = "";
	let target: ParsedReadingTarget;

	if (blockId) {
		sourceLink = buildObsidianEmbedBlockWikiLink(sourcePath, blockId);
		target = parseReadingTargetInput(app, sourceLink, sourcePath);
	} else {
		const lineAlias = (selection || lineText).slice(0, 40).replace(/[[\]]/g, "");
		const lineResume = `${sourcePath}#${cursor.line + 1}`;
		sourceLink = lineAlias
			? `[[${lineResume}|${lineAlias}]]`
			: `[[${lineResume}]]`;
		target = parseReadingTargetInput(app, sourceLink, sourcePath);
		const titleHint = (selection || lineText)
			.split("\n")[0]
			?.trim()
			.slice(0, 80);
		if (titleHint && !target.validationError) {
			target = {
				...target,
				titleHint: target.titleHint || titleHint,
				alias: target.alias || titleHint,
			};
		}
	}

	return {
		file: view.file,
		selectedText: selection || lineText,
		cursor,
		sourceLink,
		target,
	};
}

export function buildReadingTargetPreviewMarkdown(
	target: ParsedReadingTarget,
	title: string,
): string {
	if (target.kind === "pdf" || target.kind === "pdf-batch") {
		return buildPdfReadingTargetEmbedMarkdown(target);
	}
	if (
		target.kind === "vault-block" &&
		target.sourceFilePath &&
		target.blockId
	) {
		return buildObsidianEmbedBlockWikiLink(
			target.sourceFilePath,
			target.blockId,
			title,
		);
	}
	if (target.kind === "epub") {
		const link = target.epubResumeLink || target.resumeLink;
		return link ? `[${title}](${link})` : title;
	}
	if (target.kind === "canvas") {
		return target.displayLink || target.resumeLink || title;
	}
	if (target.displayLink) {
		return target.displayLink.startsWith("!")
			? target.displayLink
			: `!${
					target.displayLink.startsWith("[[")
						? target.displayLink
						: `[[${target.displayLink}]]`
			  }`;
	}
	if (target.kind === "web" && target.webUrl) {
		return `[${title}](${target.webUrl})`;
	}
	return target.resumeLink ? `\`${target.resumeLink}\`` : "";
}

function buildPdfReadingTargetEmbedMarkdown(
	target: ParsedReadingTarget,
): string {
	const raw = String(target.rawInput || "").trim();
	if (raw.startsWith("!")) {
		return raw;
	}
	if (target.displayLink) {
		return target.displayLink.startsWith("!")
			? target.displayLink
			: `!${
					target.displayLink.startsWith("[[")
						? target.displayLink
						: `[[${target.displayLink}]]`
			  }`;
	}
	if (target.resumeLink) {
		return `![[${target.resumeLink}]]`;
	}
	return "";
}
