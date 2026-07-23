<!--
  AddReadingTargetModal - 统一添加入口：网页 / 块引用 / Vault 链接 / PDF++
-->
<script lang="ts">
  import { Menu, Notice } from 'obsidian';
  import { onMount, untrack } from 'svelte';
  import type { WeavePlugin } from '../../main';
  import ObsidianIcon from '../ui/ObsidianIcon.svelte';
  import MarkdownRenderer from '../atoms/MarkdownRenderer.svelte';
  import { IRStorageService } from '../../services/incremental-reading/IRStorageService';
  import { parseReadingTargetInput, refineParsedReadingTargetValidation } from '../../services/incremental-reading/reading-target/IRReadingTargetParser';
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
  import {
    supportsReadingTargetCreateNote,
    type ParsedReadingTarget
  } from '../../services/incremental-reading/reading-target/IRReadingTargetTypes';
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
  import { openCreateIRTopicModal } from '../../modals/CreateIRTopicModal';
  import { IRPointSuggestModal } from '../../modals/IRPointSuggestModal';
  import {
    listParentPickerItems,
    loadParentRelationRuntime
  } from '../../services/incremental-reading/IRPointParentRelationRuntime';
  import { logger } from '../../utils/logger';
  import { tr } from '../../utils/i18n';
  import type { IRDeck } from '../../types/ir-types';

  const READING_TARGET_ERROR_NOTICE_KEYS: Record<string, string> = {
    'reading-target-epub-unresolved': 'irAddTarget.notices.epubUnresolved',
    'reading-target-epub-missing-cfi': 'irAddTarget.notices.epubMissingCfi',
    'reading-target-epub-invalid': 'irAddTarget.notices.epubInvalid',
    'reading-target-missing-title': 'irAddTarget.notices.missingTitle',
    'reading-target-missing-deck': 'irAddTarget.notices.missingDeck',
    'reading-target-deck-missing': 'irAddTarget.notices.deckMissing',
    'reading-target-canvas-invalid': 'irAddTarget.notices.canvasInvalid',
    'reading-target-missing-source': 'irAddTarget.notices.missingSource',
    'reading-target-schedule-pin-failed': 'irAddTarget.notices.schedulePinFailed',
    'reading-target-pdf-batch-failed': 'irAddTarget.notices.pdfBatchFailed',
    'reading-target-invalid-folder': 'irAddTarget.notices.invalidFolder'
  };

  interface Props {
    plugin: WeavePlugin;
    initialLink?: string;
    initialTitle?: string;
    initialDeckId?: string;
    initialCanvasTextCandidates?: string[];
    initialScheduleDate?: Date;
    defaultScheduleMode?: ReadingTargetScheduleMode;
    /** Obsidian 原生标题栏右侧操作区（关闭按钮左侧），与 Weave 新建卡片 headerActions 对齐 */
    headerActionsEl: HTMLElement;
    footerEl: HTMLElement;
    onClose: () => void;
    onAdded?: (result: {
      pinDateKey: string;
      createdIds: string[];
      deckName: string;
    }) => void;
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
    initialCanvasTextCandidates = [],
    initialScheduleDate = new Date(),
    defaultScheduleMode = 'auto',
    headerActionsEl,
    footerEl,
    onClose,
    onAdded
  }: Props = $props();

  let t = $derived($tr);

  let linkInput = $state(untrack(() => initialLink));
  let linkInputTouched = $state(untrack(() => Boolean(initialLink.trim())));
  let title = $state(untrack(() => initialTitle));
  let titleDetected = $state(untrack(() => Boolean(initialTitle.trim())));
  let selectedDeckId = $state('');
  let deckOptions = $state<Array<{ id: string; name: string }>>([]);
  let parsedTarget = $state<ParsedReadingTarget | null>(null);
  let previewMarkdown = $state('');
  let previewSourcePath = $state('');
  let createNote = $state(false);
  let appendSourceBacklink = $state(false);
  let submitting = $state(false);
  let schedulePlanningTimer: ReturnType<typeof setTimeout> | undefined;
  let schedulePlanningRequestId = 0;
  let scheduleMode = $state<ReadingTargetScheduleMode>(
    untrack(() => defaultScheduleMode),
  );
  let customScheduleDate = $state(
    untrack(() => normalizeScheduleDate(initialScheduleDate)),
  );
  let customDayLoad = $state<ReadingTargetDayLoadAssessment | null>(null);
  let scheduleRecommendation = $state<ReadingTargetScheduleRecommendation | null>(null);
  let schedulePlanningLoading = $state(false);
  let scheduleDateInputEl = $state<HTMLInputElement | null>(null);
  let currentLocationTick = $state(0);
  let selectedParentPointId = $state<string | null>(null);
  let selectedParentTitle = $state('');
  const canOfferCreateNote = $derived(
    Boolean(parsedTarget && supportsReadingTargetCreateNote(parsedTarget.kind))
  );

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

  const canUseCurrentLocation = $derived.by(() => {
    currentLocationTick;
    return Boolean(getCurrentEditorReadingTargetContext(plugin.app));
  });
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

  async function reloadDeckOptions(): Promise<void> {
    const storage = new IRStorageService(plugin.app);
    await storage.initialize();
    deckOptions = Object.values(await storage.getAllDecks())
      .filter((deck) => !deck.archivedAt)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((deck) => ({ id: deck.id, name: deck.name }));
  }

  async function loadDecks(): Promise<void> {
    await reloadDeckOptions();

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
    let nextTarget = parseReadingTargetInput(plugin.app, linkInput, contextPath);
    nextTarget = await refineParsedReadingTargetValidation(plugin.app, nextTarget);
    if (
      nextTarget.kind === 'canvas' &&
      initialCanvasTextCandidates.length > 0 &&
      (!nextTarget.canvasTextCandidates ||
        nextTarget.canvasTextCandidates.length === 0)
    ) {
      nextTarget = {
        ...nextTarget,
        canvasTextCandidates: [...initialCanvasTextCandidates]
      };
    }
    parsedTarget = nextTarget;
    createNote =
      supportsReadingTargetCreateNote(parsedTarget.kind) &&
      plugin.getIncrementalReadingSettings().readingTargetDefaultNoteBacked === true;

    if (allowTitleOverride && (!title.trim() || !titleDetected)) {
      const draft = await resolveReadingTargetTitleDraft(plugin.app, parsedTarget);
      if (!title.trim() || !titleDetected) {
        title = initialTitle.trim() || draft.title;
        titleDetected = draft.titleDetected;
      }
    }

    previewMarkdown = parsedTarget
      ? buildReadingTargetPreviewMarkdown(
          parsedTarget,
          title.trim() || t('irAddTarget.previewFallback')
        )
      : '';
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
      previewMarkdown = buildReadingTargetPreviewMarkdown(
        parsedTarget,
        title.trim() || t('irAddTarget.previewFallback')
      );
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

  function openCreateTopicModal(): void {
    openCreateIRTopicModal({
      app: plugin.app,
      onCreated: async (deck: IRDeck) => {
        await reloadDeckOptions();
        selectedDeckId = deck.id;
        new Notice(t('irAddTarget.notices.topicCreated', { name: deck.name }), 3000);
        void refreshSchedulePlanning();
      }
    });
  }

  function showDeckMenu(event: MouseEvent | KeyboardEvent): void {
    const menu = new Menu();
    if (deckOptions.length === 0) {
      menu.addItem((item) => {
        item.setTitle(t('irModals.common.noTopicsYet')).setDisabled(true);
      });
    }

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

    if (deckOptions.length > 0) {
      menu.addSeparator();
    }

    menu.addItem((item) => {
      item
        .setTitle(t('irAddTarget.deck.createTopicMenu'))
        .setIcon('plus')
        .onClick(() => {
          openCreateTopicModal();
        });
    });

    if (event instanceof MouseEvent) {
      menu.showAtMouseEvent(event);
      return;
    }

    const target = event.currentTarget;
    if (target instanceof HTMLElement) {
      const rect = target.getBoundingClientRect();
      menu.showAtPosition({ x: rect.left, y: rect.bottom + 4 });
    }
  }

  function getDeckButtonLabel(): string {
    const deck = deckOptions.find((entry) => entry.id === selectedDeckId);
    // 顶栏与 Weave 新建卡片一致：只显示专题名，不带「专题：」前缀
    return deck?.name || t('irAddTarget.deck.selectTopic');
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

  async function openParentPointPicker(): Promise<void> {
    try {
      const runtime = await loadParentRelationRuntime(plugin.app);
      const items = listParentPickerItems(runtime, {
        preferTopicId: selectedDeckId
      });
      const picker = new IRPointSuggestModal(plugin.app, {
        items,
        allowClear: true,
        placeholder: t('irModals.pointSuggest.placeholder'),
        clearLabel: t('irModals.pointSuggest.clearLabel'),
        clearDescription: t('irModals.pointSuggest.clearDescription')
      });
      const choice = await picker.waitForChoice();
      if (choice.kind === 'cancel') {
        return;
      }
      if (choice.kind === 'clear') {
        selectedParentPointId = null;
        selectedParentTitle = '';
        return;
      }
      selectedParentPointId = choice.item.id;
      selectedParentTitle = choice.item.title || choice.item.id;
    } catch (error) {
      logger.error('[AddReadingTargetModal] parent picker failed', error);
      new Notice(t('irServiceNotices.quickEdit.openSelectParentFailed'), 3000);
    }
  }

  function clearSelectedParent(): void {
    selectedParentPointId = null;
    selectedParentTitle = '';
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
      schedulePlanningRequestId += 1;
      scheduleRecommendation = null;
      schedulePlanningLoading = false;
      return;
    }

    const requestId = ++schedulePlanningRequestId;
    schedulePlanningLoading = true;
    try {
      const recommendation = await recommendReadingTargetScheduleDate(
        plugin.app,
        selectedDeckId,
        dailyBudgetMinutes,
        {
          startDate: normalizeScheduleDate(getScheduleToday()),
          estimatedMinutesForNewItem: estimateNewItemMinutes()
        }
      );
      if (requestId !== schedulePlanningRequestId) {
        return;
      }
      scheduleRecommendation = recommendation;
    } catch (error) {
      if (requestId !== schedulePlanningRequestId) {
        return;
      }
      logger.warn('[AddReadingTargetModal] 推荐排期失败', error);
      scheduleRecommendation = null;
    } finally {
      if (requestId === schedulePlanningRequestId) {
        schedulePlanningLoading = false;
      }
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
        noteFolderPath: plugin.getIncrementalReadingSettings().selectionQuickCreateLastFolder,
        parentPointId: selectedParentPointId
      });

      plugin.settings.incrementalReading = {
        ...plugin.settings.incrementalReading,
        readingTargetLastDeckId: selectedDeckId,
        readingTargetAppendSourceBacklink: appendSourceBacklink
      };
      await plugin.saveSettings();

      if (result.outcome === 'updated') {
        new Notice(
          t('irAddTarget.notices.updated', { deckName: result.deckName }),
          3500
        );
      } else if (result.outcome !== 'existing') {
        const count = result.createdIds.length;
        new Notice(
          t('irAddTarget.notices.added', { count, deckName: result.deckName }),
          3500
        );
      }
      onAdded?.({
        pinDateKey: result.pinDateKey,
        createdIds: result.createdIds,
        deckName: result.deckName
      });
      onClose();
    } catch (error) {
      logger.error('[AddReadingTargetModal] 添加失败', error);
      const code = error instanceof Error ? error.message : '';
      const noticeKey = READING_TARGET_ERROR_NOTICE_KEYS[code];
      new Notice(noticeKey ? t(noticeKey) : t('irAddTarget.notices.addFailed'), 3500);
    } finally {
      submitting = false;
    }
  }

  onMount(() => {
    const refreshCurrentLocationAffordances = () => {
      currentLocationTick += 1;
    };
    const leafRef = plugin.app.workspace.on(
      'active-leaf-change',
      refreshCurrentLocationAffordances
    );
    const fileRef = plugin.app.workspace.on(
      'file-open',
      refreshCurrentLocationAffordances
    );

    void (async () => {
      await loadDecks();
      await refreshParsedTarget({ allowTitleOverride: true, skipScheduleQueue: true });
      await refreshSchedulePlanning();
    })();

    return () => {
      plugin.app.workspace.offref(leafRef);
      plugin.app.workspace.offref(fileRef);
    };
  });
</script>

<button
  class="clickable-icon weave-toolbar-tab deck-selector-btn"
  type="button"
  title={t('irAddTarget.deck.selectTopic')}
  aria-label={t('irAddTarget.deck.selectTopic')}
  use:portalToTarget={headerActionsEl}
  onclick={(event) => {
    event.preventDefault();
    showDeckMenu(event);
  }}
  onkeydown={(event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showDeckMenu(event);
    }
  }}
>
  <span class="deck-name">{getDeckButtonLabel()}</span>
  <ObsidianIcon name="chevron-down" size={12} />
</button>

<div class="add-reading-target-modal">
  <div class="add-reading-target-body">
  <div class="add-reading-target-panel">
    <label class="field-row">
      <span class="panel-title">{t('irAddTarget.panels.readingPointName')}</span>
      <input class="title-input" type="text" bind:value={title} oninput={handleTitleInputChange} placeholder={t('irAddTarget.placeholders.titleInput')} />
    </label>
  </div>

  <div class="add-reading-target-panel">
    <span class="panel-title">{t('irAddTarget.panels.parentReadingPoint')}</span>
    <p class="field-hint">{t('irAddTarget.hints.parentIntro')}</p>
    <div class="parent-picker-row">
      <button
        class="clickable-icon weave-toolbar-tab parent-picker-btn"
        type="button"
        title={selectedParentPointId ? t('irAddTarget.actions.changeParent') : t('irAddTarget.actions.pickParent')}
        onclick={() => { void openParentPointPicker(); }}
      >
        <ObsidianIcon name="git-branch" size={14} />
        <span>{selectedParentTitle || t('irAddTarget.placeholders.parentNone')}</span>
      </button>
      {#if selectedParentPointId}
        <button
          class="clickable-icon weave-toolbar-tab parent-change-btn"
          type="button"
          title={t('irAddTarget.actions.changeParent')}
          aria-label={t('irAddTarget.actions.changeParent')}
          onclick={() => { void openParentPointPicker(); }}
        >
          <ObsidianIcon name="replace" size={14} />
          <span>{t('irAddTarget.actions.changeParent')}</span>
        </button>
        <button
          class="clickable-icon parent-clear-btn"
          type="button"
          title={t('irAddTarget.actions.clearParent')}
          aria-label={t('irAddTarget.actions.clearParent')}
          onclick={clearSelectedParent}
        >
          <ObsidianIcon name="x" size={14} />
        </button>
      {/if}
    </div>
  </div>

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
            class="clickable-icon weave-toolbar-tab schedule-date-btn"
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

  {#if parsedTarget && (canOfferCreateNote || parsedTarget.sourceFilePath)}
    <div class="add-reading-target-panel options-panel">
      {#if canOfferCreateNote}
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

  .panel-actions {
    display: inline-flex;
    gap: 6px;
  }

  /* 顶栏专题选择器：与 Weave CreateCardModal headerActions 同构 */
  .deck-selector-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    max-width: min(36vw, 200px);
    min-width: 0;
    padding: 0.35rem 0.65rem;
    border: none;
    box-shadow: none;
    border-radius: var(--clickable-icon-radius, var(--radius-s));
    background: transparent;
    color: var(--text-normal);
    font-size: var(--font-ui-small);
    font-weight: 500;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .deck-selector-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .deck-selector-btn:active {
    background: var(--background-modifier-active-hover);
  }

  .deck-selector-btn .deck-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    flex: 1 1 auto;
  }

  .deck-selector-btn :global(svg) {
    flex-shrink: 0;
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

  .parent-picker-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .parent-picker-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    min-width: 0;
    height: auto;
    padding: 4px 8px;
    border-radius: var(--radius-s);
  }

  .parent-picker-btn span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .parent-change-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    height: auto;
    padding: 4px 8px;
  }

  .parent-clear-btn {
    flex-shrink: 0;
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
  .target-count {
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

  /* 扁平功能键：无边框、无凸起，对齐 Obsidian clickable-icon */
  .add-reading-target-modal button.schedule-date-btn {
    appearance: none;
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    box-sizing: border-box;
    min-height: var(--clickable-icon-size, 28px);
    padding: 0.35rem 0.65rem;
    border: none;
    box-shadow: none;
    outline: none;
    border-radius: var(--clickable-icon-radius, var(--radius-s));
    background: transparent;
    color: var(--text-muted);
    font-family: var(--font-interface);
    font-size: var(--font-ui-small);
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .add-reading-target-modal button.schedule-date-btn:hover {
    border: none;
    box-shadow: none;
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .add-reading-target-modal button.schedule-date-btn:active {
    border: none;
    box-shadow: none;
    background: var(--background-modifier-active-hover);
    color: var(--text-normal);
  }

  .add-reading-target-modal button.schedule-date-btn:focus-visible {
    outline: none;
    border: none;
    box-shadow: 0 0 0 2px var(--background-modifier-border-focus);
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
