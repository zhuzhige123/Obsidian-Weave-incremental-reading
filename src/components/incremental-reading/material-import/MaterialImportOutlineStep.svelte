<script lang="ts">
  import ObsidianIcon from '../../ui/ObsidianIcon.svelte';
  import { tr } from '../../../utils/i18n';
  import { buildOutlineDisplayTitle } from './material-import-outline-utils';
  import type { OutlineSelectionItem } from './material-import-types';
  import './material-import-modal.css';

  interface Props {
    isPdfImportMode: boolean;
    isEpubImportMode: boolean;
    loadingOutline: boolean;
    outlineAllItems: OutlineSelectionItem[];
    outlineVisibleItems: OutlineSelectionItem[];
    outlineAvailableLevels: number[];
    outlineSelectedLevels: number[];
    outlineSelectedIds: Set<string>;
    isMultiFileMode: boolean;
    onBack: () => void;
    onConfirm: () => void;
    onToggleLevel: (level: number) => void;
    onToggleItem: (id: string) => void;
    onSelectAll: () => void;
    onSelectNone: () => void;
  }

  let {
    isPdfImportMode,
    isEpubImportMode,
    loadingOutline,
    outlineAllItems,
    outlineVisibleItems,
    outlineAvailableLevels,
    outlineSelectedLevels,
    outlineSelectedIds,
    isMultiFileMode,
    onBack,
    onConfirm,
    onToggleLevel,
    onToggleItem,
    onSelectAll,
    onSelectNone
  }: Props = $props();

  let t = $derived($tr);

  const visibleOutlineCount = $derived(outlineVisibleItems.length);
  const selectedOutlineCount = $derived(outlineSelectedIds.size);
  const allVisibleOutlineSelected = $derived(
    outlineVisibleItems.length > 0 && outlineVisibleItems.every((item) => outlineSelectedIds.has(item.id))
  );

  function getOutlineUnitLabel(): string {
    return isPdfImportMode ? t('irImport.outline.bookmark') : t('irImport.outline.chapter');
  }

  function getOutlineStepTitle(): string {
    return isPdfImportMode ? t('irImport.outline.pdfSelection') : t('irImport.outline.epubSelection');
  }
</script>

<div class="step-content step-content-framed">
  <div class="section-header">
    <h4 class="section-title">{getOutlineStepTitle()}</h4>
    <span class="badge">{t('irImport.outline.countBadge', { count: visibleOutlineCount, unit: getOutlineUnitLabel() })}</span>
  </div>

  <div class="step-body">
    {#if loadingOutline}
      <div class="empty-state step-fill-state">
        <p class="empty-text">{isPdfImportMode ? t('irImport.outline.parsingPdf') : t('irImport.outline.parsingEpub')}</p>
      </div>
    {:else if outlineAllItems.length === 0}
      <div class="empty-state step-fill-state">
        <ObsidianIcon name="file-question" size={32} />
        <p class="empty-text">{isPdfImportMode ? t('irImport.outline.noOutlinePdf') : t('irImport.outline.noOutlineEpub')}</p>
        <p class="empty-hint-text">{isPdfImportMode ? t('irImport.outline.noOutlinePdfHint') : t('irImport.outline.noOutlineEpubHint')}</p>
      </div>
    {:else if outlineSelectedLevels.length === 0}
      <div class="empty-state step-fill-state">
        <ObsidianIcon name="list" size={32} />
        <p class="empty-text">{t('irImport.outline.selectLevel')}</p>
        <p class="empty-hint-text">{t('irImport.outline.selectLevelHint')}</p>
      </div>
    {:else}
      <div class="outline-stage">
        <div class="outline-selection-toolbar">
          <div class="config-group">
            <span class="option-label">{t('irImport.outline.levelLabel')}</span>
            <div class="checkbox-group">
              {#each outlineAvailableLevels as level}
                <button
                  class="level-btn"
                  class:active={outlineSelectedLevels.includes(level)}
                  onclick={() => onToggleLevel(level)}
                >
                  L{level}
                </button>
              {/each}
            </div>
            <div class="outline-toolbar-actions">
              <button
                class="clickable-icon btn-secondary btn-compact"
                onclick={onSelectAll}
                disabled={outlineVisibleItems.length === 0 || allVisibleOutlineSelected}
              >
                {t('irImport.outline.selectAll')}
              </button>
              <button
                class="clickable-icon btn-secondary btn-compact"
                onclick={onSelectNone}
                disabled={selectedOutlineCount === 0}
              >
                {t('irImport.outline.selectNone')}
              </button>
            </div>
            <span class="info-text" style="margin-left: auto;">
              {t('irImport.outline.selectedCount', { selected: selectedOutlineCount, visible: visibleOutlineCount })}
            </span>
          </div>
        </div>

        <div class="pdf-outline-list">
          {#each outlineVisibleItems as item, i}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="outline-item outline-selectable"
              class:selected={outlineSelectedIds.has(item.id)}
              onclick={(event) => {
                if ((event.target as HTMLElement).closest('.checkbox-wrapper')) return;
                onToggleItem(item.id);
              }}
              style="padding-left: {12 + (item.level - 1) * 16}px"
            >
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
              <label class="checkbox-wrapper">
                <input
                  type="checkbox"
                  checked={outlineSelectedIds.has(item.id)}
                  onchange={() => onToggleItem(item.id)}
                />
                <span class="checkbox-box"></span>
              </label>
              <span class="outline-index">{i + 1}</span>
              <span class="outline-title">{buildOutlineDisplayTitle(item, isMultiFileMode)}</span>
              {#if item.pageNumber}
                <span class="outline-page">p.{item.pageNumber}</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<footer class="modal-footer modal-footer-row">
  <button class="clickable-icon btn-secondary btn-compact" onclick={onBack}>
    <ObsidianIcon name="arrow-left" size={14} />
    {t('irImport.buttons.back')}
  </button>
  <button class="btn-primary btn-compact" onclick={onConfirm} disabled={selectedOutlineCount === 0}>
    {t('irImport.buttons.nextWithCount', { count: selectedOutlineCount })}
    <ObsidianIcon name="arrow-right" size={14} />
  </button>
</footer>
