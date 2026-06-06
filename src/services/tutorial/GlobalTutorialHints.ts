export const GLOBAL_TUTORIAL_HINT_IDS = {
	CLOZE_INPUT_MODE_SWITCH: "cloze_input_mode_switch",
	SOURCE_BLOCK_BUTTON: "source_block_button",
	RECYCLE_CARD_BUTTON: "recycle_card_button",
} as const;

export type GlobalTutorialHintId =
	typeof GLOBAL_TUTORIAL_HINT_IDS[keyof typeof GLOBAL_TUTORIAL_HINT_IDS];

export type GlobalTutorialHintState = Partial<Record<GlobalTutorialHintId, boolean>>;

type HasTutorialHints = {
	tutorialHints?: GlobalTutorialHintState;
};

export function shouldShowTutorialHint(
	settings: HasTutorialHints | null | undefined,
	hintId: GlobalTutorialHintId
): boolean {
	if (!settings?.tutorialHints) return true;
	return settings.tutorialHints[hintId] !== true;
}

export function markTutorialHintDismissed(
	settings: HasTutorialHints,
	hintId: GlobalTutorialHintId
): void {
	const nextState: GlobalTutorialHintState = {
		...(settings.tutorialHints ?? {}),
	};
	nextState[hintId] = true;
	settings.tutorialHints = nextState;
}
