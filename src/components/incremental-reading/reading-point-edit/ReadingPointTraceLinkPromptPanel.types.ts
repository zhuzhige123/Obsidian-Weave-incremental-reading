import type { ParsedReadingTarget } from "../../../services/incremental-reading/reading-target/IRReadingTargetTypes";

export interface ReadingPointTraceLinkPanelState {
	linkInput: string;
	parsedTarget: ParsedReadingTarget | null;
	preserveScheduleOnLinkChange: boolean;
	dirty: boolean;
	canSubmit: boolean;
	previewMarkdown: string;
	previewSourcePath: string;
}
