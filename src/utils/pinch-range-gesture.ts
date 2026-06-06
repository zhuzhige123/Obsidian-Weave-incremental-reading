export interface PinchRangeGestureOptions {
	onExpand: () => void;
	onContract: () => void;
	cooldownMs?: number;
	thresholdRatio?: number;
}

function getTouchDistance(first: Touch, second: Touch): number {
	const dx = first.clientX - second.clientX;
	const dy = first.clientY - second.clientY;
	return Math.hypot(dx, dy);
}

export function bindPinchRangeGesture(
	element: HTMLElement,
	options: PinchRangeGestureOptions,
): () => void {
	const thresholdRatio = options.thresholdRatio ?? 0.12;
	const cooldownMs = options.cooldownMs ?? 180;

	let baselineDistance: number | null = null;
	let lastTriggerAt = 0;

	const reset = (): void => {
		baselineDistance = null;
	};

	const handleTouchStart = (event: TouchEvent): void => {
		if (event.touches.length < 2) {
			reset();
			return;
		}

		baselineDistance = getTouchDistance(event.touches[0], event.touches[1]);
	};

	const handleTouchMove = (event: TouchEvent): void => {
		if (event.touches.length < 2 || baselineDistance === null) {
			return;
		}

		event.preventDefault();

		const nextDistance = getTouchDistance(event.touches[0], event.touches[1]);
		if (!Number.isFinite(nextDistance) || nextDistance <= 0 || baselineDistance <= 0) {
			return;
		}

		const ratio = (nextDistance - baselineDistance) / baselineDistance;
		if (Math.abs(ratio) < thresholdRatio) {
			return;
		}

		const now = Date.now();
		if (now - lastTriggerAt < cooldownMs) {
			baselineDistance = nextDistance;
			return;
		}

		lastTriggerAt = now;
		baselineDistance = nextDistance;

		if (ratio > 0) {
			options.onExpand();
			return;
		}

		options.onContract();
	};

	const handleTouchEnd = (event: TouchEvent): void => {
		if (event.touches.length < 2) {
			reset();
			return;
		}

		baselineDistance = getTouchDistance(event.touches[0], event.touches[1]);
	};

	const handleTouchCancel = (): void => {
		reset();
	};

	element.addEventListener('touchstart', handleTouchStart, { passive: false });
	element.addEventListener('touchmove', handleTouchMove, { passive: false });
	element.addEventListener('touchend', handleTouchEnd, { passive: false });
	element.addEventListener('touchcancel', handleTouchCancel, { passive: false });

	return () => {
		element.removeEventListener('touchstart', handleTouchStart);
		element.removeEventListener('touchmove', handleTouchMove);
		element.removeEventListener('touchend', handleTouchEnd);
		element.removeEventListener('touchcancel', handleTouchCancel);
	};
}
