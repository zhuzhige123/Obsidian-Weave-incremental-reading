/**
 * 增量阅读状态机 v4.0 测试
 * 
 * 对齐《增量阅读-算法实施权威规范.md》Section 3
 * 
 * 测试清单：
 * - 状态机测试：new→queued→scheduled→active→queued/done/suspended
 * - 无效迁移应抛错
 * - active 防并发
 */

import { IRStateMachineV4, InvalidStateTransitionError, isValidTransition } from '../IRStateMachineV4';
import { createDefaultIRBlockV4 } from '../../../types/ir-types';
import type { IRBlockV4 } from '../../../types/ir-types';

describe('IRStateMachineV4', () => {
  let stateMachine: IRStateMachineV4;
  let testBlock: IRBlockV4;
  
  beforeEach(() => {
    stateMachine = new IRStateMachineV4();
    testBlock = createDefaultIRBlockV4('test-001', '/test/file.md', 'block-001');
  });
  
  // ============================================
  // 有效迁移规则测试
  // ============================================
  
  describe('有效状态迁移', () => {
    test('new → queued', () => {
      expect(testBlock.status).toBe('new');
      
      const result = stateMachine.transitionToQueued(testBlock, 1);
      
      expect(result.status).toBe('queued');
      expect(result.intervalDays).toBe(1);
      expect(result.nextRepDate).toBeGreaterThan(0);
    });
    
    test('queued → scheduled (到期时)', () => {
      // 设置为已到期
      const queuedBlock: IRBlockV4 = {
        ...testBlock,
        status: 'queued',
        nextRepDate: Date.now() - 1000 // 1秒前
      };
      
      const result = stateMachine.checkAndTransitionToScheduled(queuedBlock);
      
      expect(result.status).toBe('scheduled');
    });
    
    test('queued 未到期时保持 queued', () => {
      const queuedBlock: IRBlockV4 = {
        ...testBlock,
        status: 'queued',
        nextRepDate: Date.now() + 86400000 // 1天后
      };
      
      const result = stateMachine.checkAndTransitionToScheduled(queuedBlock);
      
      expect(result.status).toBe('queued');
    });
    
    test('scheduled → active', () => {
      const scheduledBlock: IRBlockV4 = {
        ...testBlock,
        status: 'scheduled'
      };
      
      const result = stateMachine.transitionToActive(scheduledBlock);
      
      expect(result.status).toBe('active');
      expect(result.stats.lastShownAt).toBeGreaterThan(0);
      expect(result.stats.impressions).toBe(1);
    });
    
    test('active → queued (Next)', () => {
      const activeBlock: IRBlockV4 = {
        ...testBlock,
        status: 'active',
        intervalDays: 1,
        priorityEff: 5
      };
      
      const result = stateMachine.transitionBackToQueued(activeBlock, 1.5, 1.0);
      
      expect(result.status).toBe('queued');
      expect(result.intervalDays).toBeGreaterThan(1);
      expect(result.nextRepDate).toBeGreaterThan(Date.now());
    });
    
    test('active → done (Dismiss)', () => {
      const activeBlock: IRBlockV4 = {
        ...testBlock,
        status: 'active'
      };
      
      const result = stateMachine.transitionToDone(activeBlock);
      
      expect(result.status).toBe('done');
    });
    
    test('active → suspended (Suspend)', () => {
      const activeBlock: IRBlockV4 = {
        ...testBlock,
        status: 'active'
      };
      
      const result = stateMachine.transitionToSuspended(activeBlock);
      
      expect(result.status).toBe('suspended');
    });
    
    test('suspended → queued (Resume)', () => {
      const suspendedBlock: IRBlockV4 = {
        ...testBlock,
        status: 'suspended'
      };
      
      const result = stateMachine.resumeFromSuspended(suspendedBlock);
      
      expect(result.status).toBe('queued');
      expect(result.nextRepDate).toBeLessThanOrEqual(Date.now());
    });
  });
  
  // ============================================
  // 无效迁移测试
  // ============================================
  
  describe('无效状态迁移应抛错', () => {
    test('new 不能直接到 active', () => {
      expect(() => stateMachine.transitionToActive(testBlock))
        .toThrow(InvalidStateTransitionError);
    });
    
    test('queued 不能直接到 active', () => {
      const queuedBlock: IRBlockV4 = { ...testBlock, status: 'queued' };
      expect(() => stateMachine.transitionToActive(queuedBlock))
        .toThrow(InvalidStateTransitionError);
    });
    
    test('scheduled 不能直接到 done', () => {
      const scheduledBlock: IRBlockV4 = { ...testBlock, status: 'scheduled' };
      expect(() => stateMachine.transitionToDone(scheduledBlock))
        .toThrow(InvalidStateTransitionError);
    });
    
    test('done 不能迁移', () => {
      const doneBlock: IRBlockV4 = { ...testBlock, status: 'done' };
      expect(() => stateMachine.transitionToQueued(doneBlock))
        .toThrow(InvalidStateTransitionError);
    });
  });
  
  // ============================================
  // 迁移规则验证
  // ============================================
  
  describe('isValidTransition', () => {
    test('有效迁移返回 true', () => {
      expect(isValidTransition('new', 'queued')).toBe(true);
      expect(isValidTransition('queued', 'scheduled')).toBe(true);
      expect(isValidTransition('scheduled', 'active')).toBe(true);
      expect(isValidTransition('active', 'queued')).toBe(true);
      expect(isValidTransition('active', 'done')).toBe(true);
      expect(isValidTransition('active', 'suspended')).toBe(true);
      expect(isValidTransition('suspended', 'queued')).toBe(true);
    });
    
    test('无效迁移返回 false', () => {
      expect(isValidTransition('new', 'active')).toBe(false);
      expect(isValidTransition('queued', 'done')).toBe(false);
      expect(isValidTransition('done', 'queued')).toBe(false);
    });
  });
  
  // ============================================
  // 优先级更新测试
  // ============================================
  
  describe('优先级更新（强制理由）', () => {
    test('无理由时抛出错误', () => {
      expect(() => stateMachine.updatePriority(testBlock, 8, ''))
        .toThrow('优先级变更必须提供理由');
    });
    
    test('有理由时正常更新', () => {
      const result = stateMachine.updatePriority(testBlock, 8, '这是重要内容');
      
      expect(result.priorityUi).toBe(8);
      expect(result.priorityEff).toBeGreaterThan(testBlock.priorityEff);
      expect(result.meta.priorityLog.length).toBe(1);
      expect(result.meta.priorityLog[0].reason).toBe('这是重要内容');
    });
    
    test('日志追加不覆盖', () => {
      const block1 = stateMachine.updatePriority(testBlock, 7, '第一次调整');
      const block2 = stateMachine.updatePriority(block1, 9, '第二次调整');
      
      expect(block2.meta.priorityLog.length).toBe(2);
    });
  });
  
  // ============================================
  // 统计更新测试
  // ============================================
  
  describe('统计更新', () => {
    test('累加阅读时长', () => {
      const result = stateMachine.updateStats(testBlock, 60, 55, 1, 1, 0);
      
      expect(result.stats.totalReadingTimeSec).toBe(60);
      expect(result.stats.effectiveReadingTimeSec).toBe(55);
      expect(result.stats.extracts).toBe(1);
      expect(result.stats.cardsCreated).toBe(1);
    });
  });
  
  // ============================================
  // 辅助方法测试
  // ============================================
  
  describe('辅助方法', () => {
    test('获取候选池', () => {
      const blocks: IRBlockV4[] = [
        { ...testBlock, id: '1', status: 'new' },
        { ...testBlock, id: '2', status: 'scheduled' },
        { ...testBlock, id: '3', status: 'scheduled' },
        { ...testBlock, id: '4', status: 'active' }
      ];
      
      const candidates = stateMachine.getCandidatePool(blocks);
      
      expect(candidates.length).toBe(2);
      expect(candidates.every(b => b.status === 'scheduled')).toBe(true);
    });
    
    test('检查是否有活跃块', () => {
      const blocksWithActive: IRBlockV4[] = [
        { ...testBlock, id: '1', status: 'scheduled' },
        { ...testBlock, id: '2', status: 'active' }
      ];
      
      const blocksNoActive: IRBlockV4[] = [
        { ...testBlock, id: '1', status: 'scheduled' },
        { ...testBlock, id: '2', status: 'queued' }
      ];
      
      expect(stateMachine.hasActiveBlock(blocksWithActive)).toBe(true);
      expect(stateMachine.hasActiveBlock(blocksNoActive)).toBe(false);
    });
    
    test('批量检查 scheduled 迁移', () => {
      const now = Date.now();
      const blocks: IRBlockV4[] = [
        { ...testBlock, id: '1', status: 'queued', nextRepDate: now - 1000 },
        { ...testBlock, id: '2', status: 'queued', nextRepDate: now + 86400000 },
        { ...testBlock, id: '3', status: 'new' }
      ];
      
      const results = stateMachine.batchCheckScheduled(blocks);
      
      expect(results[0].status).toBe('scheduled'); // 已到期
      expect(results[1].status).toBe('queued');    // 未到期
      expect(results[2].status).toBe('new');       // 不变
    });
  });
  
  // ============================================
  // 不变量测试
  // ============================================
  
  describe('不变量', () => {
    test('nextRepDate 单调更新（不回退）', () => {
      const activeBlock: IRBlockV4 = {
        ...testBlock,
        status: 'active',
        intervalDays: 1,
        priorityEff: 5,
        nextRepDate: Date.now() + 86400000 // 未来 1 天
      };
      
      const result = stateMachine.transitionBackToQueued(activeBlock);
      
      // nextRepDate 应该 >= now
      expect(result.nextRepDate).toBeGreaterThanOrEqual(Date.now());
    });
    
    test('intervalDays 始终满足 [1, 3650]', () => {
      // 高优先级 → 间隔可能缩短，但不低于 1
      const activeBlock: IRBlockV4 = {
        ...testBlock,
        status: 'active',
        intervalDays: 1,
        priorityEff: 10
      };
      
      const result = stateMachine.transitionBackToQueued(activeBlock, 0.5, 0.5);
      
      expect(result.intervalDays).toBeGreaterThanOrEqual(1);
      expect(result.intervalDays).toBeLessThanOrEqual(3650);
    });
  });
});
