export function resolveInitialReadingTargetDeckId(options: {
	activeDeckId?: string;
	inboxDeckId?: string;
	lastDeckId?: string;
	deckIds: string[];
}): string {
	const candidates = [
		String(options.activeDeckId || "").trim(),
		String(options.inboxDeckId || "").trim(),
		String(options.lastDeckId || "").trim(),
		options.deckIds[0] || "",
	].filter(Boolean);

	for (const candidate of candidates) {
		if (options.deckIds.includes(candidate)) {
			return candidate;
		}
	}
	return options.deckIds[0] || "";
}
