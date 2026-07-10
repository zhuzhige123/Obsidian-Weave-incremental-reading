import { type App, normalizePath } from "obsidian";
import type { IRPointSnapshot } from "../../../types/ir-point-storage-types";
import type { IRBlock } from "../../../types/ir-types";
import type { IRChunkFileData } from "../../../types/ir-types";
import { i18n } from "../../../utils/i18n";
import { buildEpubChapterResumeLink } from "../../epub-integration/epub-chapter-locate";
import type { ScheduleItem } from "../IRCalendarScheduleItem";
import { isEpubBookmarkTaskId } from "../IREpubBookmarkTaskService";
import type { IREpubBookmarkTask } from "../IREpubBookmarkTaskService";
import { isPdfBookmarkTaskId } from "../IRPdfBookmarkTaskService";
import type { IRPdfBookmarkTask } from "../IRPdfBookmarkTaskService";
import { getSharedIRPointStorageService } from "../IRPointStorageService";
import { resolveLegacyBlockResumeLink } from "../paragraph-workbench/paragraph-block-reference";
import type { ParsedReadingTarget } from "../reading-target/IRReadingTargetTypes";

function readChunkResumeLink(
	chunk: IRChunkFileData | null | undefined,
): string {
	const meta = (chunk?.meta || {}) as Record<string, unknown>;
	return typeof meta.resumeLink === "string" ? meta.resumeLink.trim() : "";
}

function readEpubResumeLink(
	task: IREpubBookmarkTask | null | undefined,
): string {
	const meta = (task?.meta || {}) as Record<string, unknown>;
	if (typeof meta.resumeLink === "string" && meta.resumeLink.trim()) {
		return meta.resumeLink.trim();
	}
	return "";
}

function readSnapshotResumeLink(
	app: App,
	snapshot?: IRPointSnapshot | null,
): string {
	const metadata = snapshot?.point.metadata;
	if (metadata && typeof metadata === "object") {
		const resumeLink = metadata.resumeLink;
		if (typeof resumeLink === "string" && resumeLink.trim()) {
			return resumeLink.trim();
		}
	}

	const locator = snapshot?.point.trace?.locator || {};
	if (typeof locator.resumeLink === "string" && locator.resumeLink.trim()) {
		return locator.resumeLink.trim();
	}
	if (snapshot?.point.trace?.locatorType === "epub-chapter") {
		const tocHref =
			typeof locator.tocHref === "string" ? locator.tocHref.trim() : "";
		const sourcePath = String(snapshot.point.source?.path || "").trim();
		if (tocHref && sourcePath) {
			return buildEpubChapterResumeLink(
				app,
				sourcePath,
				tocHref,
				snapshot.point.userData?.title,
				snapshot.point.materialId,
			);
		}
	}
	if (typeof locator.link === "string" && locator.link.trim()) {
		return locator.link.trim();
	}
	return "";
}

export function resolveSavedResumeLink(
	linkInput: string,
	parsedTarget: ParsedReadingTarget | null | undefined,
): string {
	return String(parsedTarget?.resumeLink || linkInput || "").trim();
}

export function resolveReadingPointLinkInputFromParts(
	app: App,
	input: {
		material: ScheduleItem;
		snapshot?: IRPointSnapshot | null;
		pdfTask?: IRPdfBookmarkTask | null;
		epubTask?: IREpubBookmarkTask | null;
		chunk?: IRChunkFileData | null;
		legacyBlock?: IRBlock | null;
	},
): string {
	const { material, snapshot, pdfTask, epubTask, chunk, legacyBlock } = input;

	const snapshotLink = readSnapshotResumeLink(app, snapshot);
	if (snapshotLink) {
		return snapshotLink;
	}

	if (isPdfBookmarkTaskId(material.id)) {
		const rawPdfLink = pdfTask?.link ?? snapshot?.point.trace?.locator?.link;
		const pdfLink = typeof rawPdfLink === "string" ? rawPdfLink.trim() : "";
		if (pdfLink) {
			return pdfLink;
		}
	}

	if (isEpubBookmarkTaskId(material.id)) {
		const epubLink = readEpubResumeLink(epubTask);
		if (epubLink) {
			return epubLink;
		}
		const tocHref = String(epubTask?.tocHref || "").trim();
		const sourcePath = String(
			epubTask?.epubFilePath ||
				snapshot?.point.source?.path ||
				material.sourceFile ||
				"",
		).trim();
		if (tocHref && sourcePath) {
			return buildEpubChapterResumeLink(
				app,
				sourcePath,
				tocHref,
				epubTask?.title || snapshot?.point.userData?.title || material.title,
				epubTask?.sourceId || snapshot?.point.materialId,
			);
		}
		const fallbackSnapshotLink = readSnapshotResumeLink(app, snapshot);
		if (fallbackSnapshotLink) {
			return fallbackSnapshotLink;
		}
	}

	if (chunk) {
		const chunkLink = readChunkResumeLink(chunk);
		if (chunkLink) {
			return chunkLink;
		}
	}

	if (legacyBlock) {
		const legacyLink = resolveLegacyBlockResumeLink(legacyBlock) || "";
		if (legacyLink) {
			return legacyLink;
		}
	}

	if (material.resumeLink?.trim()) {
		return material.resumeLink.trim();
	}

	return normalizePath(material.sourceFile || "");
}

/** 从 points 存储读取最新溯源链接，供月历跳转等场景使用（避免 workspace 投影缓存滞后）。 */
export async function resolveReadingPointOpenLink(
	app: App,
	material: ScheduleItem,
): Promise<string> {
	const projectedResumeLink = String(material.resumeLink || "").trim();
	if (projectedResumeLink) {
		return projectedResumeLink;
	}

	const pointId = String(material.id || "").trim();
	if (!pointId) {
		return normalizePath(material.sourceFile || "");
	}

	const pointStorage = getSharedIRPointStorageService(app);
	await pointStorage.initialize();
	const snapshot = await pointStorage.getPointSnapshotById(pointId);
	const link = resolveReadingPointLinkInputFromParts(app, {
		material,
		snapshot,
	});

	return link || normalizePath(material.sourceFile || "");
}

export function summarizeReadingPointLink(linkInput: string): string {
	const normalized = String(linkInput || "").trim();
	if (!normalized) {
		return i18n.t("irReadingPointEdit.traceLink.notSet");
	}
	if (normalized.length <= 96) {
		return normalized;
	}
	return `${normalized.slice(0, 93)}…`;
}

export function canEditReadingPointLink(material: ScheduleItem): boolean {
	if (material.sourceType === "legacy-block") {
		return true;
	}
	return Boolean(material.resumeLink || material.sourceFile);
}
