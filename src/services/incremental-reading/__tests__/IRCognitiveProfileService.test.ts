import { IRCognitiveProfileService } from '../IRCognitiveProfileService';

describe('IRCognitiveProfileService', () => {
  const service = new IRCognitiveProfileService();

  test('显式目标函数 breakdown 的总分与 computeUtility 保持一致', () => {
    const profile = service.computeProfile({
      scheduleStatus: 'scheduled',
      nextRepDate: Date.now() - 24 * 60 * 60 * 1000,
      manualPriority: 8,
      effectivePriority: 7.5,
      intervalDays: 5,
      estimatedMinutes: 6,
      stats: {
        impressions: 3,
        extracts: 1,
        cardsCreated: 1
      },
      nowMs: Date.now(),
      continuityHint: 1
    });

    const breakdown = service.computeUtilityBreakdown(profile);
    const utility = service.computeUtility(profile);

    expect(breakdown.totalScore).toBe(utility);
  });

  test('负载与波动惩罚升高时，显式目标函数总分会下降', () => {
    const profile = service.computeProfile({
      scheduleStatus: 'scheduled',
      nextRepDate: Date.now(),
      manualPriority: 6,
      effectivePriority: 6,
      intervalDays: 3,
      estimatedMinutes: 5,
      stats: {
        impressions: 2
      },
      nowMs: Date.now(),
      continuityHint: 0
    });

    const relaxed = service.computeUtilityBreakdown(profile, {
      loadRatio: 0.2,
      fatiguePenalty: 0.5,
      volatilityPenalty: 0.5
    });
    const stressed = service.computeUtilityBreakdown(profile, {
      loadRatio: 1.2,
      fatiguePenalty: 3,
      volatilityPenalty: 4
    });

    expect(stressed.totalScore).toBeLessThan(relaxed.totalScore);
    expect(stressed.penalties.load).toBeGreaterThan(relaxed.penalties.load);
    expect(stressed.penalties.volatility).toBeGreaterThan(relaxed.penalties.volatility);
  });

  test('记忆卡优先级信号会提升重要性分数', () => {
    const baseInput = {
      scheduleStatus: 'scheduled' as const,
      nextRepDate: Date.now(),
      manualPriority: 6,
      effectivePriority: 6,
      intervalDays: 3,
      estimatedMinutes: 4,
      stats: {
        impressions: 2
      },
      nowMs: Date.now(),
      continuityHint: 0
    };

    const withoutSignal = service.computeProfile(baseInput);
    const withSignal = service.computeProfile({
      ...baseInput,
      memoryPrioritySignal: 8
    });

    expect(withSignal.memoryPrioritySignalScore).toBe(8);
    expect(withSignal.importanceScore).toBeGreaterThan(withoutSignal.importanceScore);
  });
});
