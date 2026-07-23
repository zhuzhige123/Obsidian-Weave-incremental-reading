<script lang="ts">
  import ObsidianIcon from '../../ui/ObsidianIcon.svelte';
  import { obsidianIcon } from '../../../utils/obsidian-icon-action';
  import type { IRCalendarSelectedDayLoadStats } from '../ir-calendar-sidebar-types';

  interface Props {
    t: (key: string, vars?: Record<string, string | number>) => string;
    showTodayAllDoneHeaderChip: boolean;
    showDayLoadInfoButton: boolean;
    selectedDayLoadStats: IRCalendarSelectedDayLoadStats | null;
    dayLoadPopoverOpen: boolean;
    showSearchPanel: boolean;
    dayLoadTriggerEl?: HTMLButtonElement | null;
    calendarToolsTriggerEl?: HTMLButtonElement | null;
    onAddReadingTarget: () => void;
    onScanTopics: () => void;
    onOpenTutorial: () => void;
    onToggleDayLoadPopover: (event: MouseEvent) => void;
    onToggleSearchPanel: () => void;
    onShowMonthCalendarToolsMenu: (event: MouseEvent) => void;
  }

  let {
    t,
    showTodayAllDoneHeaderChip,
    showDayLoadInfoButton,
    selectedDayLoadStats,
    dayLoadPopoverOpen,
    showSearchPanel,
    dayLoadTriggerEl = $bindable(null),
    calendarToolsTriggerEl = $bindable(null),
    onAddReadingTarget,
    onScanTopics,
    onOpenTutorial,
    onToggleDayLoadPopover,
    onToggleSearchPanel,
    onShowMonthCalendarToolsMenu,
  }: Props = $props();

  let todayCompleteHintPinned = $state(false);
  let todayCompleteChipEl = $state<HTMLButtonElement | null>(null);

  function toggleTodayCompleteHint(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    todayCompleteHintPinned = !todayCompleteHintPinned;
  }

  $effect(() => {
    if (!showTodayAllDoneHeaderChip) {
      todayCompleteHintPinned = false;
    }
  });

  $effect(() => {
    if (!todayCompleteHintPinned) {
      return;
    }

    function handlePointerDown(event: PointerEvent): void {
      const target = event.target;
      if (target instanceof Node && todayCompleteChipEl?.contains(target)) {
        return;
      }
      todayCompleteHintPinned = false;
    }

    activeDocument.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      activeDocument.removeEventListener('pointerdown', handlePointerDown, true);
    };
  });
</script>

<!--
  Match Obsidian file-explorer: nav-header > nav-buttons-container > clickable-icon.nav-action-button,
  with setIcon applied directly on the button (no nested icon span).
-->
<div class="calendar-top-tools nav-header" role="toolbar" aria-label={t('irSidebar.calendar.topToolbarAria')}>
  <div class="nav-buttons-container">
    <button
      class="clickable-icon nav-action-button"
      type="button"
      onclick={onAddReadingTarget}
      title={t('irCommands.addReadingTarget')}
      aria-label={t('irCommands.addReadingTarget')}
      use:obsidianIcon={'plus'}
    ></button>
    <button
      class="clickable-icon nav-action-button"
      type="button"
      onclick={onScanTopics}
      title={t('irSidebar.calendar.scanTopics')}
      aria-label={t('irSidebar.calendar.scanTopics')}
      use:obsidianIcon={'scan-search'}
    ></button>
    {#if showDayLoadInfoButton}
      <button
        class="clickable-icon nav-action-button day-load-trigger-btn"
        class:day-load-trigger-btn--warning={selectedDayLoadStats?.overloadLevel === 'warning'}
        class:day-load-trigger-btn--overloaded={selectedDayLoadStats?.overloadLevel === 'overloaded'}
        type="button"
        bind:this={dayLoadTriggerEl}
        onclick={onToggleDayLoadPopover}
        title={t('irSidebar.calendar.dayLoadInfoTitle')}
        aria-label={t('irSidebar.calendar.dayLoadInfo')}
        aria-expanded={dayLoadPopoverOpen}
        aria-haspopup="dialog"
        use:obsidianIcon={'gauge'}
      ></button>
    {/if}
    <button
      class="clickable-icon nav-action-button"
      type="button"
      class:is-active={showSearchPanel}
      onclick={onToggleSearchPanel}
      title={t('irSidebar.calendar.searchMaterials')}
      aria-label={t('irSidebar.calendar.searchMaterials')}
      use:obsidianIcon={'search'}
    ></button>
    <button
      class="clickable-icon nav-action-button"
      type="button"
      onclick={onOpenTutorial}
      title={t('irSidebar.calendar.openTutorial')}
      aria-label={t('irSidebar.calendar.openTutorial')}
      use:obsidianIcon={'circle-help'}
    ></button>
    <button
      class="clickable-icon nav-action-button"
      type="button"
      bind:this={calendarToolsTriggerEl}
      onclick={onShowMonthCalendarToolsMenu}
      title={t('irSidebar.calendar.moreActions')}
      aria-label={t('irSidebar.calendar.moreActions')}
      use:obsidianIcon={'settings'}
    ></button>
  </div>
  {#if showTodayAllDoneHeaderChip}
    <button
      type="button"
      class="calendar-day-complete-chip clickable-icon"
      class:is-hint-visible={todayCompleteHintPinned}
      bind:this={todayCompleteChipEl}
      aria-label={t('irSidebar.calendar.todayAllDoneShort')}
      aria-describedby="calendar-day-complete-chip-hint"
      aria-expanded={todayCompleteHintPinned}
      onclick={toggleTodayCompleteHint}
    >
      <span
        id="calendar-day-complete-chip-hint"
        class="calendar-day-complete-chip__hint"
        role="tooltip"
      >
        <span class="calendar-day-complete-chip__hint-title">{t('irSidebar.calendar.todayAllDoneShort')}</span>
        <span class="calendar-day-complete-chip__hint-detail">{t('irSidebar.calendar.todayAllDone')}</span>
      </span>
      <ObsidianIcon name="check-circle" size={14} />
    </button>
  {/if}
</div>
