import {
  GLOBAL_TUTORIAL_HINT_IDS,
  markTutorialHintDismissed,
  shouldShowTutorialHint,
  type GlobalTutorialHintState
} from '../GlobalTutorialHints';

describe('GlobalTutorialHints', () => {
  it('returns true when hint state is empty', () => {
    const settings: { tutorialHints?: GlobalTutorialHintState } = {};

    expect(
      shouldShowTutorialHint(settings, GLOBAL_TUTORIAL_HINT_IDS.CLOZE_INPUT_MODE_SWITCH)
    ).toBe(true);
  });

  it('returns false after hint is marked as dismissed', () => {
    const settings: { tutorialHints?: GlobalTutorialHintState } = {};

    markTutorialHintDismissed(settings, GLOBAL_TUTORIAL_HINT_IDS.CLOZE_INPUT_MODE_SWITCH);

    expect(
      shouldShowTutorialHint(settings, GLOBAL_TUTORIAL_HINT_IDS.CLOZE_INPUT_MODE_SWITCH)
    ).toBe(false);
  });

  it('keeps other hints unaffected', () => {
    const settings: { tutorialHints?: GlobalTutorialHintState } = {
      tutorialHints: {
        [GLOBAL_TUTORIAL_HINT_IDS.CLOZE_INPUT_MODE_SWITCH]: true
      }
    };

    expect(
      shouldShowTutorialHint(settings, GLOBAL_TUTORIAL_HINT_IDS.CLOZE_INPUT_MODE_SWITCH)
    ).toBe(false);

    expect(
      shouldShowTutorialHint(settings, GLOBAL_TUTORIAL_HINT_IDS.SOURCE_BLOCK_BUTTON)
    ).toBe(true);

    expect(
      shouldShowTutorialHint(settings, GLOBAL_TUTORIAL_HINT_IDS.RECYCLE_CARD_BUTTON)
    ).toBe(true);
  });
});
