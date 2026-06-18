import { resolveExternalBookmarkTaskKind } from "../IRLinkedNotePolicy";
import type { IRPointWriteTarget } from "../IRPointWriteService";
import type { ScheduleItem } from "../IRCalendarScheduleItem";

export function resolveScheduleItemWriteTarget(material: ScheduleItem): IRPointWriteTarget {
	const externalKind = resolveExternalBookmarkTaskKind(material);
	return {
		id: material.id,
		kind:
			material.sourceType === "legacy-block"
				? "block"
				: material.sourceType === "chunk"
					? "chunk"
					: externalKind ?? undefined,
		sourceDocumentPath: material.sourceFile || undefined,
	};
}
