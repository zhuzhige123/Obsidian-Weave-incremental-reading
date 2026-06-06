import { resolveDeckNoCardsReason } from '../noCardsReason';

describe('resolveDeckNoCardsReason', () => {
  it('returns empty for a physically empty deck', () => {
    expect(
      resolveDeckNoCardsReason({
        physicalTotalCards: 0,
        isComplete: false,
        learningCards: 0,
        reviewCards: 0,
        newCards: 0,
        learnedNewCardsToday: 0,
        newCardsPerDay: 20
      })
    ).toBe('empty');
  });

  it('returns all-learned when deck-page click finds today already completed', () => {
    expect(
      resolveDeckNoCardsReason({
        physicalTotalCards: 29,
        isComplete: true,
        learningCards: 3,
        reviewCards: 0,
        newCards: 0,
        learnedNewCardsToday: 0,
        newCardsPerDay: 20
      })
    ).toBe('all-learned');
  });

  it('returns all-learned when the daily new-card quota is exhausted', () => {
    expect(
      resolveDeckNoCardsReason({
        physicalTotalCards: 29,
        isComplete: false,
        learningCards: 0,
        reviewCards: 0,
        newCards: 12,
        learnedNewCardsToday: 20,
        newCardsPerDay: 20
      })
    ).toBe('all-learned');
  });

  it('returns no-due when cards exist but none are currently learnable', () => {
    expect(
      resolveDeckNoCardsReason({
        physicalTotalCards: 29,
        isComplete: false,
        learningCards: 0,
        reviewCards: 0,
        newCards: 0,
        learnedNewCardsToday: 0,
        newCardsPerDay: 20
      })
    ).toBe('no-due');
  });
});
