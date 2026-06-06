/**
 * 增量阅读核心算法 v4.0 测试
 * 
 * 对齐《增量阅读-算法实施权威规范.md》Section 10
 * 
 * 测试清单：
 * - EWMA 测试：连续多次调节优先级的收敛性与边界
 * - Gearbox 边界测试：P_eff=0/5/10、I_curr=0/1/1000
 * - 噪音过滤测试：长时间无交互不应抬高投入加成
 */

import {
  calculatePriorityEWMA,
  calculatePriorityEWMATimeAware,
  calculatePsi,
  calculateNextInterval,
  calculateAgeBoost,
  calculateEngageBoost,
  calculateEffectiveReadingTime,
  isLowQualityTime,
  createPriorityLogEntry,
  EWMA_ALPHA,
  M_BASE,
  I_MIN,
  I_MAX,
  PRIORITY_NEUTRAL
} from '../IRCoreAlgorithmsV4';

describe('IRCoreAlgorithmsV4', () => {
  
  // ============================================
  // Section 4.2: EWMA 测试
  // ============================================
  
  describe('EWMA 优先级平滑', () => {
    test('基础 EWMA 计算正确', () => {
      // P_eff = 0.3 * 8 + 0.7 * 5 = 2.4 + 3.5 = 5.9
      const result = calculatePriorityEWMA(8, 5, 0.3);
      expect(result).toBeCloseTo(5.9, 5);
    });
    
    test('初始化时 P_eff = P_ui', () => {
      // 当 P_eff_old = P_ui 时，结果应该接近 P_ui
      const result = calculatePriorityEWMA(7, 7, 0.3);
      expect(result).toBeCloseTo(7, 5);
    });
    
    test('连续多次调节收敛性', () => {
      // 连续设置优先级为 10，应逐渐收敛
      let pEff = 5;
      for (let i = 0; i < 10; i++) {
        pEff = calculatePriorityEWMA(10, pEff, 0.3);
      }
      // 应接近 10
      expect(pEff).toBeGreaterThan(9.5);
    });
    
    test('边界值测试 - 最小值', () => {
      const result = calculatePriorityEWMA(0, 0, 0.3);
      expect(result).toBe(0);
    });
    
    test('边界值测试 - 最大值', () => {
      const result = calculatePriorityEWMA(10, 10, 0.3);
      expect(result).toBe(10);
    });
    
    test('clamp 到 [0, 10] 范围', () => {
      // 极端情况不应超出范围
      const result1 = calculatePriorityEWMA(-5, 0, 0.3);
      expect(result1).toBeGreaterThanOrEqual(0);
      
      const result2 = calculatePriorityEWMA(15, 10, 0.3);
      expect(result2).toBeLessThanOrEqual(10);
    });
  });
  
  // ============================================
  // Section 5.1: 变速函数 Ψ(p) 测试
  // ============================================
  
  describe('变速函数 Ψ(p)', () => {
    test('中性点 p=5 时 Ψ=1.0', () => {
      expect(calculatePsi(5)).toBe(1.0);
    });
    
    test('高优先级 p=10 时 Ψ=0.4', () => {
      // Ψ(10) = 1.0 - (10-5)/5 * 0.6 = 1.0 - 0.6 = 0.4
      expect(calculatePsi(10)).toBeCloseTo(0.4, 5);
    });
    
    test('低优先级 p=0 时 Ψ=3.0', () => {
      // Ψ(0) = 1.0 + (5-0)/5 * 2.0 = 1.0 + 2.0 = 3.0
      expect(calculatePsi(0)).toBeCloseTo(3.0, 5);
    });
    
    test('高优先级范围 p>5 时 Ψ ∈ [0.4, 1.0)', () => {
      expect(calculatePsi(6)).toBeLessThan(1.0);
      expect(calculatePsi(6)).toBeGreaterThan(0.4);
      expect(calculatePsi(9)).toBeGreaterThan(0.4);
    });
    
    test('低优先级范围 p<5 时 Ψ ∈ (1.0, 3.0]', () => {
      expect(calculatePsi(4)).toBeGreaterThan(1.0);
      expect(calculatePsi(4)).toBeLessThan(3.0);
      expect(calculatePsi(1)).toBeLessThan(3.0);
    });
  });
  
  // ============================================
  // Section 5.2: 间隔计算测试
  // ============================================
  
  describe('间隔计算 (Gearbox)', () => {
    test('新块规则：I_curr=0 时 I_next=1', () => {
      const result = calculateNextInterval(0, M_BASE, 1.0, 5);
      expect(result).toBe(I_MIN);
    });
    
    test('中性优先级 p=5 时正常扩张', () => {
      // I_next = 1 * 1.5 * 1.0 * 1.0 = 1.5
      const result = calculateNextInterval(1, 1.5, 1.0, 5);
      expect(result).toBeCloseTo(1.5, 5);
    });
    
    test('高优先级 p=10 时间隔缩短', () => {
      // I_next = 1 * 1.5 * 1.0 * 0.4 = 0.6 → clamp to 1
      const result = calculateNextInterval(1, 1.5, 1.0, 10);
      expect(result).toBe(I_MIN); // 最小间隔
    });
    
    test('低优先级 p=0 时间隔拉长', () => {
      // I_next = 1 * 1.5 * 1.0 * 3.0 = 4.5
      const result = calculateNextInterval(1, 1.5, 1.0, 0);
      expect(result).toBeCloseTo(4.5, 5);
    });
    
    test('边界测试：I_curr=1000, p=0', () => {
      // I_next = 1000 * 1.5 * 1.0 * 3.0 = 4500 → clamp to 3650
      const result = calculateNextInterval(1000, 1.5, 1.0, 0);
      expect(result).toBe(I_MAX);
    });
    
    test('M_group 影响间隔', () => {
      // M_group=2.0 应该让间隔翻倍
      const result1 = calculateNextInterval(1, 1.5, 1.0, 5);
      const result2 = calculateNextInterval(1, 1.5, 2.0, 5);
      expect(result2).toBeCloseTo(result1 * 2, 5);
    });
    
    test('间隔始终满足 [I_min, I_max]', () => {
      // 极端情况
      const result1 = calculateNextInterval(0.001, 0.1, 0.1, 10);
      expect(result1).toBeGreaterThanOrEqual(I_MIN);
      
      const result2 = calculateNextInterval(10000, 10, 10, 0);
      expect(result2).toBeLessThanOrEqual(I_MAX);
    });
  });
  
  // ============================================
  // Section 7.2: Aging 测试
  // ============================================
  
  describe('Aging 防饿死', () => {
    test('刚展示过的块 aging=0', () => {
      const now = Date.now();
      const result = calculateAgeBoost(now);
      expect(result).toBeCloseTo(0, 1);
    });
    
    test('等待 10 天后有明显加成', () => {
      const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
      const result = calculateAgeBoost(tenDaysAgo, 0.1, 2.0);
      // 0.1 * 10 = 1.0
      expect(result).toBeCloseTo(1.0, 1);
    });
    
    test('aging 上限不超过 ageCap', () => {
      const yearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
      const result = calculateAgeBoost(yearAgo, 0.1, 2.0);
      expect(result).toBe(2.0);
    });
    
    test('lastShownAt=0 时返回 0', () => {
      const result = calculateAgeBoost(0);
      expect(result).toBe(0);
    });
  });
  
  // ============================================
  // Section 8: 噪音过滤测试
  // ============================================
  
  describe('有效时长过滤', () => {
    test('正常阅读时长不被截断', () => {
      // 1000字，300字/分 → 预期 200秒
      // 实际 180秒 < 1.5 * 200 = 300秒，不截断
      const result = calculateEffectiveReadingTime(180, 1000, 300, 1.5);
      expect(result).toBe(180);
    });
    
    test('超长时长被截断', () => {
      // 1000字，300字/分 → 预期 200秒
      // 实际 600秒 > 1.5 * 200 = 300秒，截断到 300秒
      const result = calculateEffectiveReadingTime(600, 1000, 300, 1.5);
      expect(result).toBeCloseTo(300, 5);
    });
    
    test('低质量时长检测', () => {
      // 超出 2 倍预期且无产出
      const isLowQuality = isLowQualityTime(500, 1000, 0, 2.0);
      expect(isLowQuality).toBe(true);
      
      // 有产出则不算低质量
      const isLowQuality2 = isLowQualityTime(500, 1000, 1, 2.0);
      expect(isLowQuality2).toBe(false);
    });
  });
  
  // ============================================
  // Section 8.3: 投入加成测试
  // ============================================
  
  describe('投入加成 EngageBoost', () => {
    test('无产出时加成为 0', () => {
      const stats = {
        impressions: 1,
        totalReadingTimeSec: 120,
        effectiveReadingTimeSec: 120,
        extracts: 0,
        cardsCreated: 0,
        notesWritten: 0,
        lastInteraction: Date.now(),
        lastShownAt: Date.now()
      };
      const result = calculateEngageBoost(stats);
      expect(result).toBe(0);
    });
    
    test('高产出有明显加成', () => {
      const stats = {
        impressions: 1,
        totalReadingTimeSec: 60,
        effectiveReadingTimeSec: 60,
        extracts: 2,
        cardsCreated: 1,
        notesWritten: 1,
        lastInteraction: Date.now(),
        lastShownAt: Date.now()
      };
      // outputCount = 4, minutes = 1, rate = 4
      // boost = 1.0 * (4 - 0.2) = 3.8 → clamp to 2.0
      const result = calculateEngageBoost(stats);
      expect(result).toBe(2.0);
    });
    
    test('长时间无交互不应抬高加成', () => {
      const stats = {
        impressions: 10,
        totalReadingTimeSec: 6000, // 100分钟
        effectiveReadingTimeSec: 6000,
        extracts: 1,
        cardsCreated: 0,
        notesWritten: 0,
        lastInteraction: Date.now(),
        lastShownAt: Date.now()
      };
      // outputCount = 1, minutes = 100, rate = 0.01
      // boost = 1.0 * (0.01 - 0.2) = -0.19 → clamp to 0
      const result = calculateEngageBoost(stats);
      expect(result).toBe(0);
    });
  });
  
  // ============================================
  // Section 9.1: 强制理由测试
  // ============================================
  
  describe('强制理由机制', () => {
    test('无理由时抛出错误', () => {
      expect(() => createPriorityLogEntry(5, 8, '')).toThrow();
      expect(() => createPriorityLogEntry(5, 8, '   ')).toThrow();
    });
    
    test('有理由时正常创建日志', () => {
      const entry = createPriorityLogEntry(5, 8, '这是一篇重要论文');
      expect(entry.oldP).toBe(5);
      expect(entry.newP).toBe(8);
      expect(entry.reason).toBe('这是一篇重要论文');
      expect(entry.ts).toBeGreaterThan(0);
    });
  });
});
