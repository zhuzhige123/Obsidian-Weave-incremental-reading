import type { ContentBlock } from "../../../types/content-split-types";

export interface MaterialImportTreeNode {
	name: string;
	path: string;
	type: "folder" | "file";
	children: MaterialImportTreeNode[];
	childrenLoaded: boolean;
	hasChildren: boolean;
	expanded: boolean;
	selected: boolean;
	indeterminate: boolean;
	fileCount: number | null;
}

export type WholeFileImportMode = "reference" | "copy";
export type InitialImportOrderingMode =
	| "preserve-source-order"
	| "pure-scheduling";

export interface ImportContentBlock extends ContentBlock {
	sourceFilePath?: string;
	pdfPageNumber?: number;
	epubTocHref?: string;
	epubTocLevel?: number;
	epubSourceId?: string;
	epubBookTitle?: string;
	outlineLevel?: number;
	outlineLabel?: string;
	outlinePath?: string[];
	fallbackWholeFile?: boolean;
}

export interface OutlineSelectionItem {
	id: string;
	type: "pdf" | "epub";
	label: string;
	path: string[];
	level: number;
	filePath: string;
	bookTitle: string;
	pageNumber?: number;
	href?: string;
	sourceId?: string;
	fallbackWholeFile?: boolean;
}

export interface SourceSequenceMeta {
	sourceSequenceGroup: string;
	sourceSequenceOrder: number;
	sourceSequenceLocked: boolean;
	sourceSequenceAnchorDateKey: string;
}
