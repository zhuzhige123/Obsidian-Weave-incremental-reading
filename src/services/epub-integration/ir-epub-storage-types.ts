export interface EpubSourceRegistryEntry {
	sourceId: string;
	filePath: string;
	sourceFingerprint?: string;
	sourceSize?: number;
	sourceMtime?: number;
	lastSeenAt: number;
	lastKnownPath?: string;
}

export interface IrEpubStorageLike {
	ensureSourceIdentity(
		filePath: string,
		options?: { preferredSourceId?: string },
	): Promise<EpubSourceRegistryEntry | null>;
	resolveSourceFilePath(
		sourceId?: string,
		fallbackFilePath?: string,
	): Promise<string | null>;
}
