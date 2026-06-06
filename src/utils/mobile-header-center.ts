export interface HeaderRectLike {
	top: number;
	height: number;
}

export interface HeaderAnchorRectLike {
	top: number;
	bottom: number;
	width: number;
	height: number;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function getMedian(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);

	if (sorted.length % 2 === 1) {
		return sorted[middle];
	}

	return (sorted[middle - 1] + sorted[middle]) / 2;
}

export function computeMobileHeaderCenterTop(
	headerRect: HeaderRectLike,
	anchorRects: HeaderAnchorRectLike[]
): number | null {
	if (!Number.isFinite(headerRect.top) || !Number.isFinite(headerRect.height) || headerRect.height <= 0) {
		return null;
	}

	const centers = anchorRects
		.filter(
			(rect) =>
				Number.isFinite(rect.top) &&
				Number.isFinite(rect.bottom) &&
				Number.isFinite(rect.width) &&
				Number.isFinite(rect.height) &&
				rect.width > 0 &&
				rect.height > 0 &&
				rect.bottom > rect.top
		)
		.map((rect) => (rect.top + rect.bottom) / 2);

	if (centers.length === 0) {
		return null;
	}

	const anchorCenter = getMedian(centers);
	return clamp(anchorCenter - headerRect.top, 0, headerRect.height);
}
