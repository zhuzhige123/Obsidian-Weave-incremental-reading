<script lang="ts">
  import ObsidianIcon from '../ui/ObsidianIcon.svelte';
  import { getIRPriorityStyle } from '../../services/incremental-reading/IRPriorityDisplay';
  import type { IRCalendarMaterialListProps } from './ir-calendar-sidebar-types';

  let {
    displayedMaterials,
    hasActiveSearch,
    displayedMaterialDateKeys,
    continuousReadingEnabled,
    expandedMaterialIds,
    loadingSiblings,
    siblingCache,
    processedChunkIds,
    timerBusyBlockId,
    t,
    getDisplayedMaterialDateLabel,
    getScheduleItemDeckName,
    getMaterialExpandButtonLabel,
    getReadingPointTypeIndicator,
    isSourceMissing,
    getParentProgressForMaterial,
    handleMaterialClick,
    openMaterial,
    toggleMaterialExpand,
    handleMaterialContextMenu,
    handleLongPressStart,
    handleLongPressMove,
    handleLongPressEnd,
    openSchedulingMenu,
    hasVisibleAssociatedNote,
    getAssociatedNoteActionLabel,
    getAssociatedNoteActionTooltip,
    handleAssociatedNoteClick,
    isTimerRunningForBlock,
    getDisplayedTimerSeconds,
    getReadingTimerButtonTitle,
    toggleReadingTimer,
    formatCompactTimerDuration,
    formatTimerDuration,
    formatSiblingDueDate,
    batchSelectionMode,
    isBatchSelected,
    toggleBatchSelection,
    readOnlyHistoryMode = false
  }: IRCalendarMaterialListProps = $props();

  function handleBatchCheckboxClick(event: MouseEvent, materialId: string): void {
    event.preventDefault();
    event.stopPropagation();
    toggleBatchSelection(materialId, event);
  }

  function isAutoSubscribedNew(material: { autoSubscribedAt?: string; autoSubscribedBadgeUntil?: string }): boolean {
    const badgeUntil = Date.parse(String(material.autoSubscribedBadgeUntil || ''));
    if (Number.isFinite(badgeUntil)) {
      return badgeUntil > Date.now();
    }
    const autoSubscribedAt = Date.parse(String(material.autoSubscribedAt || ''));
    if (!Number.isFinite(autoSubscribedAt)) {
      return false;
    }
    return Date.now() - autoSubscribedAt <= 3 * 24 * 60 * 60 * 1000;
  }

  function isMaterialScheduleCompleted(materialId: string): boolean {
    return processedChunkIds.has(materialId);
  }

  function getHistoryScheduleCheckboxLabel(materialId: string): string {
    return isMaterialScheduleCompleted(materialId)
      ? t('irSidebar.calendar.historyScheduleCompleted')
      : t('irSidebar.calendar.historySchedulePending');
  }

  function formatParentProgressBadge(progress: {
    percent: number;
  }): string {
    return t('irSidebar.controls.parentProgress', {
      percent: progress.percent
    });
  }
</script>

{#each displayedMaterials as material, index}
  {@const priority = material.priority || 0}
  {@const priorityClass = getIRPriorityStyle(priority).className}
  {@const isExpanded = expandedMaterialIds.has(material.id)}
  {@const isLoadingSibling = loadingSiblings.has(material.id)}
  {@const siblings = siblingCache.get(material.id) || []}
  {@const searchDateLabel = hasActiveSearch ? getDisplayedMaterialDateLabel(material.id, displayedMaterialDateKeys) : ''}
  {@const searchDeckLabel = hasActiveSearch ? getScheduleItemDeckName(material) : ''}
  {@const isBatchSelectedItem = isBatchSelected(material.id)}
  {@const typeIndicator = getReadingPointTypeIndicator(material)}
  {@const parentProgress = getParentProgressForMaterial(material.id)}
  <div class="reading-item-wrapper">
    <div class="reading-item" class:batch-selection-mode={batchSelectionMode} class:batch-selected={isBatchSelectedItem} class:history-readonly={readOnlyHistoryMode}>
      {#if batchSelectionMode && !readOnlyHistoryMode}
        <button
          type="button"
          class="batch-select-checkbox"
          aria-label={t('irSidebar.batch.toggleSelection')}
          aria-pressed={isBatchSelectedItem}
          onclick={(event) => handleBatchCheckboxClick(event, material.id)}
        >
          <span class="checkbox-box" class:checked={isBatchSelectedItem} aria-hidden="true"></span>
        </button>
      {/if}
      {#if continuousReadingEnabled}
        <button
          type="button"
          class="clickable-icon expand-btn"
          class:expanded={isExpanded}
          class:loading={isLoadingSibling}
          aria-label={getMaterialExpandButtonLabel(isExpanded)}
          onclick={() => void toggleMaterialExpand(material)}
        >
          {#if isLoadingSibling}
            <ObsidianIcon name="loader" size={12} />
          {:else}
            <ObsidianIcon name="chevron-right" size={12} />
          {/if}
        </button>
      {/if}
      <div class="reading-item-content">
        <button
          class="reading-item-main"
          onclick={(event) => handleMaterialClick(material, event)}
          oncontextmenu={(event) => handleMaterialContextMenu(event, event.currentTarget as unknown as HTMLElement, material)}
          onpointerdown={(event) => handleLongPressStart(event, event.currentTarget as unknown as HTMLElement, material)}
          onpointermove={handleLongPressMove}
          onpointerup={handleLongPressEnd}
          onpointercancel={handleLongPressEnd}
        >
          <span class="item-rank" class:top={index < 3}>{index + 1}</span>
          <span class="item-text">
            <span class="item-title-row">
              <span class="item-title" class:processed={processedChunkIds.has(material.id)}>
                <span class="item-title-text">{material.displayName || material.title || t('irSidebar.controls.untitled')}</span>
              </span>
              {#if parentProgress && parentProgress.totalChildren > 0}
                <span
                  class="item-parent-progress"
                  title={t('irSidebar.controls.parentProgressTitle', {
                    completed: parentProgress.completedChildren,
                    total: parentProgress.totalChildren,
                    percent: parentProgress.percent
                  })}
                >
                  {formatParentProgressBadge(parentProgress)}
                </span>
              {/if}
              {#if typeIndicator}
                <span class="reading-point-type-icon" title={typeIndicator.label} aria-label={typeIndicator.label}>
                  <ObsidianIcon name={typeIndicator.icon} size={12} />
                </span>
              {/if}
              {#if isSourceMissing(material.id)}
                <span
                  class="reading-point-missing-source-icon"
                  title={t('irSidebar.controls.missingSourceIndicator')}
                  aria-label={t('irSidebar.controls.missingSourceIndicator')}
                >
                  <ObsidianIcon name="file-warning" size={12} />
                </span>
              {/if}
              {#if isAutoSubscribedNew(material)}
                <span class="item-new-badge">{t('irSidebar.controls.newBadge')}</span>
              {/if}
              {#if hasActiveSearch && (searchDateLabel || searchDeckLabel)}
                <span class="item-search-meta">
                  {#if searchDateLabel}
                    <span class="item-search-meta-chip">{searchDateLabel}</span>
                  {/if}
                  {#if searchDeckLabel}
                    <span class="item-search-meta-chip">{searchDeckLabel}</span>
                  {/if}
                </span>
              {/if}
            </span>
          </span>
        </button>
      </div>
      <div class="reading-item-controls">
        {#if !batchSelectionMode}
          {#if hasVisibleAssociatedNote(material) && !readOnlyHistoryMode}
            <button
              type="button"
              class="associated-note-link"
              aria-label={getAssociatedNoteActionLabel(material)}
              title={getAssociatedNoteActionTooltip(material)}
              oncontextmenu={(event) => handleMaterialContextMenu(event, event.currentTarget as HTMLElement, material)}
              onclick={(event) => handleAssociatedNoteClick(event, material)}
            >
              <span>{t('irSidebar.associatedNote.badge')}</span>
            </button>
          {/if}
          {#if readOnlyHistoryMode}
            <span
              class="schedule-checkbox schedule-checkbox--readonly"
              role="img"
              aria-label={getHistoryScheduleCheckboxLabel(material.id)}
              title={getHistoryScheduleCheckboxLabel(material.id)}
            >
              <span
                class="checkbox-box"
                class:checked={isMaterialScheduleCompleted(material.id)}
                aria-hidden="true"
              ></span>
            </span>
          {:else}
            <button
              class="schedule-checkbox"
              aria-label={t('irSidebar.controls.schedule')}
              onclick={(event) => openSchedulingMenu(event, material)}
            >
              <span class="checkbox-box" class:checked={processedChunkIds.has(material.id)} aria-hidden="true"></span>
            </button>
          {/if}
        {/if}
        {#if !readOnlyHistoryMode}
        <button
          type="button"
          class="clickable-icon reading-timer-btn"
          class:active={isTimerRunningForBlock(material.id)}
          class:tracked={!isTimerRunningForBlock(material.id) && getDisplayedTimerSeconds(material.id) > 0}
          aria-label={isTimerRunningForBlock(material.id) ? t('irSidebar.controls.pauseReadingTimer') : t('irSidebar.controls.startTimer')}
          title={getReadingTimerButtonTitle(material.id)}
          disabled={timerBusyBlockId === material.id}
          onclick={() => {
            void toggleReadingTimer(material);
          }}
        >
          <ObsidianIcon name={isTimerRunningForBlock(material.id) ? 'pause' : 'timer'} size={12} />
        </button>
        {#if getDisplayedTimerSeconds(material.id) > 0}
          <span
            class="reading-timer-chip"
            class:active={isTimerRunningForBlock(material.id)}
            class:tracked={!isTimerRunningForBlock(material.id)}
            title={t('irSidebar.controls.recordedDuration', { duration: formatTimerDuration(getDisplayedTimerSeconds(material.id)) })}
          >
            {formatCompactTimerDuration(getDisplayedTimerSeconds(material.id))}
          </span>
        {/if}
        {/if}
        <span class="priority-badge {priorityClass}">P{priority}</span>
      </div>
    </div>
    {#if continuousReadingEnabled && isExpanded && siblings.length > 0}
      <div class="sibling-list">
        {#each siblings as sibling}
          {@const siblingPriority = sibling.priority || 0}
          {@const siblingPriorityClass = getIRPriorityStyle(siblingPriority).className}
          {@const dueText = sibling.nextRepDate > 0 ? formatSiblingDueDate(sibling.nextRepDate) : t('irSidebar.controls.unscheduled')}
          {@const siblingTypeIndicator = getReadingPointTypeIndicator(sibling)}
          <div class="sibling-item" class:batch-selection-mode={batchSelectionMode} class:batch-selected={isBatchSelected(sibling.id)} class:history-readonly={readOnlyHistoryMode}>
            {#if batchSelectionMode && !readOnlyHistoryMode}
              <button
                type="button"
                class="batch-select-checkbox sibling-batch-select-checkbox"
                aria-label={t('irSidebar.batch.toggleSelection')}
                aria-pressed={isBatchSelected(sibling.id)}
                onclick={(event) => handleBatchCheckboxClick(event, sibling.id)}
              >
                <span class="checkbox-box" class:checked={isBatchSelected(sibling.id)} aria-hidden="true"></span>
              </button>
            {/if}
            <div class="sibling-item-content">
              <button
                class="sibling-item-main"
                onclick={(event) => handleMaterialClick(sibling, event)}
                oncontextmenu={(event) => handleMaterialContextMenu(event, event.currentTarget as unknown as HTMLElement, sibling)}
                onpointerdown={(event) => handleLongPressStart(event, event.currentTarget as unknown as HTMLElement, sibling)}
                onpointermove={handleLongPressMove}
                onpointerup={handleLongPressEnd}
                onpointercancel={handleLongPressEnd}
                title={sibling.title || sibling.id}
              >
                <span class="sibling-title-row">
                  <span class="sibling-title">
                    <span class="sibling-title-text">{sibling.displayName || sibling.title || sibling.id}</span>
                  </span>
                  {#if siblingTypeIndicator}
                    <span class="reading-point-type-icon" title={siblingTypeIndicator.label} aria-label={siblingTypeIndicator.label}>
                      <ObsidianIcon name={siblingTypeIndicator.icon} size={11} />
                    </span>
                  {/if}
                  {#if isSourceMissing(sibling.id)}
                    <span
                      class="reading-point-missing-source-icon"
                      title={t('irSidebar.controls.missingSourceIndicator')}
                      aria-label={t('irSidebar.controls.missingSourceIndicator')}
                    >
                      <ObsidianIcon name="file-warning" size={11} />
                    </span>
                  {/if}
                  {#if isAutoSubscribedNew(sibling)}
                    <span class="item-new-badge">{t('irSidebar.controls.newBadge')}</span>
                  {/if}
                </span>
                <span class="sibling-due">{dueText}</span>
              </button>
            </div>
            <div class="reading-item-controls">
              {#if !batchSelectionMode}
                {#if hasVisibleAssociatedNote(sibling) && !readOnlyHistoryMode}
                  <button
                    type="button"
                    class="associated-note-link sibling-associated-note-link"
                    aria-label={getAssociatedNoteActionLabel(sibling)}
                    title={getAssociatedNoteActionTooltip(sibling)}
                    oncontextmenu={(event) => handleMaterialContextMenu(event, event.currentTarget as HTMLElement, sibling)}
                    onclick={(event) => handleAssociatedNoteClick(event, sibling)}
                  >
                    <span>{t('irSidebar.associatedNote.badge')}</span>
                  </button>
                {/if}
                {#if readOnlyHistoryMode}
                  <span
                    class="schedule-checkbox schedule-checkbox--readonly"
                    role="img"
                    aria-label={getHistoryScheduleCheckboxLabel(sibling.id)}
                    title={getHistoryScheduleCheckboxLabel(sibling.id)}
                  >
                    <span
                      class="checkbox-box"
                      class:checked={isMaterialScheduleCompleted(sibling.id)}
                      aria-hidden="true"
                    ></span>
                  </span>
                {:else}
                  <button
                    class="schedule-checkbox"
                    aria-label={t('irSidebar.controls.schedule')}
                    onclick={(event) => openSchedulingMenu(event, sibling)}
                  >
                    <span class="checkbox-box" class:checked={processedChunkIds.has(sibling.id)} aria-hidden="true"></span>
                  </button>
                {/if}
              {/if}
              {#if !readOnlyHistoryMode}
              <button
                type="button"
                class="clickable-icon reading-timer-btn"
                class:active={isTimerRunningForBlock(sibling.id)}
                class:tracked={!isTimerRunningForBlock(sibling.id) && getDisplayedTimerSeconds(sibling.id) > 0}
                aria-label={isTimerRunningForBlock(sibling.id) ? t('irSidebar.controls.pauseReadingTimer') : t('irSidebar.controls.startTimer')}
                title={getReadingTimerButtonTitle(sibling.id)}
                disabled={timerBusyBlockId === sibling.id}
                onclick={() => {
                  void toggleReadingTimer(sibling);
                }}
              >
                <ObsidianIcon name={isTimerRunningForBlock(sibling.id) ? 'pause' : 'timer'} size={12} />
              </button>
              {#if getDisplayedTimerSeconds(sibling.id) > 0}
                <span
                  class="reading-timer-chip"
                  class:active={isTimerRunningForBlock(sibling.id)}
                  class:tracked={!isTimerRunningForBlock(sibling.id)}
                  title={t('irSidebar.controls.recordedDuration', { duration: formatTimerDuration(getDisplayedTimerSeconds(sibling.id)) })}
                >
                  {formatCompactTimerDuration(getDisplayedTimerSeconds(sibling.id))}
                </span>
              {/if}
              {/if}
              <span class="priority-badge {siblingPriorityClass}">P{siblingPriority}</span>
            </div>
          </div>
        {/each}
      </div>
    {:else if continuousReadingEnabled && isExpanded && siblings.length === 0}
      <div class="sibling-list">
        <div class="sibling-empty">{t('irSidebar.controls.siblingNone')}</div>
      </div>
    {/if}
  </div>
{/each}

<style>
  .reading-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 4px;
    background: none;
    border: none;
    border-radius: 0;
    box-shadow: none;
    outline: none;
    text-align: left;
    width: 100%;
  }

  .reading-item.batch-selected,
  .sibling-item.batch-selected {
    background: color-mix(in srgb, var(--interactive-accent) 12%, var(--background-modifier-hover));
    box-shadow: inset 2px 0 0 var(--interactive-accent);
  }

  .reading-item.batch-selection-mode,
  .sibling-item.batch-selection-mode {
    cursor: pointer;
  }

  .batch-select-checkbox {
    width: 28px;
    height: 28px;
    padding: 0;
    margin-right: 2px;
    border: none;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .batch-select-checkbox:hover .checkbox-box,
  .batch-select-checkbox:focus-visible .checkbox-box {
    border-color: color-mix(in srgb, var(--interactive-accent) 60%, var(--background-modifier-border));
  }

  .batch-select-checkbox:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
    border-radius: 4px;
  }

  .sibling-batch-select-checkbox {
    margin-left: 8px;
  }

  .reading-item:hover {
    background: var(--background-modifier-hover);
  }

  .reading-item-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .reading-item-main {
    display: flex;
    align-items: center;
    gap: 8px;
    border: none;
    background: none;
    box-shadow: none;
    outline: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    width: 100%;
    min-width: 0;
  }

  .reading-item-main:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
    border-radius: 6px;
  }

  .item-text {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
  }

  .item-title-row,
  .sibling-title-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    width: 100%;
  }

  .item-parent-progress {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    padding: 1px 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--interactive-accent) 14%, transparent);
    color: var(--text-muted);
    font-size: 10px;
    line-height: 1.4;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .item-search-meta {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    margin-left: auto;
    min-width: 0;
  }

  .item-search-meta-chip {
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--background-modifier-border) 48%, transparent);
    color: var(--text-muted);
    font-size: 10px;
    line-height: 1.4;
    white-space: nowrap;
  }

  .reading-item-controls {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    flex-shrink: 0;
  }

  .associated-note-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 34px;
    height: 18px;
    padding: 0 6px;
    border: 1px solid color-mix(in srgb, var(--interactive-accent) 38%, var(--background-modifier-border));
    border-radius: 6px;
    background: color-mix(in srgb, var(--interactive-accent) 12%, var(--weave-ir-sidebar-surface-background));
    box-shadow: none;
    color: var(--interactive-accent);
    cursor: pointer;
    font-size: 10px;
    line-height: 1;
    flex-shrink: 0;
  }

  .associated-note-link:hover {
    color: var(--interactive-accent);
    border-color: var(--interactive-accent);
    background: color-mix(in srgb, var(--interactive-accent) 18%, var(--weave-ir-sidebar-surface-background));
  }

  .associated-note-link:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
    border-radius: 4px;
  }

  .associated-note-link span {
    display: block;
    white-space: nowrap;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .schedule-checkbox {
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .schedule-checkbox:hover .checkbox-box {
    border-color: color-mix(in srgb, var(--interactive-accent) 50%, var(--background-modifier-border));
  }

  .schedule-checkbox:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
    border-radius: 4px;
  }

  .schedule-checkbox--readonly {
    cursor: default;
    pointer-events: none;
  }

  .reading-item.history-readonly .item-title:not(.processed) .item-title-text,
  .sibling-item.history-readonly .sibling-title-text {
    color: var(--text-muted);
  }

  .checkbox-box {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    border: 1px solid var(--background-modifier-border);
    background: transparent;
    position: relative;
  }

  .checkbox-box.checked {
    border-color: var(--interactive-accent);
    background: color-mix(in srgb, var(--interactive-accent) 25%, var(--weave-ir-sidebar-elevated-background));
  }

  .checkbox-box.checked::after {
    content: '';
    position: absolute;
    left: 4px;
    top: 1px;
    width: 4px;
    height: 8px;
    border-right: 2px solid var(--interactive-accent);
    border-bottom: 2px solid var(--interactive-accent);
    transform: rotate(45deg);
  }

  .reading-timer-btn {
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }

  .reading-timer-btn:hover:not(:disabled) {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .reading-timer-btn.tracked {
    color: var(--interactive-accent);
  }

  .reading-timer-btn.active {
    color: var(--color-red);
    background: color-mix(in srgb, var(--color-red) 14%, transparent);
  }

  .reading-timer-btn:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  .reading-timer-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 42px;
    padding: 1px 6px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--background-modifier-border) 85%, transparent);
    background: color-mix(in srgb, var(--weave-ir-sidebar-elevated-background) 92%, transparent);
    color: var(--text-muted);
    font-size: 10px;
    font-weight: 600;
    line-height: 1.4;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }

  .reading-timer-chip.tracked {
    color: var(--interactive-accent);
    border-color: color-mix(in srgb, var(--interactive-accent) 32%, var(--background-modifier-border));
    background: color-mix(in srgb, var(--interactive-accent) 9%, var(--weave-ir-sidebar-surface-background));
  }

  .reading-timer-chip.active {
    color: var(--color-red);
    border-color: color-mix(in srgb, var(--color-red) 35%, var(--background-modifier-border));
    background: color-mix(in srgb, var(--color-red) 10%, var(--weave-ir-sidebar-surface-background));
  }

  .item-rank {
    width: 18px;
    height: 18px;
    font-size: 10px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--background-modifier-border);
    border-radius: 4px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .item-rank.top {
    background: var(--color-orange);
    color: white;
  }

  .item-title {
    display: flex;
    align-items: baseline;
    flex: 1;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-normal);
    min-width: 0;
  }

  .item-title-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-title.processed {
    text-decoration: line-through;
    color: var(--text-muted);
  }

  .item-new-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 16px;
    padding: 0 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--interactive-accent) 14%, var(--background-secondary));
    color: var(--interactive-accent);
    font-size: 10px;
    font-weight: 600;
    line-height: 1;
    flex-shrink: 0;
  }

  .reading-point-type-icon,
  .reading-point-missing-source-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    line-height: 1;
  }

  .reading-point-missing-source-icon {
    color: var(--text-warning);
  }

  .priority-badge {
    padding: 2px 6px;
    font-size: 10px;
    font-weight: 600;
    border-radius: 8px;
    flex-shrink: 0;
  }

  .priority-badge.urgent {
    background: #FCE8EC;
    color: #C6284A;
  }

  .priority-badge.high {
    background: #FFF3E0;
    color: #C2760A;
  }

  .priority-badge.medium {
    background: #EEF6E8;
    color: #4A7C2C;
  }

  .priority-badge.low {
    background: #E8EEF6;
    color: #4A6FA5;
  }

  .expand-btn {
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: 3px;
    transition: transform 0.15s ease, color 0.15s ease;
  }

  .expand-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .expand-btn.expanded {
    transform: rotate(90deg);
  }

  .expand-btn.loading {
    transform: none;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .reading-item-wrapper {
    display: flex;
    flex-direction: column;
    background: none;
    border: none;
    box-shadow: none;
    outline: none;
  }

  .sibling-list {
    margin-left: 26px;
    padding-left: 10px;
    border-left: 1px solid var(--background-modifier-border);
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 2px;
    margin-bottom: 4px;
  }

  .sibling-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 6px;
    border: none;
    border-radius: 0;
    box-shadow: none;
    outline: none;
    background: none;
  }

  .sibling-item:hover {
    background: var(--background-modifier-hover);
  }

  .sibling-item-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .sibling-item-main {
    display: flex;
    align-items: center;
    gap: 6px;
    border: none;
    background: none;
    box-shadow: none;
    outline: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    flex: 1;
    min-width: 0;
  }

  .sibling-associated-note-link {
    min-width: 34px;
  }

  .sibling-title {
    display: flex;
    align-items: baseline;
    flex: 1;
    font-size: 11px;
    color: var(--text-muted);
    min-width: 0;
  }

  .sibling-title-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sibling-due {
    font-size: 10px;
    color: var(--text-faint);
    flex-shrink: 0;
    margin-left: 4px;
  }

  .sibling-empty {
    font-size: 11px;
    color: var(--text-faint);
    padding: 4px 0;
  }
</style>
