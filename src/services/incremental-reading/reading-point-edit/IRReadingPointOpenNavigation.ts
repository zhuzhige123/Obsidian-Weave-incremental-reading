import { type App, normalizePath } from "obsidian";
import {
	isObsidianProtocolUrl,
	openResumeLink,
	resolveResumeLinkForOpen,
} from "../../obsidian/obsidian-open-protocol-url";
import { openObsidianWebUrl } from "../../obsidian/obsidian-open-web-url";
import { SourceNavigationService } from "../../ui/SourceNavigationService";
import {
	getCanvasNodeIdFromSourceLink,
	getCanvasSourceNodeRectFromSourceLink,
} from "../../ui/canvas-source-locate";
import type { ScheduleItem } from "../IRCalendarScheduleItem";
import { getSharedIRPointStorageService } from "../IRPointStorageService";
import { resolveScheduleItemWebUrl } from "../ir-web-reading-point";
import { parseReadingTargetInput } from "../reading-target/IRReadingTargetParser";
import type { ParsedReadingTarget } from "../reading-target/IRReadingTargetTypes";
import { resolveReadingPointOpenLink } from "./IRReadingPointEditLinkResolver";

export {
	resolveResumeLinkForOpen as resolveLinkTextForOpen,
	openResumeLink as openResolvedResumeLink,
};

function stripWikiLinkForOpen(raw: string): string {
	return resolveResumeLinkForOpen(raw);
}

export function shouldUseNativeReadingTargetNavigation(
	parsed: ParsedReadingTarget | null | undefined,
): boolean {
	if (!parsed || parsed.kind === "unknown") {
		return false;
	}
	if (!parsed.validationError) {
		return true;
	}
	return isObsidianProtocolResumeTarget(parsed);
}

function isObsidianProtocolResumeTarget(parsed: ParsedReadingTarget): boolean {
	if (parsed.kind !== "epub") {
		return false;
	}
	const candidate = resolveResumeLinkForOpen(
		parsed.epubResumeLink || parsed.resumeLink || parsed.rawInput,
	);
	return isObsidianProtocolUrl(candidate);
}

function resolveCanvasFilePath(
	material: ScheduleItem,
	parsed: ParsedReadingTarget | null,
	resumeLink: string,
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
	pointId: string,
): Promise<{ canvasNodeId: string; canvasTextCandidates: string[] }> {
	const pointStorage = getSharedIRPointStorageService(app);
	await pointStorage.initialize();
	const snapshot = await pointStorage.getPointSnapshotById(pointId);
	const metadata = snapshot?.point.metadata || {};
	const canvasNodeId =
		typeof metadata.canvasNodeId === "string"
			? metadata.canvasNodeId.trim()
			: "";
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
	fallbackLink = "",
): Promise<boolean> {
	if (parsed.kind === "web" && parsed.webUrl) {
		return await openObsidianWebUrl(app, parsed.webUrl);
	}

	return openResumeLink(app, parsed.resumeLink || fallbackLink);
}

async function openCanvasReadingTarget(
	app: App,
	material: ScheduleItem,
	resumeLink: string,
	parsed: ParsedReadingTarget | null,
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
	await sourceNavigationService.openCanvasAndLocate(
		canvasPath,
		textCandidates,
		nodeId,
		{
			focus: true,
			nodeRect: getCanvasSourceNodeRectFromSourceLink(resumeLink),
		},
	);
	return true;
}

/** 按最新溯源链接打开阅读点；若链接已改为 Vault/PDF/网页等非 EPUB 目标则不走 EPUB 阅读器。 */
export async function openScheduleItemReadingTarget(
	app: App,
	material: ScheduleItem,
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

	const parsed = parseReadingTargetInput(
		app,
		resumeLink,
		material.sourceFile || "",
	);
	if (resolveCanvasFilePath(material, parsed, resumeLink)) {
		return (await openCanvasReadingTarget(app, material, resumeLink, parsed))
			? "native"
			: "none";
	}

	if (shouldUseNativeReadingTargetNavigation(parsed)) {
		const opened = await openParsedReadingTargetLink(app, parsed, resumeLink);
		if (parsed.kind === "epub") {
			return opened ? "epub" : "none";
		}
		return opened ? "native" : "none";
	}

	return "none";
}

/**
 * 尝试按阅读点最新溯源信息打开目标。
 * 返回 true 表示已完成打开；false 表示应回退到旧版源文件恢复/缺失提示逻辑。
 */
export async function tryOpenReadingPointFromScheduleItem(
	app: App,
	material: ScheduleItem,
): Promise<boolean> {
	const routed = await openScheduleItemReadingTarget(app, material);
	return routed !== "none";
}
