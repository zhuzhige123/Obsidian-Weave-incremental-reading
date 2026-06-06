export interface GridTimelineSortableEntry {
	daySortValue: number;
	timestamp: number;
	uuid: string;
}

export function compareGridTimelineEntries(
	a: GridTimelineSortableEntry,
	b: GridTimelineSortableEntry
): number {
	if (a.daySortValue !== b.daySortValue) {
		return b.daySortValue - a.daySortValue;
	}

	// Keep the newest cards first within the same day so progressive rendering
	// does not hide freshly created cards behind older entries from today.
	if (a.timestamp !== b.timestamp) {
		return b.timestamp - a.timestamp;
	}

	return a.uuid.localeCompare(b.uuid);
}
