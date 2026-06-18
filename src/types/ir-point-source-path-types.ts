export interface IRPointSourcePathScanResult {
	invalidPointCount: number;
	invalidFieldCount: number;
	affectedFileCount: number;
	affectedFiles: Array<{
		absolutePath: string;
		topicId: string;
		topicName: string;
		invalidPointCount: number;
		invalidFieldCount: number;
	}>;
}

export interface IRPointSourcePathNormalizationResult {
	filesUpdated: number;
	pointsRepaired: number;
	pathsCleared: number;
	errors: string[];
}
