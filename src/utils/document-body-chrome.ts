import { applyStyleProps } from "./style-props";

export type DocumentBodyChromePatch = {
	overflow?: string;
	userSelect?: string;
	touchAction?: string;
	cursor?: string;
};

/** Apply transient activeDocument.body chrome overrides (scroll lock, drag affordances, etc.). */
export function patchDocumentBodyChrome(patch: DocumentBodyChromePatch): void {
	if (typeof document === "undefined") {
		return;
	}
	applyStyleProps(activeDocument.body, patch);
}

/** Clear specific activeDocument.body chrome overrides. */
export function clearDocumentBodyChrome(keys: (keyof DocumentBodyChromePatch)[]): void {
	if (typeof document === "undefined") {
		return;
	}
	const cleared: DocumentBodyChromePatch = {};
	for (const key of keys) {
		cleared[key] = "";
	}
	applyStyleProps(activeDocument.body, cleared);
}
