const WEAVE_VIEW_LEAF_SELECTOR = '.workspace-leaf-content[data-type="weave-view"]';

export function findWeaveViewLeafContent(element: HTMLElement | null): HTMLElement | null {
	if (!(element instanceof HTMLElement)) {
		return null;
	}

	const host = element.closest(WEAVE_VIEW_LEAF_SELECTOR);
	return host instanceof HTMLElement ? host : null;
}

export function hasWeaveMobileNativeHeader(element: HTMLElement | null): boolean {
	return findWeaveViewLeafContent(element)?.dataset.weaveMobileNativeHeader === "true";
}
