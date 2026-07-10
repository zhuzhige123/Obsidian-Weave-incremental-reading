<script lang="ts">
  import ObsidianIcon from '../../ui/ObsidianIcon.svelte';
  import type { IRDeck } from '../../../types/ir-types';
  import type { SchedulingConfig, SchedulingImpact } from '../../../types/ir-import-scheduling';
  import { tr } from '../../../utils/i18n';
  import type { ImportContentBlock, InitialImportOrderingMode, WholeFileImportMode } from './material-import-types';
  import './material-import-modal.css';

  interface Props {
    isPdfImportMode: boolean;
    isEpubImportMode: boolean;
    isMultiFileMode: boolean;
    contentBlocks: ImportContentBlock[];
    previewIndex: number;
    previewTagGroupName: string;
    importing: boolean;
    selectedDeckId: string | null;
    availableDecks: IRDeck[];
    showNewDeckInput: boolean;
    newDeckName: string;
    creatingDeck: boolean;
    schedulingConfig: SchedulingConfig;
    schedulingImpact: SchedulingImpact | null;
    showSchedulingDetails: boolean;
    useCustomDays: boolean;
    customDaysValue: number;
    initialImportOrderingMode: InitialImportOrderingMode;
    wholeFileImportMode: WholeFileImportMode;
    showWholeFileImportModeSelector: boolean;
    showMarkdownImportFolderSelector: boolean;
    showSplitSourceBacklinkToggle: boolean;
    markdownImportFolderLabel: string;
    wholeFileImportModeLabel: string;
    schedulingDaysLabel: string;
    strategyLabel: string;
    initialImportOrderingLabel: string;
    selectedDeckLabel: string;
    showInitialImportOrderingSelector: boolean;
    splitSourceBacklinkSettingHost?: HTMLDivElement | null;
    onBack: () => void;
    onImport: () => void;
    onShowSchedulingDaysMenu: (evt: MouseEvent) => void;
    onShowSchedulingStrategyMenu: (evt: MouseEvent) => void;
    onShowInitialImportOrderingMenu: (evt: MouseEvent) => void;
    onToggleSchedulingDetails: () => void;
    onCustomDaysInput: (value: number) => void;
    onShowDeckSelectMenu: (evt: MouseEvent) => void;
    onCreateNewDeck: () => void;
    onCancelNewDeck: () => void;
    onShowWholeFileImportModeMenu: (evt: MouseEvent) => void;
    onShowMarkdownImportFolderMenu: () => void;
  }

  let {
    isPdfImportMode,
    isEpubImportMode,
    isMultiFileMode,
    contentBlocks,
    previewIndex = $bindable(),
    previewTagGroupName,
    importing,
    selectedDeckId,
    showNewDeckInput,
    newDeckName = $bindable(),
    creatingDeck,
    schedulingImpact,
    showSchedulingDetails,
    useCustomDays,
    customDaysValue,
    showWholeFileImportModeSelector,
    showMarkdownImportFolderSelector,
    showSplitSourceBacklinkToggle,
    markdownImportFolderLabel,
    wholeFileImportModeLabel,
    schedulingDaysLabel,
    strategyLabel,
    initialImportOrderingLabel,
    selectedDeckLabel,
    showInitialImportOrderingSelector,
    splitSourceBacklinkSettingHost = $bindable(),
    onBack,
    onImport,
    onShowSchedulingDaysMenu,
    onShowSchedulingStrategyMenu,
    onShowInitialImportOrderingMenu,
    onToggleSchedulingDetails,
    onCustomDaysInput,
    onShowDeckSelectMenu,
    onCreateNewDeck,
    onCancelNewDeck,
    onShowWholeFileImportModeMenu,
    onShowMarkdownImportFolderMenu
  }: Props = $props();

  let t = $derived($tr);
</script>

<div class="step-content preview-step">
  {#if isPdfImportMode}
    <div class="section-header">
      <h4 class="section-title">{t('irImport.preview.pdfOutline')}</h4>
      <span class="badge">{t('irImport.preview.bookmarkCount', { count: contentBlocks.length })}</span>
    </div>
    <div class="pdf-outline-list">
      {#if contentBlocks.length === 0}
        <div class="empty-state">
          <ObsidianIcon name="file-question" size={32} />
          <p class="empty-text">{t('irImport.preview.noPdfOutline')}</p>
          <p class="empty-hint-text">{t('irImport.preview.noPdfOutlineHint')}</p>
        </div>
      {:else}
        {#each contentBlocks as block, i}
          <div class="outline-item">
            <span class="outline-index">{i + 1}</span>
            <span class="outline-title">{block.title || t('irImport.preview.defaultPdfTitle')}</span>
            {#if block.pdfPageNumber}
              <span class="outline-page">p.{block.pdfPageNumber}</span>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  {:else if isEpubImportMode}
    <div class="section-header">
      <h4 class="section-title">{t('irImport.preview.epubChapters')}</h4>
      <span class="badge">{t('irImport.preview.chapterCount', { count: contentBlocks.length })}</span>
    </div>
    <div class="pdf-outline-list">
      {#each contentBlocks as block, i}
        <div class="outline-item">
          <span class="outline-index">{i + 1}</span>
          <span class="outline-title">{block.title || t('irImport.preview.defaultEpubTitle')}</span>
        </div>
      {/each}
    </div>
  {:else}
    <div class="preview-header">
      <button
        class="clickable-icon btn-icon"
        onclick={() => previewIndex = Math.max(0, previewIndex - 1)}
        disabled={previewIndex === 0}
      >
        <ObsidianIcon name="chevron-left" size={18} />
      </button>
      <span class="nav-info">
        <strong>{previewIndex + 1}</strong> / {contentBlocks.length}
      </span>
      <button
        class="clickable-icon btn-icon"
        onclick={() => previewIndex = Math.min(contentBlocks.length - 1, previewIndex + 1)}
        disabled={previewIndex === contentBlocks.length - 1}
      >
        <ObsidianIcon name="chevron-right" size={18} />
      </button>
      <span class="preview-count">{t('irImport.preview.totalBlocks', { count: contentBlocks.length })}</span>
      {#if previewTagGroupName}
        <span class="preview-tag-group">
          <ObsidianIcon name="tag" size={12} />
          {previewTagGroupName}
        </span>
      {/if}
    </div>

    <div class="preview-container">
      {#if contentBlocks.length > 0}
        <div class="preview-cards-wrapper">
          <div class="preview-card">
            <div class="card-header">
              <div class="card-meta-badges">
                <span class="meta-badge">
                  <ObsidianIcon name="type" size={12} />
                  {t('irImport.preview.charCount', { count: contentBlocks[previewIndex]?.charCount || 0 })}
                </span>
                <span class="meta-badge">
                  <ObsidianIcon name="hash" size={12} />
                  {previewIndex + 1}
                </span>
              </div>
            </div>

            <div class="card-content">
              <div class="content-scroll">
                <pre class="preview-text">{contentBlocks[previewIndex]?.content || ''}</pre>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<footer class="modal-footer modal-footer-preview">
  <button class="clickable-icon btn-secondary btn-compact" onclick={onBack}>
    <ObsidianIcon name="arrow-left" size={14} />
    {t('irImport.buttons.back')}
  </button>

  <div class="scheduling-selector">
    <div class="selector-row">
      <span class="selector-label">{t('irImport.scheduling.distributeTo')}</span>
      <button class="clickable-icon menu-trigger" onclick={onShowSchedulingDaysMenu}>
        {schedulingDaysLabel}
        <ObsidianIcon name="chevron-down" size={12} />
      </button>
      {#if useCustomDays}
        <input
          type="number"
          class="custom-days-input"
          min="1"
          max="90"
          placeholder={t('irImport.scheduling.customDaysPlaceholder')}
          value={customDaysValue}
          oninput={(e) => onCustomDaysInput(parseInt(e.currentTarget.value) || 14)}
        />
      {/if}
      <button class="clickable-icon menu-trigger" onclick={onShowSchedulingStrategyMenu}>
        {strategyLabel}
        <ObsidianIcon name="chevron-down" size={12} />
      </button>
      {#if showInitialImportOrderingSelector}
        <span class="selector-label">{t('irImport.scheduling.firstImport')}</span>
        <button class="clickable-icon menu-trigger" onclick={onShowInitialImportOrderingMenu}>
          <span class="clickable-icon menu-trigger-text">{initialImportOrderingLabel}</span>
          <ObsidianIcon name="chevron-down" size={12} />
        </button>
      {/if}
      <button
        class="clickable-icon btn-icon-sm"
        onclick={onToggleSchedulingDetails}
        title={t('irImport.scheduling.viewDetailsTitle')}
      >
        <ObsidianIcon name="info" size={14} />
      </button>
    </div>
    {#if showSchedulingDetails}
      <div class="scheduling-impact-summary">
        {#if schedulingImpact}
          <span class="impact-item">
            <ObsidianIcon name="alert-triangle" size={12} />
            {t('irImport.scheduling.overloadedDays')} <strong>{schedulingImpact.overloadedDays}</strong>
          </span>
          <span class="impact-item">
            <ObsidianIcon name="trending-up" size={12} />
            {t('irImport.scheduling.peakLoad')} <strong>{Math.round(schedulingImpact.peakLoadRate * 100)}%</strong>
          </span>
        {:else}
          <span class="impact-item">{t('irImport.scheduling.calculating')}</span>
        {/if}
      </div>
    {/if}
  </div>

  <div class="deck-selector">
    <span class="selector-label">{t('irImport.deck.label')}</span>
    {#if showNewDeckInput}
      <div class="new-deck-input">
        <input
          type="text"
          class="input-text deck-name-input"
          placeholder={t('irImport.deck.namePlaceholder')}
          bind:value={newDeckName}
          onkeydown={(e) => e.key === 'Enter' && onCreateNewDeck()}
        />
        <button class="clickable-icon btn-icon-sm" onclick={onCreateNewDeck} disabled={creatingDeck || !newDeckName.trim()}>
          <ObsidianIcon name="check" size={14} />
        </button>
        <button class="clickable-icon btn-icon-sm" onclick={onCancelNewDeck}>
          <ObsidianIcon name="x" size={14} />
        </button>
      </div>
    {:else}
      <button class="clickable-icon menu-trigger deck-trigger" onclick={onShowDeckSelectMenu}>
        {selectedDeckLabel}
        <ObsidianIcon name="chevron-down" size={12} />
      </button>
    {/if}
  </div>

  {#if showWholeFileImportModeSelector}
    <div class="deck-selector markdown-import-mode-selector">
      <span class="selector-label">{t('irImport.importMode.label')}</span>
      <button class="clickable-icon menu-trigger folder-trigger" onclick={onShowWholeFileImportModeMenu}>
        <span class="clickable-icon menu-trigger-text">{wholeFileImportModeLabel}</span>
        <ObsidianIcon name="chevron-down" size={12} />
      </button>
    </div>
  {/if}

  {#if showMarkdownImportFolderSelector}
    <div class="deck-selector markdown-folder-selector">
      <span class="selector-label">{t('irImport.mdPath.label')}</span>
      <button
        class="clickable-icon menu-trigger folder-trigger"
        onclick={onShowMarkdownImportFolderMenu}
        title={markdownImportFolderLabel}
      >
        <span class="clickable-icon menu-trigger-text">{markdownImportFolderLabel}</span>
        <ObsidianIcon name="chevron-down" size={12} />
      </button>
    </div>
  {/if}

  {#if showSplitSourceBacklinkToggle}
    <div class="split-source-backlink-toggle" bind:this={splitSourceBacklinkSettingHost}></div>
  {/if}

  <div class="footer-actions">
    <button class="clickable-icon btn-secondary btn-compact btn-back-mobile" onclick={onBack}>
      <ObsidianIcon name="arrow-left" size={14} />
      {t('irImport.buttons.back')}
    </button>
    <button
      class="btn-primary btn-compact"
      onclick={onImport}
      disabled={contentBlocks.length === 0 || importing || !selectedDeckId}
    >
      {#if importing}
        {t('irImport.buttons.importing')}
      {:else}
        {t('irImport.buttons.confirmImport')}
        <ObsidianIcon name="check" size={14} />
      {/if}
    </button>
  </div>
</footer>
