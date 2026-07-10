import type {
	IRParameterContext,
	IRTraceState,
} from "../../../types/ir-point-storage-types";
import type { ScheduleItemSourceType } from "../IRCalendarScheduleItem";
import type { ParsedReadingTarget } from "../reading-target/IRReadingTargetTypes";

export interface IRReadingPointDuplicateTitleMatch {
	pointId: string;
	title: string;
}

export interface IRReadingPointEditDraft {
	pointId: string;
	sourceType: ScheduleItemSourceType | "unknown";
	kindLabel: string;
	title: string;
	titleManuallyEdited: boolean;
	linkInput: string;
	originalLinkInput: string;
	note: string;
	deckId: string;
	deckName: string;
	priority: number;
	nextRepDate: number;
	tags: string[];
	tagGroupName: string;
	associatedNotePaths: string[];
	isStarred: boolean;
	traceState: IRTraceState | null;
	traceConfidence: number | null;
	lastVerifiedAt: string | null;
	sourceFile: string;
	topicName: string;
	parameterContext: IRParameterContext | null;
	parameterContextOverride: boolean;
	canEditLink: boolean;
	canEditAssociatedNotes: boolean;
	canEditTags: boolean;
}

export interface IRReadingPointEditSaveInput {
	pointId: string;
	sourceType: ScheduleItemSourceType | "unknown";
	sourceFile: string;
	title: string;
	titleManuallyEdited: boolean;
	linkInput: string;
	originalLinkInput: string;
	note: string;
	deckId: string;
	priority: number;
	nextRepDate: number;
	tags: string[];
	associatedNotePaths: string[];
	isStarred: boolean;
	preserveScheduleOnLinkChange: boolean;
	parameterContextOverride: boolean;
	parameterContext: IRParameterContext | null;
	parsedTarget: ParsedReadingTarget | null;
}

export interface IRReadingPointEditSaveResult {
	changed: boolean;
	sourceDocumentPath?: string;
	linkChanged?: boolean;
	savedResumeLink?: string;
}
