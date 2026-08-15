<script lang="ts">
  import BouncingBallsLoader from '../../ui/BouncingBallsLoader.svelte';
  import ObsidianIcon from '../../ui/ObsidianIcon.svelte';
  import IRCalendarMaterialList from '../IRCalendarMaterialList.svelte';
  import type { ActiveDayReadingListEmptyKind } from '../ir-calendar-selected-date-hydrate';
  import type { IRCalendarMaterialListProps } from '../ir-calendar-sidebar-types';
  import type { ScheduleItem } from '../../../services/incremental-reading/IRCalendarScheduleItem';

  interface Props {
    t: (key: string, vars?: Record<string, string | number>) => string;
    showReadingListLoading: boolean;
    showReadingListProgress: boolean;
    calendarListLoadProgressPercent: number;
    calendarListLoadingMessage: string;
    calendarLoadStageStaleHint: boolean;
    displayedMaterials: ScheduleItem[];
    isSelectedDatePast: boolean;
    selectedHistoryCompletedCount: number;
    hasActiveSearch: boolean;
    unfilteredSelectedMaterials: ScheduleItem[];
    activeReadingTagFilter: string;
    activeDayEmptyKind?: ActiveDayReadingListEmptyKind;
    materialListProps: IRCalendarMaterialListProps;
    onClearSearch: () => void;
    onClearTagFilter: () => void;
    onShowCompletedReadingPoints?: () => void;
  }

  let {
    t,
    showReadingListLoading,
    showReadingListProgress,
    calendarListLoadProgressPercent,
    calendarListLoadingMessage,
    calendarLoadStageStaleHint,
    displayedMaterials,
    isSelectedDatePast,
    selectedHistoryCompletedCount,
    hasActiveSearch,
    unfilteredSelectedMaterials,
    activeReadingTagFilter,
    activeDayEmptyKind = 'none',
    materialListProps,
    onClearSearch,
    onClearTagFilter,
    onShowCompletedReadingPoints,
  }: Props = $props();
</script>

<div class="reading-list">
  {#if showReadingListLoading}
    <div
      class="loading-state loading-state--preparing"
      role={showReadingListProgress ? 'progressbar' : 'status'}
      aria-live="polite"
      aria-valuemin={showReadingListProgress ? 0 : undefined}
      aria-valuemax={showReadingListProgress ? 100 : undefined}
      aria-valuenow={showReadingListProgress ? calendarListLoadProgressPercent : undefined}
      aria-label={calendarListLoadingMessage}
    >
      <BouncingBallsLoader
        compact
        showMessage={false}
        class="loading-state__bounce"
      />
      <span class="loading-state__message">{calendarListLoadingMessage}</span>
      {#if showReadingListProgress}
        <div class="calendar-load-progress loading-state__progress" aria-hidden="true">
          <div
            class="calendar-load-progress__bar"
            style={`width: ${calendarListLoadProgressPercent}%`}
          ></div>
        </div>
        <span class="loading-state__percent">{calendarListLoadProgressPercent}%</span>
      {/if}
      {#if calendarLoadStageStaleHint}
        <span class="loading-state__hint">{t('irSidebar.loadStage.stillWorking')}</span>
      {/if}
    </div>
  {:else if displayedMaterials.length > 0}
    {#if isSelectedDatePast}
      <div class="history-mode-banner" role="note">
        <span class="history-mode-banner__title">
          {t('irSidebar.calendar.historyModeBanner', { completed: selectedHistoryCompletedCount })}
        </span>
        <span class="history-mode-banner__hint">{t('irSidebar.calendar.historyModeHint')}</span>
      </div>
    {/if}
    <IRCalendarMaterialList {...materialListProps} />
  {:else if isSelectedDatePast && !hasActiveSearch}
    <div class="loading-state history-empty-state">
      <ObsidianIcon name="history" size={20} />
      <span>{t('irSidebar.calendar.historyEmpty')}</span>
      <span class="history-empty-state__hint">{t('irSidebar.calendar.historyEmptyHint')}</span>
    </div>
  {:else if hasActiveSearch}
    <div class="loading-state search-empty-state">
      <ObsidianIcon name="search" size={20} />
      <span>{t('irSidebar.calendar.searchNoResults')}</span>
      <button type="button" class="clickable-icon clear-tag-filter-btn" onclick={onClearSearch}>
        {t('irSidebar.calendar.clearSearch')}
      </button>
    </div>
  {:else if unfilteredSelectedMaterials.length > 0 && activeReadingTagFilter}
    <div class="loading-state">
      <ObsidianIcon name="tag" size={20} />
      <span>{t('irSidebar.calendar.tagFilterNoMatch', { tag: activeReadingTagFilter })}</span>
      <button type="button" class="clickable-icon clear-tag-filter-btn" onclick={onClearTagFilter}>
        {t('irSidebar.calendar.clearTagFilter')}
      </button>
    </div>
  {:else if activeDayEmptyKind === 'completed_hidden'}
    <div class="loading-state history-empty-state" role="status">
      <ObsidianIcon name="check-circle" size={20} />
      <span>{t('irSidebar.calendar.completedHiddenEmpty')}</span>
      <span class="history-empty-state__hint">{t('irSidebar.calendar.completedHiddenEmptyHint')}</span>
      {#if onShowCompletedReadingPoints}
        <button
          type="button"
          class="clickable-icon clear-tag-filter-btn"
          onclick={onShowCompletedReadingPoints}
        >
          {t('irSidebar.calendar.showCompletedReadingPoints')}
        </button>
      {/if}
    </div>
  {:else if activeDayEmptyKind === 'day_empty'}
    <div class="loading-state history-empty-state" role="status">
      <ObsidianIcon name="calendar" size={20} />
      <span>{t('irSidebar.calendar.dayEmpty')}</span>
      <span class="history-empty-state__hint">{t('irSidebar.calendar.dayEmptyHint')}</span>
    </div>
  {/if}
</div>
