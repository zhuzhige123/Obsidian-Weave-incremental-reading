import { isHttpUrl } from "../obsidian/obsidian-open-web-url";
import type { IRTraceSourceKind } from "./IRSourceTraceStats";
import { isEpubBookmarkTaskId } from "./IREpubBookmarkTaskService";
import { isPdfBookmarkTaskId } from "./IRPdfBookmarkTaskService";
import { IR_WEB_CHUNK_META_URL_KEY } from "./ir-web-reading-point";

export type IRAnalyticsMaterialType =
	| "md"
	| "canvas"
	| "epub"
	| "pdf"
	| "link"
	| "other";

export const IR_ANALYTICS_MATERIAL_TYPE_ORDER: readonly IRAnalyticsMaterialType[] =
	["md", "canvas", "epub", "pdf", "link", "other"] as const;

export interface IRAnalyticsMaterialTypeInput {
	id: string;
	sourceKind: IRTraceSourceKind;
	sourcePath: string;
	resumeLink?: string;
	webUrl?: string;
}

export interface IRAnalyticsMaterialTypeSlice {
	type: IRAnalyticsMaterialType;
	label: string;
	pointCount: number;
	documentCount: number;
	readingHours: number;
	pointShare: number;
	documentShare: number;
	hoursShare: number;
}

export interface IRAnalyticsMaterialTypeBreakdown {
	totalPoints: number;
	totalDocuments: number;
	totalReadingHours: number;
	slices: IRAnalyticsMaterialTypeSlice[];
}

export interface IRAnalyticsMaterialTypeOutcome {
	type: IRAnalyticsMaterialType;
	label: string;
	readingHours: number;
	extracts: number;
	cardsCreated: number;
	notesWritten: number;
	outcomesPerHour: number;
}

export interface IRAnalyticsMaterialTypeUnit {
	id: string;
	sourceKind: IRTraceSourceKind;
	sourcePath: string;
	sourceDocumentKey: string;
	resumeLink?: string;
	webUrl?: string;
	materialType: IRAnalyticsMaterialType;
	stats: {
		extracts?: number;
		cardsCreated?: number;
		notesWritten?: number;
	};
}

export type IRAnalyticsMaterialTypeCounts = Record<
	IRAnalyticsMaterialType,
	number
>;

export function createEmptyMaterialTypeCounts(): IRAnalyticsMaterialTypeCounts {
	return {
		md: 0,
		canvas: 0,
		epub: 0,
		pdf: 0,
		link: 0,
		other: 0,
	};
}

export function incrementMaterialTypeCount(
	counts: IRAnalyticsMaterialTypeCounts,
	type: IRAnalyticsMaterialType,
	amount = 1,
): void {
	counts[type] += amount;
}

export function getPresentMaterialTypes(
	countsList: Array<Partial<IRAnalyticsMaterialTypeCounts>>,
): IRAnalyticsMaterialType[] {
	const totals = createEmptyMaterialTypeCounts();
	for (const counts of countsList) {
		for (const type of IR_ANALYTICS_MATERIAL_TYPE_ORDER) {
			totals[type] += Number(counts?.[type] || 0);
		}
	}
	return IR_ANALYTICS_MATERIAL_TYPE_ORDER.filter((type) => totals[type] > 0);
}

function round(value: number, digits = 1): number {
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
}

function normalizeShare(value: number, total: number): number {
	if (!Number.isFinite(value) || value <= 0 || total <= 0) {
		return 0;
	}
	return round((value / total) * 100, 1);
}

export function resolveAnalyticsMaterialType(
	input: IRAnalyticsMaterialTypeInput,
): IRAnalyticsMaterialType {
	const resumeLink = String(input.resumeLink || "").trim();
	if (isHttpUrl(resumeLink)) {
		return "link";
	}

	const webUrl = String(input.webUrl || "").trim();
	if (isHttpUrl(webUrl)) {
		return "link";
	}

	const sourcePath = String(input.sourcePath || "")
		.trim()
		.toLowerCase();

	if (
		isPdfBookmarkTaskId(input.id) ||
		input.sourceKind === "pdf" ||
		sourcePath.endsWith(".pdf")
	) {
		return "pdf";
	}

	if (
		isEpubBookmarkTaskId(input.id) ||
		input.sourceKind === "epub" ||
		sourcePath.endsWith(".epub")
	) {
		return "epub";
	}

	if (sourcePath.endsWith(".canvas")) {
		return "canvas";
	}

	if (sourcePath.endsWith(".md") || sourcePath.endsWith(".markdown")) {
		return "md";
	}

	if (input.sourceKind === "markdown") {
		return "md";
	}

	return "other";
}

export function resolveAnalyticsMaterialWebUrl(
	meta?: Record<string, unknown> | null,
): string | undefined {
	if (!meta) {
		return undefined;
	}
	const webUrl = String(meta[IR_WEB_CHUNK_META_URL_KEY] || "").trim();
	return isHttpUrl(webUrl) ? webUrl : undefined;
}

export function buildAnalyticsMaterialTypeBreakdown(input: {
	units: IRAnalyticsMaterialTypeUnit[];
	readingHoursByUnitId: Map<string, number>;
	labelByType: Record<IRAnalyticsMaterialType, string>;
}): IRAnalyticsMaterialTypeBreakdown {
	const pointTotals = new Map<IRAnalyticsMaterialType, number>();
	const documentKeysByType = new Map<IRAnalyticsMaterialType, Set<string>>();
	const readingHoursByType = new Map<IRAnalyticsMaterialType, number>();

	for (const type of IR_ANALYTICS_MATERIAL_TYPE_ORDER) {
		pointTotals.set(type, 0);
		documentKeysByType.set(type, new Set());
		readingHoursByType.set(type, 0);
	}

	for (const unit of input.units) {
		const type = unit.materialType;
		pointTotals.set(type, (pointTotals.get(type) || 0) + 1);
		documentKeysByType.get(type)?.add(unit.sourceDocumentKey);
		readingHoursByType.set(
			type,
			(readingHoursByType.get(type) || 0) +
				(input.readingHoursByUnitId.get(unit.id) || 0),
		);
	}

	const totalPoints = input.units.length;
	const totalDocuments = new Set(
		input.units.map((unit) => unit.sourceDocumentKey),
	).size;
	const totalReadingHours = round(
		Array.from(input.readingHoursByUnitId.values()).reduce(
			(sum, hours) => sum + hours,
			0,
		),
		1,
	);

	const slices = IR_ANALYTICS_MATERIAL_TYPE_ORDER.map((type) => {
		const pointCount = pointTotals.get(type) || 0;
		const documentCount = documentKeysByType.get(type)?.size || 0;
		const readingHours = round(readingHoursByType.get(type) || 0, 1);
		return {
			type,
			label: input.labelByType[type],
			pointCount,
			documentCount,
			readingHours,
			pointShare: normalizeShare(pointCount, totalPoints),
			documentShare: normalizeShare(documentCount, totalDocuments),
			hoursShare: normalizeShare(readingHours, totalReadingHours),
		} satisfies IRAnalyticsMaterialTypeSlice;
	}).filter(
		(slice) =>
			slice.pointCount > 0 ||
			slice.documentCount > 0 ||
			slice.readingHours > 0,
	);

	return {
		totalPoints,
		totalDocuments,
		totalReadingHours,
		slices,
	};
}

export function buildAnalyticsMaterialTypeOutcome(input: {
	units: IRAnalyticsMaterialTypeUnit[];
	readingHoursByUnitId: Map<string, number>;
	labelByType: Record<IRAnalyticsMaterialType, string>;
}): IRAnalyticsMaterialTypeOutcome[] {
	const aggregates = new Map<
		IRAnalyticsMaterialType,
		{
			readingHours: number;
			extracts: number;
			cardsCreated: number;
			notesWritten: number;
		}
	>();

	for (const type of IR_ANALYTICS_MATERIAL_TYPE_ORDER) {
		aggregates.set(type, {
			readingHours: 0,
			extracts: 0,
			cardsCreated: 0,
			notesWritten: 0,
		});
	}

	for (const unit of input.units) {
		const bucket = aggregates.get(unit.materialType);
		if (!bucket) {
			continue;
		}
		bucket.readingHours += input.readingHoursByUnitId.get(unit.id) || 0;
		bucket.extracts += unit.stats.extracts || 0;
		bucket.cardsCreated += unit.stats.cardsCreated || 0;
		bucket.notesWritten += unit.stats.notesWritten || 0;
	}

	return IR_ANALYTICS_MATERIAL_TYPE_ORDER.map((type) => {
		const bucket = aggregates.get(type) || {
			readingHours: 0,
			extracts: 0,
			cardsCreated: 0,
			notesWritten: 0,
		};
		const readingHours = round(bucket.readingHours, 1);
		const totalOutcomes =
			bucket.extracts + bucket.cardsCreated + bucket.notesWritten;
		return {
			type,
			label: input.labelByType[type],
			readingHours,
			extracts: bucket.extracts,
			cardsCreated: bucket.cardsCreated,
			notesWritten: bucket.notesWritten,
			outcomesPerHour:
				readingHours > 0 ? round(totalOutcomes / readingHours, 1) : 0,
		} satisfies IRAnalyticsMaterialTypeOutcome;
	}).filter(
		(item) =>
			item.readingHours > 0 ||
			item.extracts > 0 ||
			item.cardsCreated > 0 ||
			item.notesWritten > 0,
	);
}

export const IR_ANALYTICS_MATERIAL_TYPE_COLORS: Record<
	IRAnalyticsMaterialType,
	number
> = {
	md: 0,
	canvas: 4,
	epub: 1,
	pdf: 2,
	link: 3,
	other: 5,
};

export const IR_ANALYTICS_MATERIAL_TYPE_LABELS_ZH: Record<
	IRAnalyticsMaterialType,
	string
> = {
	md: "Markdown",
	canvas: "Canvas",
	epub: "EPUB",
	pdf: "PDF",
	link: "网页链接",
	other: "其它",
};

export const IR_ANALYTICS_MATERIAL_TYPE_ICONS: Record<
	IRAnalyticsMaterialType,
	string
> = {
	md: "file-text",
	canvas: "layout-grid",
	epub: "book-open",
	pdf: "file",
	link: "globe",
	other: "help-circle",
};
