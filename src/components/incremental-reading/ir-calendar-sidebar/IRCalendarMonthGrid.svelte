<script lang="ts">
  import ObsidianIcon from '../../ui/ObsidianIcon.svelte';
  import type {
    IRCalendarDayVisualState,
    IRCalendarMonthDay,
    IRCalendarWeekdayLabel,
  } from '../ir-calendar-sidebar-types';

  interface Props {
    weekdayLabels: IRCalendarWeekdayLabel[];
    monthDays: IRCalendarMonthDay[];
    today: Date;
    selectedDate: Date;
    isSameDay: (left: Date, right: Date) => boolean;
    getHeatLevel: (date: Date) => number;
    getHeatDots: (date: Date) => number[];
    getCalendarDayVisualState: (date: Date) => IRCalendarDayVisualState;
    getCalendarDayCellTitle: (dayState: IRCalendarDayVisualState) => string;
    onSelectDay: (date: Date) => void;
  }

  let {
    weekdayLabels,
    monthDays,
    today,
    selectedDate,
    isSameDay,
    getHeatLevel,
    getHeatDots,
    getCalendarDayVisualState,
    getCalendarDayCellTitle,
    onSelectDay,
  }: Props = $props();
</script>

<div class="calendar-grid-container">
  <div class="weekdays">
    {#each weekdayLabels as weekday}
      <span class="weekday" class:weekend={weekday.isWeekend}>{weekday.label}</span>
    {/each}
  </div>
  <div class="calendar-grid">
    {#each monthDays as { date, otherMonth }}
      {@const isToday = isSameDay(date, today)}
      {@const isSelected = isSameDay(date, selectedDate)}
      {@const heatLevel = getHeatLevel(date)}
      {@const dayState = getCalendarDayVisualState(date)}
      <button
        class="day-cell"
        class:other-month={otherMonth}
        class:today={isToday}
        class:selected={isSelected}
        class:has-tasks={dayState.hasTasks}
        class:fully-completed={dayState.isFullyCompleted}
        class:partially-completed={dayState.isPartiallyCompleted}
        class:today-pending={dayState.isTodayPending}
        class:overdue-pending={dayState.isOverduePending}
        onclick={() => onSelectDay(date)}
        title={getCalendarDayCellTitle(dayState)}
      >
        <span class="day-surface" aria-hidden="true"></span>
        {#if dayState.isFullyCompleted}
          <span class="day-complete-icon" aria-hidden="true">
            <ObsidianIcon name="check" size={14} />
          </span>
        {:else}
          <span class="day-number">{date.getDate()}</span>
        {/if}
        {#if dayState.hasTasks && !dayState.isFullyCompleted}
          <span
            class="day-status-chip"
            class:neutral={!dayState.isTodayPending && !dayState.isOverduePending}
            class:warn={dayState.isTodayPending}
            class:danger={dayState.isOverduePending}
            aria-hidden="true"
          >
            {#if dayState.isOverduePending}
              <ObsidianIcon name="x" size={10} />
            {:else}
              <span class="day-status-dot"></span>
            {/if}
          </span>
        {/if}
        <span class="heat-dot-row" aria-hidden="true">
          {#each getHeatDots(date) as dotIndex}
            <span class="heat-dot level-{heatLevel}" data-dot-index={dotIndex}></span>
          {/each}
        </span>
      </button>
    {/each}
  </div>
</div>
