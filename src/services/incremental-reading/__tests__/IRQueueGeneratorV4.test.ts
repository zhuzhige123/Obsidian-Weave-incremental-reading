/**
 * 增量阅读队列生成器 v4.0 测试
 * 
 * 对齐《增量阅读-算法实施权威规范.md》Section 6
 * 
 * 测试清单：
 * - DRR 公平性测试：不同组占比是否逼近 W_i
 * - 预算控制测试
 * - 尾部碎片处理测试
 */

import { IRQueueGeneratorV4 } from '../IRQueueGeneratorV4';
import { createDefaultIRBlockV4 } from '../../../types/ir-types';
import type { IRBlockV4 } from '../../../types/ir-types';

describe('IRQueueGeneratorV4', () => {
  let generator: IRQueueGeneratorV4;
  
  beforeEach(() => {
    generator = new IRQueueGeneratorV4(40); // 40分钟预算
  });
  
  // 创建测试块
  function createTestBlock(
    id: string,
    groupId: string,
    priorityEff: number = 5,
    estimatedMinutes: number = 2
  ): IRBlockV4 {
    const block = createDefaultIRBlockV4(id, `/test/${groupId}/${id}.md`);
    return {
      ...block,
      status: 'scheduled',
      priorityEff,
      stats: {
        ...block.stats,
        impressions: 1,
        effectiveReadingTimeSec: estimatedMinutes * 60
      }
    };
  }
  
  // ============================================
  // 基础功能测试
  // ============================================
  
  describe('基础功能', () => {
    test('空候选池返回空队列', () => {
      const result = generator.generateQueue([], {});
      
      expect(result.queue.length).toBe(0);
      expect(result.totalEstimatedMinutes).toBe(0);
    });
    
    test('只处理 scheduled 状态的块', () => {
      const blocks: IRBlockV4[] = [
        { ...createTestBlock('1', 'A'), status: 'scheduled' },
        { ...createTestBlock('2', 'A'), status: 'queued' },
        { ...createTestBlock('3', 'A'), status: 'new' }
      ];
      const groupMapping = { '1': 'A', '2': 'A', '3': 'A' };
      
      const result = generator.generateQueue(blocks, groupMapping);
      
      expect(result.stats.candidateCount).toBe(1);
    });
    
    test('按分数排序', () => {
      const blocks: IRBlockV4[] = [
        createTestBlock('low', 'A', 3),
        createTestBlock('high', 'A', 9),
        createTestBlock('mid', 'A', 5)
      ];
      const groupMapping = { 'low': 'A', 'high': 'A', 'mid': 'A' };
      
      const result = generator.generateQueue(blocks, groupMapping);
      
      // 高优先级应该排在前面
      expect(result.queue[0].id).toBe('high');
    });
  });
  
  // ============================================
  // DRR 公平性测试
  // ============================================
  
  describe('DRR 公平分配', () => {
    test('两组均分时各组占比接近 50%', () => {
      // 每组 10 个块，每块 2 分钟
      const blocksA = Array.from({ length: 10 }, (_, i) => 
        createTestBlock(`A${i}`, 'A', 5, 2)
      );
      const blocksB = Array.from({ length: 10 }, (_, i) => 
        createTestBlock(`B${i}`, 'B', 5, 2)
      );
      const blocks = [...blocksA, ...blocksB];
      
      const groupMapping: Record<string, string> = {};
      blocks.forEach(b => {
        groupMapping[b.id] = b.id.startsWith('A') ? 'A' : 'B';
      });
      
      const result = generator.generateQueue(blocks, groupMapping, undefined, 20);
      
      const countA = result.stats.groupDistribution['A'] || 0;
      const countB = result.stats.groupDistribution['B'] || 0;
      const total = countA + countB;
      
      // 允许 ±20% 误差
      expect(countA / total).toBeGreaterThan(0.3);
      expect(countA / total).toBeLessThan(0.7);
      expect(countB / total).toBeGreaterThan(0.3);
      expect(countB / total).toBeLessThan(0.7);
    });
    
    test('单组不会长期垄断', () => {
      // 组 A 有 20 个高优先级块，组 B 有 5 个低优先级块
      const blocksA = Array.from({ length: 20 }, (_, i) => 
        createTestBlock(`A${i}`, 'A', 9, 2)
      );
      const blocksB = Array.from({ length: 5 }, (_, i) => 
        createTestBlock(`B${i}`, 'B', 3, 2)
      );
      const blocks = [...blocksA, ...blocksB];
      
      const groupMapping: Record<string, string> = {};
      blocks.forEach(b => {
        groupMapping[b.id] = b.id.startsWith('A') ? 'A' : 'B';
      });
      
      const result = generator.generateQueue(blocks, groupMapping, undefined, 20);
      
      const countB = result.stats.groupDistribution['B'] || 0;
      
      // B 组应该至少有一些块被选中（DRR 保证公平）
      expect(countB).toBeGreaterThan(0);
    });
    
    test('自定义权重生效', () => {
      const blocksA = Array.from({ length: 10 }, (_, i) => 
        createTestBlock(`A${i}`, 'A', 5, 2)
      );
      const blocksB = Array.from({ length: 10 }, (_, i) => 
        createTestBlock(`B${i}`, 'B', 5, 2)
      );
      const blocks = [...blocksA, ...blocksB];
      
      const groupMapping: Record<string, string> = {};
      blocks.forEach(b => {
        groupMapping[b.id] = b.id.startsWith('A') ? 'A' : 'B';
      });
      
      // A 组权重 70%，B 组权重 30%
      const groupWeights = { 'A': 0.7, 'B': 0.3 };
      
      const result = generator.generateQueue(blocks, groupMapping, groupWeights, 20);
      
      const countA = result.stats.groupDistribution['A'] || 0;
      const countB = result.stats.groupDistribution['B'] || 0;
      
      // A 组应该明显多于 B 组
      expect(countA).toBeGreaterThan(countB);
    });
  });
  
  // ============================================
  // 预算控制测试
  // ============================================
  
  describe('预算控制', () => {
    test('不超过时间预算', () => {
      const blocks = Array.from({ length: 50 }, (_, i) => 
        createTestBlock(`block${i}`, 'A', 5, 5) // 每块 5 分钟
      );
      const groupMapping: Record<string, string> = {};
      blocks.forEach(b => { groupMapping[b.id] = 'A'; });
      
      const result = generator.generateQueue(blocks, groupMapping, undefined, 20);
      
      // 总时间应接近但不大幅超过预算
      expect(result.totalEstimatedMinutes).toBeLessThanOrEqual(25); // 允许轻微超出
    });
    
    test('尾部碎片处理：80% 后允许轻微超出', () => {
      // 10 个块，每块 3 分钟，预算 25 分钟
      // 8 块 = 24 分钟 (96%)，第 9 块会超出但应被允许
      const blocks = Array.from({ length: 10 }, (_, i) => 
        createTestBlock(`block${i}`, 'A', 5, 3)
      );
      const groupMapping: Record<string, string> = {};
      blocks.forEach(b => { groupMapping[b.id] = 'A'; });
      
      const result = generator.generateQueue(blocks, groupMapping, undefined, 25);
      
      // 应该选择 8 或 9 个块
      expect(result.queue.length).toBeGreaterThanOrEqual(8);
    });
  });
  
  // ============================================
  // 过载统计测试
  // ============================================
  
  describe('过载统计', () => {
    test('正常负载不触发过载', () => {
      const blocks = Array.from({ length: 10 }, (_, i) => 
        createTestBlock(`block${i}`, 'A', 5, 2)
      );
      const groupMapping: Record<string, string> = {};
      blocks.forEach(b => { groupMapping[b.id] = 'A'; });
      
      const stats = generator.getOverloadStats(blocks, groupMapping, 40);
      
      // 20 分钟候选 / 40 分钟预算 = 0.5，不算过载
      expect(stats.isOverloaded).toBe(false);
    });
    
    test('超过 1.5 倍预算触发过载', () => {
      const blocks = Array.from({ length: 50 }, (_, i) => 
        createTestBlock(`block${i}`, 'A', 5, 2)
      );
      const groupMapping: Record<string, string> = {};
      blocks.forEach(b => { groupMapping[b.id] = 'A'; });
      
      const stats = generator.getOverloadStats(blocks, groupMapping, 40);
      
      // 100 分钟候选 / 40 分钟预算 = 2.5，触发过载
      expect(stats.isOverloaded).toBe(true);
      expect(stats.overloadRatio).toBeGreaterThan(1.5);
    });
  });
  
  // ============================================
  // 边界情况测试
  // ============================================
  
  describe('边界情况', () => {
    test('单个块超过预算时仍选择', () => {
      const blocks = [createTestBlock('big', 'A', 5, 50)]; // 50 分钟的块
      const groupMapping = { 'big': 'A' };
      
      const result = generator.generateQueue(blocks, groupMapping, undefined, 40);
      
      // 应该选择这个块（尾部碎片处理）
      expect(result.queue.length).toBe(1);
    });
    
    test('多组但其中一组为空', () => {
      const blocks = Array.from({ length: 5 }, (_, i) => 
        createTestBlock(`A${i}`, 'A', 5, 2)
      );
      const groupMapping: Record<string, string> = {};
      blocks.forEach(b => { groupMapping[b.id] = 'A'; });
      
      // B 组没有块
      const groupWeights = { 'A': 0.5, 'B': 0.5 };
      
      const result = generator.generateQueue(blocks, groupMapping, groupWeights, 20);
      
      // 应该正常工作，只从 A 组选择
      expect(result.queue.length).toBeGreaterThan(0);
      expect(result.stats.groupDistribution['B']).toBeUndefined();
    });
  });

  describe('软交错倾向', () => {
    function consecutiveWhileOthersRemain(sequence: string[]): number {
      const remaining = new Map<string, number>();
      sequence.forEach(group => {
        remaining.set(group, (remaining.get(group) || 0) + 1);
      });

      let previous = '';
      let currentRun = 0;
      let worstRun = 0;

      sequence.forEach(group => {
        remaining.set(group, (remaining.get(group) || 1) - 1);
        if (group === previous) {
          currentRun += 1;
        } else {
          currentRun = 1;
          previous = group;
        }

        const alternativesRemain = Array.from(remaining.entries()).some(
          ([otherGroup, count]) => otherGroup !== group && count > 0
        );
        if (alternativesRemain) {
          worstRun = Math.max(worstRun, currentRun);
        }
      });

      return worstRun;
    }

    test('超过软阈值后会倾向切换到其他仍有候选的主题', () => {
      generator.setInterleavePreferences(true, 2);
      const blocks: IRBlockV4[] = [
        createTestBlock('A1', 'A', 5, 1),
        createTestBlock('A2', 'A', 5, 1),
        createTestBlock('A3', 'A', 5, 1),
        createTestBlock('A4', 'A', 5, 1),
        createTestBlock('B1', 'B', 5, 5),
        createTestBlock('B2', 'B', 5, 5),
        createTestBlock('C1', 'C', 5, 5)
      ];
      const groupMapping = Object.fromEntries(blocks.map(block => [block.id, block.meta?.tagGroup || 'default']));

      const result = generator.generateQueue(blocks, groupMapping, undefined, 20);
      const sequence = result.queue.map(block => block.meta?.tagGroup || 'default');

      expect(consecutiveWhileOthersRemain(sequence)).toBeLessThanOrEqual(2);
    });
  });
});
