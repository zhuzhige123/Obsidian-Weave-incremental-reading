<script lang="ts">
  import ObsidianIcon from '../../ui/ObsidianIcon.svelte';
  import type { IRCalendarSelectedDayLoadStats } from '../ir-calendar-sidebar-types';

  interface Props {
    t: (key: string, vars?: Record<string, string | number>) => string;
    showDayLoadInfoButton: boolean;
    selectedDayLoadStats: IRCalendarSelectedDayLoadStats | null;
    dayLoadPopoverOpen: boolean;
    showSearchPanel: boolean;
    dayLoadTriggerEl?: HTMLButtonElement | null;
    calendarToolsTriggerEl?: HTMLButtonElement | null;
    onAddReadingTarget: () => void;
    onScanTopics: () => void;
    onToggleDayLoadPopover: (event: MouseEvent) => void;
    onToggleSearchPanel: () => void;
    onShowMonthCalendarToolsMenu: (event: MouseEvent) => void;
  }

  let {
    t,
    showDayLoadInfoButton,
    selectedDayLoadStats,
    dayLoadPopoverOpen,
    showSearchPanel,
    dayLoadTriggerEl = $bindable(null),
    calendarToolsTriggerEl = $bindable(null),
    onAddReadingTarget,
    onScanTopics,
    onToggleDayLoadPopover,
    onToggleSearchPanel,
    onShowMonthCalendarToolsMenu,
  }: Props = $props();
</script>

<div class="calendar-top-tools nav-header" role="toolbar" aria-label={t('irSidebar.calendar.topToolbarAria')}>
  <div class="calendar-top-actions nav-buttons-container">
    <button
      class="calendar-top-action-btn clickable-icon nav-action-button"
      type="button"
      onclick={onAddReadingTarget}
      title={t('irCommands.addReadingTarget')}
      aria-label={t('irCommands.addReadingTarget')}
    >
      <ObsidianIcon name="plus" size="var(--icon-size)" />
    </button>
    <button
      class="calendar-top-action-btn clickable-icon nav-action-button"
      type="button"
      onclick={onScanTopics}
      title={t('irSidebar.calendar.scanTopics')}
      aria-label={t('irSidebar.calendar.scanTopics')}
    >
      <ObsidianIcon name="scan-search" size="var(--icon-size)" />
    </button>
    {#if showDayLoadInfoButton}
      <button
        class="calendar-top-action-btn clickable-icon nav-action-button day-load-trigger-btn"
        class:day-load-trigger-btn--warning={selectedDayLoadStats?.overloadLevel === 'warning'}
        class:day-load-trigger-btn--overloaded={selectedDayLoadStats?.overloadLevel === 'overloaded'}
        type="button"
        bind:this={dayLoadTriggerEl}
        onclick={onToggleDayLoadPopover}
        title={t('irSidebar.calendar.dayLoadInfoTitle')}
        aria-label={t('irSidebar.calendar.dayLoadInfo')}
        aria-expanded={dayLoadPopoverOpen}
        aria-haspopup="dialog"
      >
        <ObsidianIcon name="gauge" size="var(--icon-size)" />
      </button>
    {/if}
    <button
      class="calendar-top-action-btn clickable-icon nav-action-button"
      type="button"
      class:is-active={showSearchPanel}
      onclick={onToggleSearchPanel}
      title={t('irSidebar.calendar.searchMaterials')}
      aria-label={t('irSidebar.calendar.searchMaterials')}
    >
      <ObsidianIcon name="search" size="var(--icon-size)" />
    </button>
    <button
      class="calendar-top-action-btn clickable-icon nav-action-button"
      type="button"
      bind:this={calendarToolsTriggerEl}
      onclick={onShowMonthCalendarToolsMenu}
      title={t('irSidebar.calendar.moreActions')}
      aria-label={t('irSidebar.calendar.moreActions')}
    >
      <ObsidianIcon name="settings" size="var(--icon-size)" />
    </button>
  </div>
</div>
