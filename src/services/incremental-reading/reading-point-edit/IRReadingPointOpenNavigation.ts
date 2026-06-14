import { normalizePath, TFile, type App } from "obsidian";
import { EpubLinkService } from "../../epub-integration/EpubLinkService";
import { getIrEpubStorageService } from "../../epub-integration/ir-epub-storage-access";
import type { ScheduleItem } from "../IRCalendarScheduleItem";
import {
	IREpubBookmarkTaskService,
	isEpubBookmarkTaskId,
} from "../IREpubBookmarkTaskService";
import { openObsidianWebUrl } from "../../obsidian/obsidian-open-web-url";
import { resolveScheduleItemWebUrl } from "../ir-web-reading-point";
import { parseReadingTargetInput } from "../reading-target/IRReadingTargetParser";
import type { ParsedReadingTarget } from "../reading-target/IRReadingTargetTypes";
import { getSharedIRPointStorageService } from "../IRPointStorageService";
import {
	getCanvasNodeIdFromSourceLink,
	getCanvasSourceNodeRectFromSourceLink,
} from "../../ui/canvas-source-locate";
import { SourceNavigationService } from "../../ui/SourceNavigationService";
import { resolveReadingPointOpenLink } from "./IRReadingPointEditLinkResolver";

function stripWikiLinkForOpen(raw: string): string {
	return String(raw || "")
		.trim()
		.replace(/^!?\[\[/, "")
		.replace(/\]\]$/, "")
		.split("|")[0]
		.trim();
}

export function shouldUseNativeReadingTargetNavigation(
	parsed: ParsedReadingTarget | null | undefined
): boolean {
	if (!parsed || parsed.validationError) {
		return false;
	}
	return parsed.kind !== "unknown" && parsed.kind !== "epub";
}

function resolveCanvasFilePath(
	material: ScheduleItem,
	parsed: ParsedReadingTarget | null,
	resumeLink: string
): string {
	const candidates = [
		parsed?.sourceFilePath,
		material.sourceFile,
		stripWikiLinkForOpen(resumeLink).split("#")[0],
	];
	for (const candidate of candidates) {
		const normalized = normalizePath(String(candidate || "").trim());
		if (normalized.toLowerCase().endsWith(".canvas")) {
			return normalized;
		}
	}
	return "";
}

async function readPointCanvasMeta(
	app: App,
	pointId: string
): Promise<{ canvasNodeId: string; canvasTextCandidates: string[] }> {
	const pointStorage = getSharedIRPointStorageService(app);
	await pointStorage.initialize();
	const snapshot = await pointStorage.getPointSnapshotById(pointId);
	const metadata = (snapshot?.point.metadata || {}) as Record<string, unknown>;
	const canvasNodeId =
		typeof metadata.canvasNodeId === "string" ? metadata.canvasNodeId.trim() : "";
	const canvasTextCandidates = Array.isArray(metadata.canvasTextCandidates)
		? metadata.canvasTextCandidates
				.map((value) => String(value || "").trim())
				.filter(Boolean)
		: [];
	return { canvasNodeId, canvasTextCandidates };
}

export async function openParsedReadingTargetLink(
	app: App,
	parsed: ParsedReadingTarget,
	fallbackLink = ""
): Promise<boolean> {
	if (parsed.kind === "web" && parsed.webUrl) {
		return await openObsidianWebUrl(app, parsed.webUrl);
	}

	const linkToOpen = stripWikiLinkForOpen(parsed.resumeLink || fallbackLink);
	if (!linkToOpen) {
		return false;
	}

	const contextPath = app.workspace.getActiveFile()?.path ?? "";
	await app.workspace.openLinkText(linkToOpen, contextPath, false);
	return true;
}

async function openCanvasReadingTarget(
	app: App,
	material: ScheduleItem,
	resumeLink: string,
	parsed: ParsedReadingTarget | null
): Promise<boolean> {
	const canvasPath = resolveCanvasFilePath(material, parsed, resumeLink);
	if (!canvasPath) {
		return false;
	}

	const canvasMeta = await readPointCanvasMeta(app, material.id);
	const nodeId =
		canvasMeta.canvasNodeId ||
		getCanvasNodeIdFromSourceLink(resumeLink) ||
		(parsed?.blockId ? String(parsed.blockId) : "");
	const textCandidates = canvasMeta.canvasTextCandidates;
	const sourceNavigationService = new SourceNavigationService(app);
	await sourceNavigationService.openCanvasAndLocate(canvasPath, textCandidates, nodeId, {
		focus: true,
		nodeRect: getCanvasSourceNodeRectFromSourceLink(resumeLink),
	});
	return true;
}

async function openEpubReadingTarget(
	app: App,
	material: ScheduleItem,
	resumeLink: string,
	parsed: ParsedReadingTarget | null
): Promise<boolean> {
	const epubLinkService = new EpubLinkService(app);
	let filePath = parsed?.sourceFilePath || material.sourceFile || "";
	let cfi = parsed?.epubCfi;
	let sourceId = parsed?.epubSourceId;
	let tocHref = parsed?.epubTocHref;

	if (isEpubBookmarkTaskId(material.id)) {
		const epubService = new IREpubBookmarkTaskService(app);
		await epubService.initialize();
		const task = await epubService.getTask(material.id);
		if (!task) {
			return false;
		}

		const resolvedFilePath =
			(await getIrEpubStorageService(app).resolveSourceFilePath(
				String(task.sourceId || "").trim() || undefined,
				String(task.epubFilePath || "").trim() || undefined
			)) || String(task.epubFilePath || "").trim();
		if (!resolvedFilePath) {
			return false;
		}

		const epubFile = app.vault.getAbstractFileByPath(resolvedFilePath);
		if (!(epubFile instanceof TFile)) {
			return false;
		}

		await epubLinkService.navigateToEpubScheduleMaterial(resolvedFilePath, {
			cfi: cfi || task.resumeCfi,
			sourceId: sourceId || task.sourceId,
			tocHref: tocHref || task.tocHref,
			resumeLink,
		});
		return true;
	}

	if (!filePath && !resumeLink.trim()) {
		return false;
	}

	await epubLinkService.navigateToEpubScheduleMaterial(filePath, {
		cfi,
		sourceId,
		tocHref,
		resumeLink,
	});
	return true;
}

async function openEpubBookmarkFallback(app: App, material: ScheduleItem): Promise<boolean> {
	if (!isEpubBookmarkTaskId(material.id)) {
		return false;
	}

	const epubService = new IREpubBookmarkTaskService(app);
	await epubService.initialize();
	const task = await epubService.getTask(material.id);
	if (!task) {
		return false;
	}

	const resolvedFilePath =
		(await getIrEpubStorageService(app).resolveSourceFilePath(
			String(task.sourceId || "").trim() || undefined,
			String(task.epubFilePath || "").trim() || undefined
		)) || String(task.epubFilePath || "").trim();
	if (!resolvedFilePath) {
		return false;
	}

	const epubFile = app.vault.getAbstractFileByPath(resolvedFilePath);
	if (!(epubFile instanceof TFile)) {
		return false;
	}

	const resumeLink = await resolveReadingPointOpenLink(app, material);
	const epubLinkService = new EpubLinkService(app);
	await epubLinkService.navigateToEpubScheduleMaterial(resolvedFilePath, {
		cfi: task.resumeCfi,
		sourceId: task.sourceId,
		tocHref: task.tocHref,
		resumeLink,
	});
	return true;
}

/** 按最新溯源链接打开阅读点；若链接已改为 Vault/PDF/网页等非 EPUB 目标则不走 EPUB 阅读器。 */
export async function openScheduleItemReadingTarget(
	app: App,
	material: ScheduleItem
): Promise<"web" | "native" | "epub" | "none"> {
	const webUrl = resolveScheduleItemWebUrl(app, material);
	if (webUrl) {
		const opened = await openObsidianWebUrl(app, webUrl);
		return opened ? "web" : "none";
	}

	const resumeLink = await resolveReadingPointOpenLink(app, material);
	if (!resumeLink.trim()) {
		return "none";
	}

	const parsed = parseReadingTargetInput(app, resumeLink, material.sourceFile || "");
	if (resolveCanvasFilePath(material, parsed, resumeLink)) {
		return (await openCanvasReadingTarget(app, material, resumeLink, parsed)) ? "native" : "none";
	}

	if (shouldUseNativeReadingTargetNavigation(parsed)) {
		const opened = await openParsedReadingTargetLink(app, parsed, resumeLink);
		return opened ? "native" : "none";
	}

	if (parsed.kind === "epub") {
		return (await openEpubReadingTarget(app, material, resumeLink, parsed)) ? "epub" : "none";
	}

	return "none";
}

/**
 * 尝试按阅读点最新溯源信息打开目标。
 * 返回 true 表示已完成打开；false 表示应回退到旧版源文件恢复/缺失提示逻辑。
 */
export async function tryOpenReadingPointFromScheduleItem(
	app: App,
	material: ScheduleItem
): Promise<boolean> {
	const routed = await openScheduleItemReadingTarget(app, material);
	if (routed === "web" || routed === "native") {
		return true;
	}
	if (routed === "epub") {
		return true;
	}

	if (resolveScheduleItemWebUrl(app, material)) {
		return false;
	}

	const resumeLink = await resolveReadingPointOpenLink(app, material);
	if (resumeLink.trim()) {
		const parsed = parseReadingTargetInput(app, resumeLink, material.sourceFile || "");
		if (shouldUseNativeReadingTargetNavigation(parsed) || parsed.kind === "epub") {
			return false;
		}
	}

	if (await openEpubBookmarkFallback(app, material)) {
		return true;
	}

	return false;
}
