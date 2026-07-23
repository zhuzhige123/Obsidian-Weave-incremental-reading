<script lang="ts">
  import { tick } from 'svelte';
  import ObsidianIcon from '../../ui/ObsidianIcon.svelte';
  import {
    getMondayFirstWeekdayIndex,
    type IRCalendarViewMode,
  } from '../ir-calendar-date';
  import type {
    IRCalendarDayVisualState,
    IRCalendarMonthDay,
    IRCalendarWeekdayLabel,
  } from '../ir-calendar-sidebar-types';

  interface Props {
    viewMode?: IRCalendarViewMode;
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
    viewMode = 'full',
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

  let gridEl = $state<HTMLDivElement | null>(null);
  let lastCenteredKey = '';
  let centerGeneration = 0;

  function getDayWeekdayLabel(date: Date): IRCalendarWeekdayLabel | null {
    return weekdayLabels[getMondayFirstWeekdayIndex(date)] ?? null;
  }

  function getSelectedDayKey(): string {
    return `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;
  }

  async function centerSelectedDay(behavior: ScrollBehavior = 'smooth'): Promise<void> {
    if (viewMode !== 'one-row' || !gridEl) {
      return;
    }

    const generation = ++centerGeneration;
    await tick();

    // DOM / mode can change while awaiting (unmount, mode switch, strip rebuild)
    if (generation !== centerGeneration) {
      return;
    }
    const grid = gridEl;
    if (viewMode !== 'one-row' || !grid?.isConnected) {
      return;
    }

    const selectedCell = grid.querySelector<HTMLElement>('.day-cell.selected');
    if (!selectedCell) {
      return;
    }

    const targetLeft =
      selectedCell.offsetLeft - (grid.clientWidth - selectedCell.offsetWidth) / 2;
    grid.scrollTo({
      left: Math.max(0, targetLeft),
      behavior,
    });
  }

  $effect(() => {
    if (viewMode !== 'one-row') {
      lastCenteredKey = '';
      centerGeneration += 1;
      return;
    }

    // Wait until the horizontal strip is bound before claiming a center key.
    if (!gridEl) {
      return;
    }

    const stripStart = monthDays[0]?.date?.getTime() ?? 0;
    const stripEnd = monthDays[monthDays.length - 1]?.date?.getTime() ?? 0;
    const selectedKey = getSelectedDayKey();
    const centerKey = `${viewMode}:${selectedKey}:${stripStart}:${stripEnd}`;
    const shouldAnimate = lastCenteredKey !== '' && lastCenteredKey !== centerKey;
    lastCenteredKey = centerKey;

    void centerSelectedDay(shouldAnimate ? 'smooth' : 'auto');
  });
</script>

<div
  class="calendar-grid-container"
  class:is-one-row={viewMode === 'one-row'}
  class:is-two-row={viewMode === 'two-row'}
  class:is-full={viewMode === 'full'}
>
  {#if viewMode !== 'one-row'}
    <div class="weekdays">
      {#each weekdayLabels as weekday}
        <span class="weekday" class:weekend={weekday.isWeekend}>{weekday.label}</span>
      {/each}
    </div>
  {/if}
  <div
    class="calendar-grid"
    class:is-one-row={viewMode === 'one-row'}
    bind:this={gridEl}
  >
    {#each monthDays as { date, otherMonth }}
      {@const isToday = isSameDay(date, today)}
      {@const isSelected = isSameDay(date, selectedDate)}
      {@const heatLevel = getHeatLevel(date)}
      {@const dayState = getCalendarDayVisualState(date)}
      {@const weekday = viewMode === 'one-row' ? getDayWeekdayLabel(date) : null}
      <button
        class="day-cell clickable-icon"
        class:other-month={otherMonth}
        class:today={isToday}
        class:selected={isSelected}
        class:has-tasks={dayState.hasTasks}
        class:fully-completed={dayState.isFullyCompleted}
        class:partially-completed={dayState.isPartiallyCompleted}
        class:today-pending={dayState.isTodayPending}
        class:overdue-pending={dayState.isOverduePending}
        onclick={() => {
          const alreadySelected = isSameDay(date, selectedDate);
          onSelectDay(date);
          if (viewMode === 'one-row' && alreadySelected) {
            void centerSelectedDay('smooth');
          }
        }}
        title={getCalendarDayCellTitle(dayState)}
      >
        <span class="day-surface" aria-hidden="true"></span>
        {#if weekday}
          <span class="day-weekday" class:weekend={weekday.isWeekend} aria-hidden="true">
            {weekday.label}
          </span>
        {/if}
        <span class="day-number">{date.getDate()}</span>
        {#if dayState.isFullyCompleted}
          <span class="day-complete-icon" aria-hidden="true">
            <ObsidianIcon name="check" size={12} />
          </span>
        {:else if dayState.hasTasks}
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
