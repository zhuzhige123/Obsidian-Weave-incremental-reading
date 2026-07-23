import { i18n } from "../../../utils/i18n";

/**
 * Product maturity for the paragraph reading workbench.
 * Flip to `"stable"` when the workbench is ready for daily use —
 * banner, command label, and view title all follow this single switch.
 */
export type ParagraphWorkbenchMaturity = "experimental" | "stable";

export const PARAGRAPH_WORKBENCH_MATURITY: ParagraphWorkbenchMaturity =
	"experimental";

export function isParagraphWorkbenchExperimental(): boolean {
	return PARAGRAPH_WORKBENCH_MATURITY === "experimental";
}

/** Append the experimental badge when maturity is experimental. */
export function labelParagraphWorkbenchSurface(baseLabel: string): string {
	const trimmed = String(baseLabel ?? "").trim();
	if (!trimmed || !isParagraphWorkbenchExperimental()) {
		return trimmed;
	}
	const badge = i18n.t("irParagraphWorkbench.experimentalBadge");
	return `${trimmed} · ${badge}`;
}
