<script lang="ts">
  import FloatingMenu from '../../ui/FloatingMenu.svelte';
  import type { IRCalendarSelectedDayLoadStats } from '../ir-calendar-sidebar-types';

  interface Props {
    show?: boolean;
    anchor: HTMLElement | null;
    selectedDayLoadStats: IRCalendarSelectedDayLoadStats | null;
    recentSpreadCount: number;
    t: (key: string, vars?: Record<string, string | number>) => string;
    onClose: () => void;
  }

  let {
    show = $bindable(false),
    anchor,
    selectedDayLoadStats,
    recentSpreadCount,
    t,
    onClose,
  }: Props = $props();
</script>

<FloatingMenu
  bind:show
  {anchor}
  placement="bottom-end"
  offset={6}
  {onClose}
  role="dialog"
  class="ir-calendar-day-load-popover"
>
  {#snippet children()}
    {#if selectedDayLoadStats?.enabled}
      <div
        class="day-load-popover-panel"
        class:day-load-popover-panel--warning={selectedDayLoadStats.overloadLevel === 'warning'}
        class:day-load-popover-panel--overloaded={selectedDayLoadStats.overloadLevel === 'overloaded'}
        role="status"
        aria-live="polite"
      >
        <div class="day-load-popover-panel__summary">
          {t('irSidebar.dayLoadSummary', {
            baseline: selectedDayLoadStats.baseline,
            stretch: selectedDayLoadStats.stretchCeiling,
            assigned: selectedDayLoadStats.assignedMinutes,
          })}
        </div>
        <div class="day-load-popover-panel__summary">
          {t('irSidebar.dayLoadCountSummary', {
            assigned: selectedDayLoadStats.assignedCount,
            stretch: selectedDayLoadStats.stretchCount,
            baseline: selectedDayLoadStats.baselineCount,
          })}
        </div>
        {#if recentSpreadCount > 0}
          <div class="day-load-popover-panel__hint">
            {t('irSidebar.dayLoadSpreadNote', { count: recentSpreadCount })}
          </div>
        {/if}
        {#if selectedDayLoadStats.overloadLevel === 'warning'}
          <div class="day-load-popover-panel__hint">{t('irSidebar.dayLoadStretchHint')}</div>
        {:else if selectedDayLoadStats.overloadLevel === 'overloaded'}
          <div class="day-load-popover-panel__hint">{t('irSidebar.dayLoadOverloadedHint')}</div>
        {/if}
      </div>
    {/if}
  {/snippet}
</FloatingMenu>
