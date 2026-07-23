<script lang="ts">
  /**
   * IRBlockInfoModal - 增量阅读内容块信息模态窗
   * 
   * 显示内容块的基础信息、学习数据、时间信息等
   * 参考记忆牌组的卡片信息模态窗设计
   * 
   * @module components/incremental-reading/IRBlockInfoModal
   * @version 1.1.0 - 新增计算记录视图
   */
  import type { App } from 'obsidian';
  import type { IRBlock } from '../../types/ir-types';
  import EnhancedIcon from '../ui/EnhancedIcon.svelte';
  import { writeSystemClipboardText } from '../../utils/system-clipboard';
  import { onMount, tick, untrack } from 'svelte';
  import { IRStorageService } from '../../services/incremental-reading/IRStorageService';
  import {
    calculatePsi,
    calculateNextInterval,
    M_BASE,
    I_MIN,
    I_MAX,
    EWMA_ALPHA,
    PRIORITY_NEUTRAL
  } from '../../services/incremental-reading/IRCoreAlgorithmsV4';
  import { buildIRBlockInfoScheduleDisplay } from '../../services/incremental-reading/IRBlockInfoScheduleDisplay';
  import { resolveIRBlockInfoCompletionStats } from '../../services/incremental-reading/IRBlockInfoCompletionStats';
  import {
    getIRPriorityTextColor,
    resolveIRPriorityTier,
  } from '../../services/incremental-reading/IRPriorityDisplay';
  import { currentLanguage, tr } from '../../utils/i18n';

  interface Props {
    block: IRBlock;
    onClose: () => void;
    position?: { x: number; y: number };
    app?: App;
    useObsidianModal?: boolean;
  }

  let { block, onClose, position, app, useObsidianModal = false }: Props = $props();
  let t = $derived($tr);
  let locale = $derived($currentLanguage);

  let modalEl: HTMLDivElement | null = $state(null);
  let left = $state(-9999);
  let top = $state(-9999);

  // 视图状态：'info' | 'json' | 'calc'
  type ViewMode = 'info' | 'json' | 'calc';
  let currentView = $state<ViewMode>('info');

  let totalReadingTimeSeconds = $state<number>(untrack(() => (block as any).totalReadingTime ?? 0));
  let tracedCardCount = $state<number>(
    untrack(() => Number((block as any).tracedCardCount ?? (block as any).stats?.cardsCreated ?? 0) || 0),
  );
  let linkedNoteCount = $state<number>(
    untrack(() => Number((block as any).linkedNoteCount ?? 0) || 0),
  );

  const formattedJson = $derived(JSON.stringify({
    ...block,
    totalReadingTime: totalReadingTimeSeconds,
    tracedCardCount,
    linkedNoteCount,
    stats: (block as any).stats
      ? {
          ...(block as any).stats,
          totalReadingTimeSec: totalReadingTimeSeconds
        }
      : undefined
  }, null, 2));

  async function refreshReadingTimeFromHistory(): Promise<void> {
    if (!app || !block?.id) {
      totalReadingTimeSeconds = (block as any).totalReadingTime ?? 0;
      return;
    }

    try {
      const storage = new IRStorageService(app);
      await storage.initialize();
      const sessions = await storage.getBlockSessions(block.id);
      const historyTotal = sessions.reduce((sum, session) => sum + Math.max(0, Number(session.duration || 0)), 0);
      totalReadingTimeSeconds = historyTotal > 0
        ? historyTotal
        : ((block as any).totalReadingTime ?? 0);
    } catch {
      totalReadingTimeSeconds = (block as any).totalReadingTime ?? 0;
    }
  }

  async function refreshCompletionStats(): Promise<void> {
    const fallbackCardCount = Number((block as any).tracedCardCount ?? 0) || 0;
    const fallbackNoteCount = Number((block as any).linkedNoteCount ?? 0) || 0;

    if (!app) {
      tracedCardCount = fallbackCardCount;
      linkedNoteCount = fallbackNoteCount;
      return;
    }

    try {
      const stats = await resolveIRBlockInfoCompletionStats(app, {
        sourceFilePath: block.filePath,
        sourceType: (block as any).sourceType,
        pointId: block.id,
        linkedNotePath: (block as any).associatedNotePath,
        linkedNotePaths:
          (block as any).associatedNotePaths ||
          (block as any).linkedNotePaths ||
          (block as any).stats?.linkedNotePaths,
        linkedCardIds:
          (block as any).extractedCards ||
          (block as any).linkedCardIds ||
          (block as any).stats?.linkedCardIds,
      });
      tracedCardCount = stats.cardCount;
      linkedNoteCount = stats.linkedNoteCount;
    } catch {
      tracedCardCount = fallbackCardCount;
      linkedNoteCount = fallbackNoteCount;
    }
  }

  function handleKeydown(_e: KeyboardEvent) {
  }

  async function updatePosition() {
    if (!position) return;
    await tick();
    if (!modalEl) return;

    const rect = modalEl.getBoundingClientRect();
    const margin = 12;
    const baseX = position.x;
    const baseY = position.y;

    const desiredLeft = baseX + 12;
    const desiredTop = baseY + 12;

    left = Math.max(margin, Math.min(desiredLeft, window.innerWidth - rect.width - margin));
    top = Math.max(margin, Math.min(desiredTop, window.innerHeight - rect.height - margin));
  }

  onMount(() => {
    void updatePosition();
    void refreshReadingTimeFromHistory();
    void refreshCompletionStats();

    const onKeydownDoc = (_e: KeyboardEvent) => {
    };

    const onPointerDownDoc = (e: PointerEvent) => {
      if (!position) return;
      if (!modalEl) return;
      if (!modalEl.contains(e.target as Node)) {
        onClose();
      }
    };

    const onTimerUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ blockId?: string }>).detail;
      if (!detail?.blockId || detail.blockId === block.id) {
        void refreshReadingTimeFromHistory();
      }
    };

    const onIRDataUpdated = () => {
      void refreshReadingTimeFromHistory();
      void refreshCompletionStats();
    };

    activeDocument.addEventListener('keydown', onKeydownDoc, true);
    activeDocument.addEventListener('pointerdown', onPointerDownDoc, true);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('Weave:ir-timer-updated', onTimerUpdated as EventListener);
    window.addEventListener('Weave:ir-data-updated', onIRDataUpdated);

    return () => {
      activeDocument.removeEventListener('keydown', onKeydownDoc, true);
      activeDocument.removeEventListener('pointerdown', onPointerDownDoc, true);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('Weave:ir-timer-updated', onTimerUpdated as EventListener);
      window.removeEventListener('Weave:ir-data-updated', onIRDataUpdated);
    };
  });

  // ============================================
  // 计算记录相关
  // ============================================

  // 获取当前间隔（兼容不同数据结构）
  const currentInterval = $derived(
    (block as any).intervalDays ?? block.interval ?? 1
  );

  // 获取有效优先级
  const effectivePriority = $derived(
    block.priorityEff ?? block.priorityUi ?? 5
  );

  // 计算变速函数 Ψ(p)
  const psiValue = $derived(calculatePsi(effectivePriority));

  // 模拟下次间隔计算（使用默认参数）
  const mBase = M_BASE;  // 1.5
  const mGroup = 1.0;    // 默认 TagGroup 系数
  const simulatedNextInterval = $derived(
    calculateNextInterval(currentInterval, mBase, mGroup, effectivePriority)
  );

  // 获取磁盘调度到期时间戳（兼容不同数据结构）
  const nextRepTimestamp = $derived(() => {
    if ((block as any).nextRepDate) {
      return (block as any).nextRepDate;
    }
    if (block.nextReview) {
      return new Date(block.nextReview).getTime();
    }
    return null;
  });

  const scheduleDisplay = $derived(
    buildIRBlockInfoScheduleDisplay({
      nextRepDate: nextRepTimestamp(),
      scheduleStatus: block.state ?? (block as any).scheduleStatus,
      reviewCount: block.reviewCount,
      lastReview: block.lastReview,
      manualSchedulePinnedDateKey: (block as any).manualSchedulePinnedDateKey,
      sourceSequenceLocked: (block as any).sourceSequenceLocked,
      sourceSequenceAnchorDateKey: (block as any).sourceSequenceAnchorDateKey,
      committedNextRepDate: (block as any).committedNextRepDate,
    }),
  );

  // 格式化时间戳
  function formatTimestamp(ts: number | null): string {
    if (!ts) return t('irBlockInfo.values.notSet');
    return new Date(ts).toLocaleString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function formatDateKey(dateKey: string | null | undefined): string {
    if (!dateKey) return t('irBlockInfo.values.notSet');
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
    if (!match) return dateKey;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  // 计算从今天到磁盘调度到期的天数
  const daysUntilNextReview = $derived(() => {
    const ts = nextRepTimestamp();
    if (!ts) return null;
    const now = Date.now();
    return (ts - now) / (24 * 60 * 60 * 1000);
  });

  // 获取优先级变更日志（如果存在）
  const priorityLog = $derived(
    (block as any).meta?.priorityLog ?? []
  );

  // 格式化日期时间
  function formatDateTime(dateStr: string | null | undefined): string {
    if (!dateStr) return t('irBlockInfo.values.unknown');
    try {
      const date = new Date(dateStr);
      return date.toLocaleString(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return t('irBlockInfo.values.formatError');
    }
  }

  function formatInterval(days: number | undefined): string {
    if (days === undefined || days === null) return t('irBlockInfo.values.unknown');
    if (days < 1) return t('irBlockInfo.values.lessThanOneDay');
    if (days === 1) return t('irBlockInfo.values.oneDay');
    if (days < 30) return t('irBlockInfo.values.days', { count: Math.round(days) });
    if (days < 365) return t('irBlockInfo.values.months', { count: Math.round(days / 30) });
    return t('irBlockInfo.values.years', { count: Math.round(days / 365) });
  }

  function formatReadingTime(seconds: number | undefined): string {
    if (!seconds || seconds <= 0) return t('irBlockInfo.values.seconds', { count: 0 });
    if (seconds < 60) return t('irBlockInfo.values.seconds', { count: seconds });
    if (seconds < 3600) {
      return t('irBlockInfo.values.minutesSeconds', {
        mins: Math.floor(seconds / 60),
        secs: seconds % 60,
      });
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return t('irBlockInfo.values.hoursMinutes', { hours, mins });
  }

  function getDeckDisplayName(): string {
    return String(
      (block as any).deckName ||
        (block as any).deckId ||
        block.deckPath ||
        '',
    ).trim();
  }

  function getStateText(state: string): string {
    const stateMap: Record<string, string> = {
      new: t('irBlockInfo.states.new'),
      learning: t('irBlockInfo.states.learning'),
      review: t('irBlockInfo.states.review'),
      suspended: t('irBlockInfo.states.suspended'),
      queued: t('irBlockInfo.states.queued'),
      scheduled: t('irBlockInfo.states.scheduled'),
      active: t('irBlockInfo.states.active'),
      done: t('irBlockInfo.states.done'),
    };
    return stateMap[state] || state || t('irBlockInfo.states.unknown');
  }

  function getPriorityText(priority: number | undefined): string {
    if (priority === undefined) return t('irBlockInfo.priority.unset');
    const tier = resolveIRPriorityTier(priority);
    return t(`irBlockInfo.priority.${tier}`);
  }

  function getPriorityColor(priority: number | undefined): string {
    return getIRPriorityTextColor(priority);
  }

  function getRatingText(rating: number | undefined): string {
    if (!rating) return t('irBlockInfo.ratings.unset');
    const ratingMap: Record<number, string> = {
      1: t('irBlockInfo.ratings.ignore'),
      2: t('irBlockInfo.ratings.ok'),
      3: t('irBlockInfo.ratings.clear'),
      4: t('irBlockInfo.ratings.master'),
    };
    return ratingMap[rating] || `${rating}`;
  }

  // 复制JSON到剪贴板
  async function copyJson() {
    await writeSystemClipboardText(formattedJson);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="ir-block-info-backdrop" 
  class:ir-block-info-backdrop--popover={!!position}
  class:ir-block-info-backdrop--obsidian={useObsidianModal}
  onclick={(event) => {
    if (!useObsidianModal && event.target === event.currentTarget) onClose();
  }}
  onkeydown={handleKeydown}
>
  <div 
    class="ir-block-info-container" 
    class:ir-block-info-container--popover={!!position}
    class:ir-block-info-container--obsidian={useObsidianModal}
    bind:this={modalEl}
    style={position ? `left: ${left}px; top: ${top}px;` : undefined}
    role="dialog" 
    tabindex="-1"
    aria-modal={!position && !useObsidianModal}
    aria-label={t('irBlockInfo.dialogLabel')}
  >
    {#if currentView === 'info'}
      <div class="modal-content">
        <section class="info-section">
          <h4 class="section-title">{t('irBlockInfo.sections.basic')}</h4>
          
          <div class="info-row">
            <span class="info-label">{t('irBlockInfo.labels.blockId')}</span>
            <span class="info-value mono" title={block.id}>{block.id.slice(0, 12)}...</span>
          </div>
          
          <div class="info-row">
            <span class="info-label">{t('irBlockInfo.labels.file')}</span>
            <span class="info-value" title={block.filePath}>
              {block.filePath?.split('/').pop() || t('irBlockInfo.values.unknownFile')}
            </span>
          </div>

          {#if getDeckDisplayName()}
          <div class="info-row">
            <span class="info-label">{t('irBlockInfo.labels.deckName')}</span>
            <span
              class="info-value"
              title={(block as any).deckId || block.deckPath || getDeckDisplayName()}
            >
              {getDeckDisplayName()}
            </span>
          </div>
          {/if}

          {#if (block as any).parentPointId}
          <div class="info-row">
            <span class="info-label">{t('irBlockInfo.labels.parentReadingPoint')}</span>
            <span
              class="info-value"
              title={(block as any).parentPointId}
            >
              {(block as any).parentPointTitle || (block as any).parentPointId}
            </span>
          </div>
          {/if}
          
          <div class="info-row">
            <span class="info-label">{t('irBlockInfo.labels.state')}</span>
            <span class="info-value status-badge">{getStateText(block.state)}</span>
          </div>
          
          <div class="info-row">
            <span class="info-label">{t('irBlockInfo.labels.priority')}</span>
            <span class="info-value" style="color: {getPriorityColor(block.priorityUi ?? block.priority)}">
              {block.priorityUi !== undefined ? block.priorityUi.toFixed(1) : block.priority} ({getPriorityText(block.priorityUi ?? block.priority)})
            </span>
          </div>

          {#if block.headingText || (block.headingPath && block.headingPath.length > 0)}
          <div class="info-row">
            <span class="info-label">{t('irBlockInfo.labels.title')}</span>
            <span class="info-value">{block.headingText || block.headingPath?.join(' > ') || t('irBlockInfo.values.noTitle')}</span>
          </div>
          {/if}
        </section>

        <section class="info-section">
          <h4 class="section-title">{t('irBlockInfo.sections.learning')}</h4>
          
          <div class="info-row">
            <span class="info-label">{t('irBlockInfo.labels.currentInterval')}</span>
            <span class="info-value">{formatInterval(block.interval)}</span>
          </div>
          
          <div class="info-row">
            <span class="info-label">{t('irBlockInfo.labels.intervalFactor')}</span>
            <span class="info-value">{block.intervalFactor?.toFixed(2) || '1.50'}</span>
          </div>
          
          <div class="info-row">
            <span class="info-label">{t('irBlockInfo.labels.reviewCount')}</span>
            <span class="info-value">{t('irBlockInfo.values.reviewCountSuffix', { count: block.reviewCount || 0 })}</span>
          </div>

          <div class="info-row">
            <span class="info-label">{t('irBlockInfo.labels.cardCount')}</span>
            <span class="info-value">{t('irBlockInfo.values.reviewCountSuffix', { count: tracedCardCount })}</span>
          </div>

          <div class="info-row">
            <span class="info-label">{t('irBlockInfo.labels.linkedNoteCount')}</span>
            <span class="info-value">{t('irBlockInfo.values.reviewCountSuffix', { count: linkedNoteCount })}</span>
          </div>
          
          <div class="info-row">
            <span class="info-label">{t('irBlockInfo.labels.totalReadingTime')}</span>
            <span class="info-value">{formatReadingTime(totalReadingTimeSeconds)}</span>
          </div>
          
          {#if block.lastRating}
          <div class="info-row">
            <span class="info-label">{t('irBlockInfo.labels.lastRating')}</span>
            <span class="info-value">{getRatingText(block.lastRating)}</span>
          </div>
          {/if}

          {#if block.priorityEff !== undefined}
          <div class="info-row">
            <span class="info-label">{t('irBlockInfo.labels.effectivePriority')}</span>
            <span class="info-value">{block.priorityEff.toFixed(2)}</span>
          </div>
          {/if}
        </section>

        <section class="info-section">
          <h4 class="section-title">{t('irBlockInfo.sections.time')}</h4>
          
          <div class="info-row">
            <span class="info-label">{t('irBlockInfo.labels.createdAt')}</span>
            <span class="info-value">{formatDateTime(block.createdAt)}</span>
          </div>
          
          <div class="info-row">
            <span class="info-label">{t('irBlockInfo.labels.updatedAt')}</span>
            <span class="info-value">{formatDateTime(block.updatedAt)}</span>
          </div>

          <div class="info-row" class:info-row--inline-hint={scheduleDisplay.rolledIntoToday}>
            <span class="info-label">
              <span class="info-label-main">{t('irBlockInfo.labels.listAppearDate')}</span>
              {#if scheduleDisplay.rolledIntoToday && scheduleDisplay.rolledFromDateKey}
                <span class="info-hint">
                  {t('irBlockInfo.labels.listAppearRolledHint', {
                    date: formatDateKey(scheduleDisplay.rolledFromDateKey),
                  })}
                </span>
              {/if}
            </span>
            <span class="info-value">{formatDateKey(scheduleDisplay.listAppearDateKey)}</span>
          </div>

          {#if scheduleDisplay.scheduleAnchorDateKey}
            <div class="info-row">
              <span class="info-label">{t('irBlockInfo.labels.scheduleAnchorDate')}</span>
              <span class="info-value">{formatDateKey(scheduleDisplay.scheduleAnchorDateKey)}</span>
            </div>
          {/if}

          {#if scheduleDisplay.nextReviewPending}
            <div class="info-row">
              <span class="info-label">{t('irBlockInfo.labels.firstSchedule')}</span>
              <span class="info-value">
                {scheduleDisplay.firstScheduleTimestamp
                  ? formatTimestamp(scheduleDisplay.firstScheduleTimestamp)
                  : t('irBlockInfo.values.notSet')}
              </span>
            </div>
            <div class="info-row">
              <span class="info-label">{t('irBlockInfo.labels.nextReview')}</span>
              <span class="info-value">{t('irBlockInfo.labels.nextReviewPending')}</span>
            </div>
          {:else}
            <div class="info-row" class:info-row--inline-hint={scheduleDisplay.nextReviewOverdue}>
              <span class="info-label">
                <span class="info-label-main">{t('irBlockInfo.labels.nextReview')}</span>
                {#if scheduleDisplay.nextReviewOverdue}
                  <span class="info-hint">{t('irBlockInfo.labels.nextReviewOverdueHint')}</span>
                {/if}
              </span>
              <span class="info-value">
                {scheduleDisplay.nextReviewTimestamp
                  ? formatTimestamp(scheduleDisplay.nextReviewTimestamp)
                  : t('irBlockInfo.values.notSet')}
              </span>
            </div>
          {/if}
          
          {#if block.lastReview}
          <div class="info-row">
            <span class="info-label">{t('irBlockInfo.labels.lastReview')}</span>
            <span class="info-value">{formatDateTime(block.lastReview)}</span>
          </div>
          {/if}
          
          {#if block.firstReadAt}
          <div class="info-row">
            <span class="info-label">{t('irBlockInfo.labels.firstRead')}</span>
            <span class="info-value">{formatDateTime(block.firstReadAt)}</span>
          </div>
          {/if}
        </section>

        <section class="info-section">
          <h4 class="section-title">{t('irBlockInfo.sections.source')}</h4>
          
          <div class="info-row">
            <span class="info-label">{t('irBlockInfo.labels.sourceDoc')}</span>
            <span class="info-value link-style" title={block.filePath}>
              {block.filePath || t('irBlockInfo.values.unknown')}
            </span>
          </div>
          
          {#if block.startLine}
          <div class="info-row">
            <span class="info-label">{t('irBlockInfo.labels.lineRange')}</span>
            <span class="info-value">
              {block.startLine}{block.endLine ? ` - ${block.endLine}` : ''}
            </span>
          </div>
          {/if}

          {#if block.tags && block.tags.length > 0}
          <div class="info-row">
            <span class="info-label">{t('irBlockInfo.labels.tags')}</span>
            <span class="info-value tags-list">
              {#each block.tags as tag}
                <span class="tag-item">#{tag}</span>
              {/each}
            </span>
          </div>
          {/if}
        </section>

      </div>

    {:else if currentView === 'calc'}
      <div class="view-nav">
        <button
          type="button"
          class="view-back-btn clickable-icon"
          onclick={() => currentView = 'info'}
          aria-label={t('irBlockInfo.values.backToDetail')}
          title={t('irBlockInfo.values.backToDetail')}
        >
          <EnhancedIcon name="arrow-left" size={16} />
        </button>
      </div>
      
      <div class="modal-content calc-content">
        <section class="info-section">
          <h4 class="section-title">{t('irBlockInfo.sections.formula')}</h4>
          <div class="formula-box">
            <code class="formula">I_next = Clamp(I_curr × M_base × M_group × Ψ(P_eff), I_min, I_max)</code>
          </div>
          <p class="formula-desc">
            {t('irBlockInfo.calc.formulaDesc')}
          </p>
        </section>

        <section class="info-section">
          <h4 class="section-title">{t('irBlockInfo.sections.currentParams')}</h4>
          
          <div class="calc-row">
            <span class="calc-label">{t('irBlockInfo.calc.labels.currentInterval')}</span>
            <span class="calc-value highlight">{formatInterval(currentInterval)}</span>
          </div>
          
          <div class="calc-row">
            <span class="calc-label">{t('irBlockInfo.calc.labels.mBase')}</span>
            <span class="calc-value">{mBase}</span>
          </div>
          
          <div class="calc-row">
            <span class="calc-label">{t('irBlockInfo.calc.labels.mGroup')}</span>
            <span class="calc-value">{mGroup}</span>
          </div>
          
          <div class="calc-row">
            <span class="calc-label">{t('irBlockInfo.calc.labels.pEff')}</span>
            <span class="calc-value highlight">{effectivePriority.toFixed(2)}</span>
          </div>
          
          <div class="calc-row">
            <span class="calc-label">{t('irBlockInfo.calc.labels.psi')}</span>
            <span class="calc-value highlight">{psiValue.toFixed(4)}</span>
          </div>
          
          <div class="calc-row">
            <span class="calc-label">{t('irBlockInfo.calc.labels.minMax')}</span>
            <span class="calc-value">{I_MIN} / {I_MAX}</span>
          </div>
        </section>

        <section class="info-section">
          <h4 class="section-title">{t('irBlockInfo.sections.psiExplain')}</h4>
          <div class="psi-explanation">
            {#if effectivePriority > PRIORITY_NEUTRAL}
              <div class="psi-case high-priority">
                <div class="psi-text">
                  <strong>{t('irBlockInfo.calc.highPriority')}</strong>
                  <p>P_eff = {effectivePriority.toFixed(2)} &gt; 5</p>
                  <p>Ψ = 1.0 - ({effectivePriority.toFixed(2)} - 5) / 5 × 0.6 = <strong>{psiValue.toFixed(4)}</strong></p>
                  <p class="psi-effect">{t('irBlockInfo.calc.highEffect')}</p>
                </div>
              </div>
            {:else if effectivePriority < PRIORITY_NEUTRAL}
              <div class="psi-case low-priority">
                <div class="psi-text">
                  <strong>{t('irBlockInfo.calc.lowPriority')}</strong>
                  <p>P_eff = {effectivePriority.toFixed(2)} &lt; 5</p>
                  <p>Ψ = 1.0 + (5 - {effectivePriority.toFixed(2)}) / 5 × 2.0 = <strong>{psiValue.toFixed(4)}</strong></p>
                  <p class="psi-effect">{t('irBlockInfo.calc.lowEffect')}</p>
                </div>
              </div>
            {:else}
              <div class="psi-case neutral">
                <div class="psi-text">
                  <strong>{t('irBlockInfo.calc.neutralPriority')}</strong>
                  <p>{t('irBlockInfo.calc.neutralPoint')}</p>
                  <p>Ψ = <strong>1.0</strong></p>
                  <p class="psi-effect">{t('irBlockInfo.calc.neutralEffect')}</p>
                </div>
              </div>
            {/if}
          </div>
        </section>

        <section class="info-section">
          <h4 class="section-title">{t('irBlockInfo.sections.calcDemo')}</h4>
          <div class="calc-steps">
            <div class="calc-step">
              <span class="step-num">1</span>
              <span class="step-content">
                {t('irBlockInfo.calc.stepRaw', {
                  interval: currentInterval.toFixed(2),
                  mBase,
                  mGroup,
                  psi: psiValue.toFixed(4),
                })}
              </span>
            </div>
            <div class="calc-step">
              <span class="step-num">2</span>
              <span class="step-content">
                {t('irBlockInfo.calc.stepResult', {
                  value: (currentInterval * mBase * mGroup * psiValue).toFixed(4),
                })}
              </span>
            </div>
            <div class="calc-step">
              <span class="step-num">3</span>
              <span class="step-content">
                {t('irBlockInfo.calc.stepClamp', {
                  min: I_MIN,
                  max: I_MAX,
                  value: simulatedNextInterval.toFixed(2),
                })}
              </span>
            </div>
          </div>
        </section>

        <section class="info-section">
          <h4 class="section-title">{t('irBlockInfo.sections.actualSchedule')}</h4>
          
          <div class="calc-row">
            <span class="calc-label">{t('irBlockInfo.calc.nextReviewTime')}</span>
            <span class="calc-value">{formatTimestamp(nextRepTimestamp())}</span>
          </div>
          
          <div class="calc-row">
            <span class="calc-label">{t('irBlockInfo.calc.daysFromToday')}</span>
            <span class="calc-value" class:overdue={daysUntilNextReview() !== null && daysUntilNextReview()! < 0}>
              {#if daysUntilNextReview() !== null}
                {t('irBlockInfo.values.daysOffset', {
                  value:
                    daysUntilNextReview()! >= 0
                      ? `+${daysUntilNextReview()!.toFixed(2)}`
                      : daysUntilNextReview()!.toFixed(2),
                })}
              {:else}
                {t('irBlockInfo.values.notSet')}
              {/if}
            </span>
          </div>

          <div class="calc-row">
            <span class="calc-label">{t('irBlockInfo.calc.predictedInterval')}</span>
            <span class="calc-value highlight">{formatInterval(simulatedNextInterval)}</span>
          </div>
        </section>

        {#if priorityLog.length > 0}
        <section class="info-section">
          <h4 class="section-title">{t('irBlockInfo.sections.priorityHistory')}</h4>
          <div class="priority-log">
            {#each priorityLog.slice(-5).reverse() as entry}
              <div class="log-entry">
                <div class="log-time">{formatTimestamp(entry.ts)}</div>
                <div class="log-change">
                  <span class="old-p">{entry.oldP.toFixed(1)}</span>
                  <span class="arrow">→</span>
                  <span class="new-p">{entry.newP.toFixed(1)}</span>
                </div>
                <div class="log-reason">{entry.reason}</div>
              </div>
            {/each}
          </div>
        </section>
        {/if}

        <section class="info-section">
          <h4 class="section-title">{t('irBlockInfo.sections.ewma')}</h4>
          <div class="formula-box">
            <code class="formula">P_eff = α × P_ui + (1-α) × P_eff_old</code>
          </div>
          <div class="calc-row">
            <span class="calc-label">{t('irBlockInfo.calc.labels.alpha')}</span>
            <span class="calc-value">{EWMA_ALPHA}</span>
          </div>
          <p class="formula-desc">
            {t('irBlockInfo.calc.ewmaDesc', { percent: (EWMA_ALPHA * 100).toFixed(0) })}
          </p>
        </section>
      </div>

    {:else}
      <div class="view-nav">
        <button
          type="button"
          class="view-back-btn clickable-icon"
          onclick={() => currentView = 'info'}
          aria-label={t('irBlockInfo.values.backToDetail')}
          title={t('irBlockInfo.values.backToDetail')}
        >
          <EnhancedIcon name="arrow-left" size={16} />
        </button>
      </div>
      
      <div class="json-content">
        <div class="json-toolbar">
          <button class="copy-btn" onclick={copyJson}>
            <EnhancedIcon name="copy" size={14} />
            <span>{t('irBlockInfo.values.copy')}</span>
          </button>
        </div>
        <pre class="json-view">{formattedJson}</pre>
      </div>
    {/if}
  </div>
</div>

<style>
  .ir-block-info-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--weave-z-top, 10000);
    animation: fadeIn 0.2s ease-out;
  }

  .ir-block-info-backdrop--popover {
    background: transparent;
    align-items: flex-start;
    justify-content: flex-start;
    pointer-events: none;
  }

  .ir-block-info-backdrop--obsidian {
    position: static;
    inset: auto;
    width: 100%;
    height: 100%;
    background: transparent;
    z-index: auto;
    align-items: stretch;
    justify-content: stretch;
    animation: none;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .ir-block-info-container {
    background: var(--background-primary);
    border-radius: 12px;
    width: 90%;
    max-width: 480px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    animation: slideUp 0.3s ease-out;
  }

  .ir-block-info-container--popover {
    position: fixed;
    width: 480px;
    animation: none;
    pointer-events: auto;
  }

  .ir-block-info-container--obsidian {
    width: 100%;
    max-width: none;
    max-height: none;
    height: 100%;
    border: none;
    border-radius: 0;
    box-shadow: none;
    animation: none;
  }

  @keyframes slideUp {
    from { 
      opacity: 0;
      transform: translateY(20px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }

  .view-nav {
    display: flex;
    align-items: center;
    padding: 10px 16px 0;
  }

  .view-back-btn {
    width: var(--clickable-icon-size, 32px);
    height: var(--clickable-icon-size, 32px);
    padding: 0;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--clickable-icon-radius, 6px);
    background: var(--background-secondary);
    color: var(--text-muted);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }

  .view-back-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
    border-color: color-mix(in srgb, var(--interactive-accent) 30%, var(--background-modifier-border));
  }

  .view-back-btn:focus-visible {
    outline: 2px solid var(--background-modifier-border-focus);
    outline-offset: 1px;
  }

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
  }

  .info-section {
    margin-bottom: 20px;
  }

  .info-section:last-of-type {
    margin-bottom: 0;
  }

  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    margin: 0 0 12px 0;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    min-height: 32px;
  }

  .info-row:not(:last-child) {
    border-bottom: 1px solid var(--background-modifier-border-focus);
  }

  .info-label {
    font-size: 13px;
    color: var(--text-muted);
    flex-shrink: 1;
    min-width: 0;
    max-width: 70%;
  }

  .info-row--inline-hint {
    align-items: flex-start;
    gap: 8px;
  }

  .info-row--inline-hint .info-label {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 6px;
    row-gap: 2px;
    max-width: min(78%, calc(100% - 5.5em));
  }

  .info-label-main {
    flex-shrink: 0;
  }

  .info-value {
    font-size: 13px;
    color: var(--text-normal);
    text-align: right;
    overflow-wrap: anywhere;
    word-break: break-word;
    max-width: 58%;
    flex: 1 1 auto;
    min-width: 0;
  }

  .info-row--inline-hint .info-value {
    margin-left: auto;
    max-width: none;
    flex: 0 0 auto;
  }

  .info-hint {
    font-size: 11px;
    color: var(--text-faint);
    line-height: 1.35;
    min-width: 0;
    flex: 1 1 8em;
  }

  .info-value.mono {
    font-family: var(--font-monospace);
    font-size: 12px;
  }

  .info-value.link-style {
    color: var(--text-accent);
    text-decoration: underline;
    cursor: default;
  }

  .status-badge {
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--background-modifier-hover);
    font-size: 12px;
  }

  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    justify-content: flex-end;
  }

  .tag-item {
    font-size: 11px;
    padding: 2px 6px;
    background: var(--background-modifier-hover);
    border-radius: 3px;
    color: var(--text-muted);
  }

  /* JSON视图样式 */
  .json-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--background-secondary);
  }

  .json-toolbar {
    padding: 8px 16px;
    border-bottom: 1px solid var(--background-modifier-border);
    display: flex;
    justify-content: flex-end;
  }

  .copy-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: var(--background-modifier-hover);
    border: none;
    border-radius: 4px;
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
  }

  .copy-btn:hover {
    background: var(--interactive-accent);
    color: white;
  }

  .json-view {
    flex: 1;
    overflow: auto;
    margin: 0;
    padding: 16px;
    font-family: var(--font-monospace);
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-normal);
    white-space: pre;
    word-wrap: break-word;
  }

  /* ==================== 计算记录视图样式 ==================== */
  .calc-content {
    background: var(--background-primary);
  }

  .formula-box {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 12px;
    overflow-x: auto;
  }

  .formula {
    font-family: var(--font-monospace);
    font-size: 13px;
    color: var(--text-accent);
    white-space: nowrap;
  }

  .formula-desc {
    font-size: 12px;
    color: var(--text-muted);
    margin: 8px 0 0 0;
    line-height: 1.5;
  }

  .calc-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    min-height: 32px;
  }

  .calc-row:not(:last-child) {
    border-bottom: 1px solid var(--background-modifier-border-focus);
  }

  .calc-label {
    font-size: 13px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .calc-value {
    font-size: 13px;
    color: var(--text-normal);
    font-family: var(--font-monospace);
    text-align: right;
  }

  .calc-value.highlight {
    color: var(--text-accent);
    font-weight: 600;
  }

  .calc-value.overdue {
    color: var(--text-error);
  }

  /* 变速函数解释 */
  .psi-explanation {
    background: var(--background-secondary);
    border-radius: 8px;
    padding: 12px;
  }

  .psi-case {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .psi-text {
    flex: 1;
  }

  .psi-text strong {
    display: block;
    margin-bottom: 4px;
    color: var(--text-normal);
  }

  .psi-text p {
    margin: 4px 0;
    font-size: 12px;
    color: var(--text-muted);
    font-family: var(--font-monospace);
  }

  .psi-effect {
    color: var(--text-accent) !important;
    font-family: var(--font-text) !important;
    margin-top: 8px !important;
  }

  .psi-case.high-priority {
    border-left: 3px solid var(--text-warning);
    padding-left: 12px;
  }

  .psi-case.low-priority {
    border-left: 3px solid var(--text-muted);
    padding-left: 12px;
  }

  .psi-case.neutral {
    border-left: 3px solid var(--interactive-accent);
    padding-left: 12px;
  }

  /* 计算步骤 */
  .calc-steps {
    background: var(--background-secondary);
    border-radius: 8px;
    padding: 12px;
  }

  .calc-step {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 8px 0;
  }

  .calc-step:not(:last-child) {
    border-bottom: 1px dashed var(--background-modifier-border);
  }

  .step-num {
    width: 24px;
    height: 24px;
    background: var(--interactive-accent);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .step-content {
    font-size: 13px;
    font-family: var(--font-monospace);
    color: var(--text-normal);
  }

  /* 优先级变更日志 */
  .priority-log {
    background: var(--background-secondary);
    border-radius: 8px;
    padding: 8px;
    max-height: 200px;
    overflow-y: auto;
  }

  .log-entry {
    padding: 8px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .log-entry:last-child {
    border-bottom: none;
  }

  .log-time {
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  .log-change {
    display: flex;
    gap: 8px;
    align-items: center;
    font-family: var(--font-monospace);
    font-size: 13px;
  }

  .old-p {
    color: var(--text-muted);
  }

  .arrow {
    color: var(--text-faint);
  }

  .new-p {
    color: var(--text-accent);
    font-weight: 600;
  }

  .log-reason {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 4px;
    font-style: italic;
  }

  :global(.is-mobile) .ir-block-info-container--popover {
    width: calc(100vw - 24px);
    max-width: calc(100vw - 24px);
    max-height: 80vh;
  }

  :global(.is-mobile) .view-nav {
    padding: 8px 12px 0;
  }

  :global(.is-mobile) .modal-content {
    padding: 12px 14px;
  }

  :global(.is-mobile) .section-title {
    font-size: 12px;
    margin: 0 0 10px 0;
  }

  :global(.is-mobile) .info-row {
    padding: 6px 0;
    min-height: 28px;
  }

  :global(.is-mobile) .info-label,
  :global(.is-mobile) .info-value {
    font-size: 12px;
  }

  :global(.is-mobile) .info-row--inline-hint .info-label {
    max-width: min(82%, calc(100% - 5em));
    column-gap: 4px;
  }

  :global(.is-mobile) .info-hint {
    font-size: 10px;
  }

</style>
