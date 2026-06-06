import { applyStyleProps } from "./style-props";

export type DocumentBodyChromePatch = {
	overflow?: string;
	userSelect?: string;
	touchAction?: string;
	cursor?: string;
};

/** Apply transient document.body chrome overrides (scroll lock, drag affordances, etc.). */
export function patchDocumentBodyChrome(patch: DocumentBodyChromePatch): void {
	if (typeof document === "undefined") {
		return;
	}
	applyStyleProps(document.body, patch);
}

/** Clear specific document.body chrome overrides. */
export function clearDocumentBodyChrome(keys: (keyof DocumentBodyChromePatch)[]): void {
	if (typeof document === "undefined") {
		return;
	}
	const cleared: DocumentBodyChromePatch = {};
	for (const key of keys) {
		cleared[key] = "";
	}
	applyStyleProps(document.body, cleared);
}
