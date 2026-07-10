<script lang="ts">
  import ObsidianIcon from '../../ui/ObsidianIcon.svelte';
  import type { IRCalendarDataPhase } from '../ir-calendar-sidebar-types';

  interface Props {
    t: (key: string, vars?: Record<string, string | number>) => string;
    monthNumber: number;
    monthYear: number;
    activeDeckFilterName: string;
    sourceFilePath: string;
    showTodayAllDoneHeaderChip: boolean;
    showCalendarTools: boolean;
    hasContinueReadingSuggestionOffer: boolean;
    calendarDataPhase: IRCalendarDataPhase;
    continueReadingTriggerEl?: HTMLButtonElement | null;
    onPrevMonth: () => void;
    onNextMonth: () => void;
    onGoToToday: () => void;
    onOpenContinueReadingSuggestions: () => void;
  }

  let {
    t,
    monthNumber,
    monthYear,
    activeDeckFilterName,
    sourceFilePath,
    showTodayAllDoneHeaderChip,
    showCalendarTools,
    hasContinueReadingSuggestionOffer,
    calendarDataPhase,
    continueReadingTriggerEl = $bindable(null),
    onPrevMonth,
    onNextMonth,
    onGoToToday,
    onOpenContinueReadingSuggestions,
  }: Props = $props();
</script>

<div class="calendar-header nav-header">
  <div class="calendar-title-group">
    <span class="month-title">
      <span class="month-title__month">{monthNumber}</span>
      <span class="month-title__year">{monthYear}</span>
    </span>
    {#if activeDeckFilterName}
      <span class="month-focus-topic" title={sourceFilePath || activeDeckFilterName}>
        {t('irSidebar.header.topicPrefix')}：{activeDeckFilterName}
      </span>
    {/if}
  </div>
  <div class="calendar-header-actions">
    <div class="month-nav" aria-label={t('irSidebar.title')}>
      <button
        class="calendar-tool-btn clickable-icon nav-btn"
        type="button"
        onclick={onPrevMonth}
        aria-label={t('irSidebar.header.prevMonth')}
        title={t('irSidebar.header.prevMonth')}
      >
        <ObsidianIcon name="chevron-left" size={14} />
      </button>
      <button class="today-btn clickable-icon" type="button" onclick={onGoToToday} title={t('irSidebar.header.today')}>
        {t('irSidebar.header.today')}
      </button>
      {#if showTodayAllDoneHeaderChip}
        <span
          class="calendar-day-complete-chip"
          role="status"
          aria-live="polite"
          title={t('irSidebar.calendar.todayAllDone')}
        >
          <ObsidianIcon name="check" size={12} />
          <span>{t('irSidebar.calendar.todayAllDoneShort')}</span>
        </span>
      {/if}
      <button
        class="calendar-tool-btn clickable-icon nav-btn"
        type="button"
        onclick={onNextMonth}
        aria-label={t('irSidebar.header.nextMonth')}
        title={t('irSidebar.header.nextMonth')}
      >
        <ObsidianIcon name="chevron-right" size={14} />
      </button>
    </div>
    {#if showCalendarTools}
      <div class="calendar-tools nav-buttons-container" role="toolbar" aria-label={t('irSidebar.title')}>
        {#if hasContinueReadingSuggestionOffer}
          <button
            class="today-btn clickable-icon continue-reading-trigger-btn"
            type="button"
            bind:this={continueReadingTriggerEl}
            onclick={onOpenContinueReadingSuggestions}
            title={t('irSidebar.calendar.openContinueReading')}
            aria-label={t('irSidebar.calendar.openContinueReading')}
          >
            {t('irSidebar.calendar.suggestionsShort')}
          </button>
        {/if}
        {#if calendarDataPhase === 'degraded'}
          <span
            class="calendar-sync-status calendar-sync-status--degraded"
            aria-live="polite"
            title={t('irSidebar.calendar.performanceGuardTitle')}
          >
            <ObsidianIcon name="gauge" size={14} />
            <span class="calendar-sync-status__label">{t('irSidebar.calendar.performanceGuardLabel')}</span>
          </span>
        {:else if calendarDataPhase === 'error_recoverable'}
          <span
            class="calendar-sync-status calendar-sync-status--recoverable"
            aria-live="polite"
            title={t('irSidebar.calendar.backgroundRetryTitle')}
          >
            <ObsidianIcon name="alert-triangle" size={14} />
            <span class="calendar-sync-status__label">{t('irSidebar.calendar.backgroundRetryLabel')}</span>
          </span>
        {/if}
      </div>
    {/if}
  </div>
</div>
