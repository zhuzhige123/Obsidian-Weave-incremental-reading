/**
 * IR learning-outcome interop contract.
 *
 * External plugins (Weave main / EPUB reader) report product outcomes here.
 * IR owns queue + schedule signals; it does not own card/excerpt editors.
 *
 * kind semantics:
 * - extract: Weave excerpt/extract artifact (outputKind=extract) or equivalent
 * - memory-card: reviewable memory card
 * - note: permanent / associated vault note
 */

export const IR_LEARNING_OUTCOME_KINDS = [
	"extract",
	"memory-card",
	"note",
] as const;

export type IRLearningOutcomeKind = (typeof IR_LEARNING_OUTCOME_KINDS)[number];

export interface IRLearningOutcomeSourceAnchor {
	sourceFile?: string;
	sourceBlock?: string;
	resumeLink?: string;
}

export interface IRLearningOutcomeInput {
	pointId: string;
	kind: IRLearningOutcomeKind;
	/** Real Weave card uuid for extract / memory-card. */
	artifactId?: string;
	/** Vault note path for note outcomes. */
	notePath?: string;
	/** Outcome weight for stats; defaults to 1. Ignored when already linked. */
	count?: number;
	sourceAnchor?: IRLearningOutcomeSourceAnchor;
}

export type IRLearningOutcomeFailReason =
	| "invalid_input"
	| "point_not_found"
	| "unsupported_kind";

export interface IRLearningOutcomeStatsSnapshot {
	extractCount: number;
	cardCreatedCount: number;
	noteCreatedCount: number;
}

export interface IRLearningOutcomeResult {
	ok: boolean;
	reason?: IRLearningOutcomeFailReason | "noop_already_linked";
	pointId?: string;
	kind?: IRLearningOutcomeKind;
	linkedArtifactId?: string;
	linkedNotePath?: string;
	alreadyLinked?: boolean;
	stats?: IRLearningOutcomeStatsSnapshot;
}

export interface NormalizedIRLearningOutcome {
	pointId: string;
	kind: IRLearningOutcomeKind;
	artifactId: string;
	notePath: string;
	count: number;
	sourceAnchor?: IRLearningOutcomeSourceAnchor;
}

export function isIRLearningOutcomeKind(
	value: unknown,
): value is IRLearningOutcomeKind {
	return (
		typeof value === "string" &&
		(IR_LEARNING_OUTCOME_KINDS as readonly string[]).includes(value)
	);
}

export function normalizeIRLearningOutcomeInput(
	input: IRLearningOutcomeInput | null | undefined,
): NormalizedIRLearningOutcome | null {
	if (!input || typeof input !== "object") {
		return null;
	}

	const pointId = String(input.pointId || "").trim();
	if (!pointId || !isIRLearningOutcomeKind(input.kind)) {
		return null;
	}

	const rawCount = Number(input.count);
	const count =
		Number.isFinite(rawCount) && rawCount > 0 ? Math.floor(rawCount) : 1;

	const artifactId = String(input.artifactId || "").trim();
	const notePath = String(input.notePath || "")
		.trim()
		.replace(/\\/g, "/");

	const sourceFile = String(input.sourceAnchor?.sourceFile || "").trim();
	const sourceBlock = String(input.sourceAnchor?.sourceBlock || "").trim();
	const resumeLink = String(input.sourceAnchor?.resumeLink || "").trim();
	const sourceAnchor =
		sourceFile || sourceBlock || resumeLink
			? {
					...(sourceFile ? { sourceFile } : {}),
					...(sourceBlock ? { sourceBlock } : {}),
					...(resumeLink ? { resumeLink } : {}),
			  }
			: undefined;

	return {
		pointId,
		kind: input.kind,
		artifactId,
		notePath,
		count,
		sourceAnchor,
	};
}

export function resolveOutcomeStatDelta(
	kind: IRLearningOutcomeKind,
	count: number,
): {
	extracts: number;
	cardsCreated: number;
	notesWritten: number;
} {
	const safeCount = Math.max(0, Math.floor(count));
	switch (kind) {
		case "extract":
			return { extracts: safeCount, cardsCreated: 0, notesWritten: 0 };
		case "memory-card":
			return { extracts: 0, cardsCreated: safeCount, notesWritten: 0 };
		case "note":
			return { extracts: 0, cardsCreated: 0, notesWritten: safeCount };
		default:
			return { extracts: 0, cardsCreated: 0, notesWritten: 0 };
	}
}
