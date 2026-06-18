<!--
  AddReadingTargetModal - 统一添加入口：网页 / 块引用 / Vault 链接 / PDF++
-->
<script lang="ts">
  import { Menu, Notice } from 'obsidian';
  import { onMount } from 'svelte';
  import type { WeavePlugin } from '../../main';
  import ObsidianIcon from '../ui/ObsidianIcon.svelte';
  import MarkdownRenderer from '../atoms/MarkdownRenderer.svelte';
  import { IRStorageService } from '../../services/incremental-reading/IRStorageService';
  import { parseReadingTargetInput } from '../../services/incremental-reading/reading-target/IRReadingTargetParser';
  import {
    getReadingTargetKindLabel,
    resolveReadingTargetTitleDraft
  } from '../../services/incremental-reading/reading-target/IRReadingTargetTitleResolver';
  import { IRReadingTargetAddService } from '../../services/incremental-reading/reading-target/IRReadingTargetAddService';
  import { resolveInitialReadingTargetDeckId } from '../../services/incremental-reading/reading-target/IRReadingTargetPreferences';
  import {
    buildReadingTargetPreviewMarkdown,
    getCurrentEditorReadingTargetContext
  } from '../../services/incremental-reading/reading-target/IRReadingTargetCurrentLocation';
  import type { ParsedReadingTarget } from '../../services/incremental-reading/reading-target/IRReadingTargetTypes';
  import {
    getScheduleToday,
    loadReadingTargetDayLoadAssessment,
    normalizeScheduleDate,
    parseLocalDateKey,
    recommendReadingTargetScheduleDate,
    toDateInputValue,
    type ReadingTargetDayLoadAssessment,
    type ReadingTargetScheduleMode,
    type ReadingTargetScheduleRecommendation
  } from '../../services/incremental-reading/reading-target/IRReadingTargetScheduleDate';
  import { logger } from '../../utils/logger';
  import { tr } from '../../utils/i18n';

  interface Props {
    plugin: WeavePlugin;
    initialLink?: string;
    initialTitle?: string;
    initialDeckId?: string;
    initialScheduleDate?: Date;
    defaultScheduleMode?: ReadingTargetScheduleMode;
    footerEl: HTMLElement;
    onClose: () => void;
    onAdded?: () => void;
  }

  function portalToTarget(node: HTMLElement, target: HTMLElement) {
    target.appendChild(node);
    return {
      destroy() {
        if (node.parentElement === target) {
          target.removeChild(node);
        }
      }
    };
  }

  let {
    plugin,
    initialLink = '',
    initialTitle = '',
    initialDeckId = '',
    initialScheduleDate = new Date(),
    defaultScheduleMode = 'auto',
    footerEl,
    onClose,
    onAdded
  }: Props = $props();

  let t = $derived($tr);

  let linkInput = $state(initialLink);
  let linkInputTouched = $state(Boolean(initialLink.trim()));
  let title = $state(initialTitle);
  let titleDetected = $state(Boolean(initialTitle.trim()));
  let selectedDeckId = $state('');
  let deckOptions = $state<Array<{ id: string; name: string }>>([]);
  let parsedTarget = $state<ParsedReadingTarget | null>(null);
  let previewMarkdown = $state('');
  let previewSourcePath = $state('');
  let createNote = $state(false);
  let appendSourceBacklink = $state(false);
  let submitting = $state(false);
  let schedulePlanningTimer: ReturnType<typeof setTimeout> | undefined;
  let scheduleMode = $state<ReadingTargetScheduleMode>(defaultScheduleMode);
  let customScheduleDate = $state(normalizeScheduleDate(initialScheduleDate));
  let customDayLoad = $state<ReadingTargetDayLoadAssessment | null>(null);
  let scheduleRecommendation = $state<ReadingTargetScheduleRecommendation | null>(null);
  let schedulePlanningLoading = $state(false);
  let scheduleDateInputEl = $state<HTMLInputElement | null>(null);

  const customScheduleDateLabel = $derived(
    customScheduleDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  );
  const scheduleDateInputValue = $derived(toDateInputValue(customScheduleDate));
  const dailyBudgetMinutes = $derived(
    Number(plugin.getIncrementalReadingSettings().dailyTimeBudgetMinutes) || 40
  );
  const effectiveScheduleDate = $derived(
    scheduleMode === 'auto' && scheduleRecommendation
      ? scheduleRecommendation.date
      : customScheduleDate
  );
  const autoRecommendDateLabel = $derived(
    scheduleRecommendation
      ? scheduleRecommendation.date.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      : ''
  );

  const canUseCurrentLocation = $derived(Boolean(getCurrentEditorReadingTargetContext(plugin.app)));
  const kindLabel = $derived(parsedTarget ? getReadingTargetKindLabel(parsedTarget.kind) : '');
  const validationMessage = $derived(parsedTarget?.validationError || '');
  const canSubmit = $derived(
    Boolean(
      !submitting &&
      selectedDeckId &&
      title.trim() &&
      parsedTarget &&
      !parsedTarget.validationError &&
      parsedTarget.kind !== 'unknown' &&
      (scheduleMode === 'custom' || scheduleRecommendation)
    )
  );

  function getEstimateSignature(target: ParsedReadingTarget | null): string {
    return `${target?.kind ?? 'unknown'}:${target?.pdfPoints?.length ?? 0}`;
  }

  async function loadDecks(): Promise<void> {
    const storage = new IRStorageService(plugin.app);
    await storage.initialize();
    deckOptions = Object.values(await storage.getAllDecks())
      .filter((deck) => !deck.archivedAt)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((deck) => ({ id: deck.id, name: deck.name }));

    const settings = plugin.getIncrementalReadingSettings();
    selectedDeckId = resolveInitialReadingTargetDeckId({
      activeDeckId: initialDeckId,
      inboxDeckId: settings.readingTargetInboxDeckId,
      lastDeckId: settings.readingTargetLastDeckId,
      deckIds: deckOptions.map((deck) => deck.id)
    });
    appendSourceBacklink = settings.readingTargetAppendSourceBacklink === true;
  }

  async function refreshParsedTarget(options?: {
    allowTitleOverride?: boolean;
    skipScheduleQueue?: boolean;
  }): Promise<void> {
    const allowTitleOverride = options?.allowTitleOverride !== false;
    const skipScheduleQueue = options?.skipScheduleQueue === true;
    const previousEstimateSignature = getEstimateSignature(parsedTarget);
    const contextPath = plugin.app.workspace.getActiveFile()?.path ?? '';
    parsedTarget = parseReadingTargetInput(plugin.app, linkInput, contextPath);
    createNote = parsedTarget.kind === 'web' || plugin.getIncrementalReadingSettings().readingTargetDefaultNoteBacked === true;

    if (allowTitleOverride && (!title.trim() || !titleDetected)) {
      const draft = await resolveReadingTargetTitleDraft(plugin.app, parsedTarget);
      if (!title.trim() || !titleDetected) {
        title = initialTitle.trim() || draft.title;
        titleDetected = draft.titleDetected;
      }
    }

    previewMarkdown = parsedTarget ? buildReadingTargetPreviewMarkdown(parsedTarget, title.trim() || t('irAddTarget.previewFallback')) : '';
    previewSourcePath = parsedTarget?.sourceFilePath || contextPath;

    if (
      !skipScheduleQueue &&
      selectedDeckId &&
      scheduleMode === 'auto' &&
      getEstimateSignature(parsedTarget) !== previousEstimateSignature
    ) {
      queueSchedulePlanningRefresh();
    }
  }

  function handleLinkInputChange(): void {
    linkInputTouched = true;
    void refreshParsedTarget();
  }

  function handleTitleInputChange(): void {
    titleDetected = false;
    if (parsedTarget) {
      previewMarkdown = buildReadingTargetPreviewMarkdown(parsedTarget, title.trim() || t('irAddTarget.previewFallback'));
    }
  }

  function queueSchedulePlanningRefresh(): void {
    if (schedulePlanningTimer) {
      clearTimeout(schedulePlanningTimer);
    }
    schedulePlanningTimer = setTimeout(() => {
      schedulePlanningTimer = undefined;
      void refreshSchedulePlanning();
    }, 320);
  }

  function useCurrentLocation(): void {
    const context = getCurrentEditorReadingTargetContext(plugin.app);
    if (!context) {
      new Notice(t('irAddTarget.notices.needMarkdownCursor'), 3000);
      return;
    }
    linkInput = context.sourceLink.replace(/^!/, '');
    linkInputTouched = true;
    void refreshParsedTarget();
  }

  function showDeckMenu(event: MouseEvent): void {
    const menu = new Menu();
    for (const deck of deckOptions) {
      menu.addItem((item) => {
        item
          .setTitle(deck.name)
          .setChecked(deck.id === selectedDeckId)
          .onClick(() => {
            selectedDeckId = deck.id;
            void refreshSchedulePlanning();
          });
      });
    }
    menu.showAtMouseEvent(event);
  }

  function getDeckButtonLabel(): string {
    const deck = deckOptions.find((entry) => entry.id === selectedDeckId);
    return deck ? t('irAddTarget.deck.label', { name: deck.name }) : t('irAddTarget.deck.selectTopic');
  }

  function setScheduleMode(mode: ReadingTargetScheduleMode): void {
    scheduleMode = mode;
    void refreshSchedulePlanning();
  }

  function setCustomScheduleDate(date: Date): void {
    customScheduleDate = normalizeScheduleDate(date);
    if (scheduleMode === 'custom') {
      void refreshCustomDayLoad();
    }
  }

  async function refreshCustomDayLoad(): Promise<void> {
    if (!selectedDeckId || scheduleMode !== 'custom') {
      customDayLoad = null;
      return;
    }

    try {
      customDayLoad = await loadReadingTargetDayLoadAssessment(
        plugin.app,
        customScheduleDate,
        selectedDeckId,
        dailyBudgetMinutes
      );
    } catch (error) {
      logger.warn('[AddReadingTargetModal] 日负载读取失败', error);
      customDayLoad = null;
    }
  }

  async function refreshAutoRecommendation(): Promise<void> {
    if (!selectedDeckId || scheduleMode !== 'auto') {
      scheduleRecommendation = null;
      schedulePlanningLoading = false;
      return;
    }

    schedulePlanningLoading = true;
    try {
      scheduleRecommendation = await recommendReadingTargetScheduleDate(
        plugin.app,
        selectedDeckId,
        dailyBudgetMinutes,
        {
          startDate: normalizeScheduleDate(getScheduleToday()),
          estimatedMinutesForNewItem: estimateNewItemMinutes()
        }
      );
    } catch (error) {
      logger.warn('[AddReadingTargetModal] 推荐排期失败', error);
      scheduleRecommendation = null;
    } finally {
      schedulePlanningLoading = false;
    }
  }

  async function refreshSchedulePlanning(): Promise<void> {
    if (!selectedDeckId) {
      customDayLoad = null;
      scheduleRecommendation = null;
      schedulePlanningLoading = false;
      return;
    }

    if (scheduleMode === 'auto') {
      customDayLoad = null;
      await refreshAutoRecommendation();
      return;
    }

    scheduleRecommendation = null;
    schedulePlanningLoading = false;
    await refreshCustomDayLoad();
  }

  function estimateNewItemMinutes(): number {
    if (!parsedTarget) {
      return 5;
    }
    if (parsedTarget.kind === 'pdf-batch') {
      return Math.max(5, (parsedTarget.pdfPoints?.length ?? 1) * 4);
    }
    if (parsedTarget.kind === 'web') {
      return 8;
    }
    return 5;
  }

  function openScheduleDatePicker(): void {
    const input = scheduleDateInputEl;
    if (!input) {
      return;
    }
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.click();
  }

  function handleScheduleDateInput(event: Event): void {
    const value = (event.currentTarget as HTMLInputElement).value;
    const parsed = parseLocalDateKey(value);
    if (!parsed) {
      return;
    }
    setCustomScheduleDate(parsed);
  }

  async function handleSubmit(): Promise<void> {
    if (!canSubmit || !parsedTarget) {
      return;
    }

    submitting = true;
    try {
      const service = new IRReadingTargetAddService(plugin.app);
      const result = await service.addReadingTarget({
        title: title.trim(),
        deckId: selectedDeckId,
        target: parsedTarget,
        scheduleDate: effectiveScheduleDate,
        createNote,
        appendSourceBacklink,
        noteFolderPath: plugin.getIncrementalReadingSettings().selectionQuickCreateLastFolder
      });

      plugin.settings.incrementalReading = {
        ...plugin.settings.incrementalReading,
        readingTargetLastDeckId: selectedDeckId,
        readingTargetAppendSourceBacklink: appendSourceBacklink
      };
      await plugin.saveSettings();

      const count = result.createdIds.length;
      new Notice(t('irAddTarget.notices.added', { count, deckName: result.deckName }), 3500);
      onAdded?.();
      onClose();
    } catch (error) {
      logger.error('[AddReadingTargetModal] 添加失败', error);
      const message =
        error instanceof Error && error.message === 'reading-target-epub-unresolved'
          ? t('irAddTarget.notices.epubUnresolved')
          : error instanceof Error && error.message === 'reading-target-epub-missing-cfi'
            ? t('irAddTarget.notices.epubMissingCfi')
            : t('irAddTarget.notices.addFailed');
      new Notice(message, 3500);
    } finally {
      submitting = false;
    }
  }

  onMount(() => {
    void (async () => {
      await loadDecks();
      await refreshParsedTarget({ allowTitleOverride: true, skipScheduleQueue: true });
      await refreshSchedulePlanning();
    })();
  });
</script>

<div class="add-reading-target-modal">
  <div class="add-reading-target-body">
  <div class="add-reading-target-panel">
    <div class="panel-heading">
      <span class="panel-title">{t('irAddTarget.panels.linkOrReference')}</span>
      <div class="panel-actions">
        {#if canUseCurrentLocation}
          <button class="clickable-icon panel-action-btn" type="button" onclick={useCurrentLocation} title={t('irAddTarget.actions.currentLocationTitle')}>
            <ObsidianIcon name="crosshair" size={14} />
            <span>{t('irAddTarget.actions.currentLocation')}</span>
          </button>
        {/if}
      </div>
    </div>
    <textarea
      class="link-input"
      bind:value={linkInput}
      oninput={handleLinkInputChange}
      rows="3"
      placeholder={t('irAddTarget.placeholders.linkInput')}
    ></textarea>
    {#if parsedTarget && parsedTarget.kind !== 'unknown'}
      <div class="target-meta">
        <span class="target-kind">{kindLabel}</span>
        {#if parsedTarget.kind === 'pdf-batch' && parsedTarget.pdfPoints}
          <span class="target-count">{t('irAddTarget.meta.pdfBatchCount', { count: parsedTarget.pdfPoints.length })}</span>
        {/if}
      </div>
    {/if}
    {#if validationMessage && linkInputTouched}
      <p class="field-error">{validationMessage}</p>
    {:else if !linkInput.trim()}
      <p class="field-hint">{t('irAddTarget.hints.supportedFormats')}</p>
    {/if}
  </div>

  {#if previewMarkdown}
    <div class="add-reading-target-panel preview-panel">
      <span class="panel-title">{t('irAddTarget.panels.locationPreview')}</span>
      <div class="preview-surface">
        <MarkdownRenderer plugin={plugin} source={previewMarkdown} sourcePath={previewSourcePath} />
      </div>
    </div>
  {/if}

  <div class="add-reading-target-panel">
    <label class="field-row">
      <span class="panel-title">{t('irAddTarget.panels.readingPointName')}</span>
      <input class="title-input" type="text" bind:value={title} oninput={handleTitleInputChange} placeholder={t('irAddTarget.placeholders.titleInput')} />
    </label>
    <p class="field-hint">
      {titleDetected ? t('irAddTarget.hints.titleDetected') : t('irAddTarget.hints.titleConfirm')}
    </p>
  </div>

  <div class="add-reading-target-panel">
    <span class="panel-title">{t('irAddTarget.panels.topic')}</span>
    <p class="field-hint panel-intro">{t('irAddTarget.hints.topicIntro')}</p>
    <button class="picker-button deck-picker-button" type="button" onclick={(event) => showDeckMenu(event)}>
      {getDeckButtonLabel()}
      <ObsidianIcon name="chevron-down" size={14} />
    </button>
  </div>

  <div class="add-reading-target-panel schedule-panel">
    <div class="schedule-header">
      <span class="panel-title">{t('irAddTarget.panels.firstReadDay')}</span>
      <p class="field-hint schedule-explainer">{t('irAddTarget.hints.scheduleExplainer')}</p>
    </div>

    <div class="schedule-mode-row" role="radiogroup" aria-label={t('irAddTarget.schedule.modeAriaLabel')}>
      <label class="schedule-mode-option">
        <input
          type="radio"
          name="schedule-mode"
          value="custom"
          checked={scheduleMode === 'custom'}
          onchange={() => setScheduleMode('custom')}
        />
        <span>{t('irAddTarget.schedule.customDate')}</span>
      </label>
      <label class="schedule-mode-option">
        <input
          type="radio"
          name="schedule-mode"
          value="auto"
          checked={scheduleMode === 'auto'}
          onchange={() => setScheduleMode('auto')}
        />
        <span>{t('irAddTarget.schedule.autoRecommend')}</span>
      </label>
    </div>

    <div class="schedule-result-slot">
      {#if scheduleMode === 'custom'}
        <div class="schedule-date-block">
          <button
            class="schedule-chip schedule-chip-button"
            type="button"
            title={t('irAddTarget.schedule.pickDateTitle')}
            onclick={openScheduleDatePicker}
          >
            <ObsidianIcon name="calendar" size={14} />
            <span>{customScheduleDateLabel}</span>
          </button>
          <input
            class="schedule-date-input"
            type="date"
            value={scheduleDateInputValue}
            onchange={handleScheduleDateInput}
            bind:this={scheduleDateInputEl}
            aria-label={t('irAddTarget.schedule.dateAriaLabel')}
          />
          {#if customDayLoad && (customDayLoad.itemCount > 0 || customDayLoad.totalEstimatedMinutes > 0)}
            <p class="field-hint custom-day-load-hint">
              {t('irAddTarget.hints.customDayLoad', {
                itemCount: customDayLoad.itemCount,
                minutes: customDayLoad.totalEstimatedMinutes
              })}
            </p>
          {/if}
        </div>
      {:else if scheduleRecommendation}
        <div class="auto-recommend-card">
          <div class="auto-recommend-heading">
            <ObsidianIcon name="calendar" size={14} />
            <span class="auto-recommend-date">{autoRecommendDateLabel}</span>
          </div>
          <p class="auto-recommend-summary">{scheduleRecommendation.summary}</p>
        </div>
      {:else if schedulePlanningLoading}
        <p class="field-hint schedule-loading-hint">{t('irAddTarget.hints.scheduleLoading')}</p>
      {:else}
        <p class="field-hint schedule-fallback-hint">{t('irAddTarget.hints.scheduleFallback')}</p>
      {/if}
    </div>
  </div>

  {#if parsedTarget && (parsedTarget.kind !== 'web' && parsedTarget.kind !== 'epub' || parsedTarget.sourceFilePath)}
    <div class="add-reading-target-panel options-panel">
      {#if parsedTarget.kind !== 'web' && parsedTarget.kind !== 'epub'}
        <label class="option-row">
          <input type="checkbox" bind:checked={createNote} />
          <span>{t('irAddTarget.options.createNote')}</span>
        </label>
      {/if}
      {#if parsedTarget.sourceFilePath}
        <label class="option-row">
          <input type="checkbox" bind:checked={appendSourceBacklink} />
          <span>{t('irAddTarget.options.appendBacklink')}</span>
        </label>
      {/if}
    </div>
  {/if}
  </div>
</div>

<div class="modal-footer" use:portalToTarget={footerEl}>
  <button type="button" onclick={onClose}>{t('irAddTarget.actions.cancel')}</button>
  <button type="button" class="mod-cta" disabled={!canSubmit} onclick={() => { void handleSubmit(); }}>
    {submitting ? t('irAddTarget.actions.adding') : t('irAddTarget.actions.confirmAdd')}
  </button>
</div>

<style>
  .add-reading-target-modal {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    overflow: hidden;
  }

  .add-reading-target-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
    width: 100%;
    max-width: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    padding-bottom: 4px;
  }

  .add-reading-target-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
    padding: 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    background: var(--background-primary);
  }

  .panel-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .panel-title {
    font-size: var(--font-ui-small);
    font-weight: var(--font-semibold);
    color: var(--text-normal);
  }

  .panel-intro {
    margin: 0;
  }

  .panel-actions {
    display: inline-flex;
    gap: 6px;
  }

  .panel-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--clickable-icon-radius);
    background: transparent;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    cursor: pointer;
  }

  .panel-action-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .link-input,
  .title-input {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 8px 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--background-primary);
    color: var(--text-normal);
    font: inherit;
    resize: vertical;
  }

  .field-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    width: 100%;
  }

  .field-hint,
  .field-error {
    margin: 0;
    min-width: 0;
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .field-error {
    color: var(--text-error);
  }

  .target-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .target-kind,
  .target-count,
  .schedule-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: var(--font-ui-smaller);
    background: color-mix(in srgb, var(--background-modifier-border) 35%, transparent);
    color: var(--text-muted);
  }

  .preview-panel .preview-surface {
    border: 1px dashed var(--background-modifier-border);
    border-radius: var(--radius-s);
    overflow: hidden;
    max-height: 180px;
  }

  .preview-panel .preview-surface :global(.markdown-preview-helper) {
    max-height: 160px;
    overflow: hidden;
  }

  .preview-panel .preview-surface :global(.markdown-preview-helper .internal-embed),
  .preview-panel .preview-surface :global(.markdown-preview-helper iframe),
  .preview-panel .preview-surface :global(.markdown-preview-helper embed) {
    max-height: 140px;
  }

  .schedule-panel {
    gap: 10px;
  }

  .schedule-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .schedule-explainer {
    margin: 0;
  }

  .schedule-mode-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    padding: 4px 0;
  }

  .schedule-mode-option {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-ui-small);
    color: var(--text-normal);
    cursor: pointer;
  }

  .auto-recommend-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: color-mix(in srgb, var(--interactive-accent) 6%, var(--background-primary));
  }

  .auto-recommend-heading {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--text-normal);
    font-weight: var(--font-semibold);
    font-size: var(--font-ui-small);
  }

  .auto-recommend-date {
    font-size: var(--font-ui-medium);
  }

  .auto-recommend-summary {
    margin: 0;
    font-size: var(--font-ui-small);
    color: var(--text-normal);
  }

  .schedule-date-block {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
  }

  .schedule-chip-button {
    align-self: flex-start;
    cursor: pointer;
    border: 1px solid var(--background-modifier-border);
    background: color-mix(in srgb, var(--background-modifier-border) 35%, transparent);
  }

  .schedule-chip-button:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .schedule-date-input {
    position: absolute;
    top: 0;
    left: 0;
    width: 1px;
    height: 1px;
    opacity: 0;
    border: 0;
    padding: 0;
  }

  .schedule-result-slot {
    min-height: 0;
  }

  .schedule-loading-hint,
  .custom-day-load-hint,
  .schedule-fallback-hint {
    margin: 0;
  }

  .picker-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 6px 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--background-secondary);
    color: var(--text-normal);
    cursor: pointer;
  }

  .deck-picker-button {
    width: 100%;
    justify-content: space-between;
  }

  .deck-picker-button :global(svg) {
    flex-shrink: 0;
  }

  .options-panel {
    gap: 6px;
  }

  .option-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    min-width: 0;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
  }

  .option-row span {
    flex: 1 1 auto;
    min-width: 0;
    line-height: 1.45;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }
</style>
