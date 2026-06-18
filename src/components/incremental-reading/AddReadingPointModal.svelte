<!--
  AddReadingPointModal - 新增阅读点弹窗
  
  支持粘贴 PDF++ callout 文本，自动解析标题/链接/页码，
  推断层级关系，用户可手动调整后批量创建阅读点。
  
  @module components/incremental-reading/AddReadingPointModal
-->
<script lang="ts">
  import { Notice } from 'obsidian';
  import type { WeavePlugin } from '../../main';
  import { IRPointWriteService } from '../../services/incremental-reading/IRPointWriteService';
  import { recomputeAndBroadcastIRData } from '../../services/incremental-reading/IRScheduleRefreshService';
  import { parsePdfCallouts } from '../../utils/pdf-callout-parser';
  import type { ParsedReadingPoint } from '../../utils/pdf-callout-parser';
  import ObsidianIcon from '../ui/ObsidianIcon.svelte';
  import { logger } from '../../utils/logger';
  import { tr } from '../../utils/i18n';

  interface Props {
    plugin: WeavePlugin;
    deckId: string;
    pdfPath: string;
    parentTitle: string;
    onClose: () => void;
    onCreated: () => void;
  }

  let { plugin, deckId, pdfPath, parentTitle, onClose, onCreated }: Props = $props();

  let t = $derived($tr);

  let pasteText = $state('');
  let parsedPoints = $state<ParsedReadingPoint[]>([]);
  let isParsed = $state(false);
  let creating = $state(false);
  let editingIndex = $state<number | null>(null);
  let editTitle = $state('');

  function handleParse(): void {
    if (!pasteText.trim()) {
      new Notice(t('irAddReadingPoint.notices.pasteRequired'));
      return;
    }

    const results = parsePdfCallouts(pasteText);
    if (results.length === 0) {
      new Notice(t('irAddReadingPoint.notices.parseFailed'));
      return;
    }

    parsedPoints = results;
    isParsed = true;
  }

  function startEdit(index: number): void {
    editingIndex = index;
    editTitle = parsedPoints[index].title;
  }

  function confirmEdit(index: number): void {
    if (editTitle.trim()) {
      parsedPoints[index].title = editTitle.trim();
      parsedPoints = [...parsedPoints];
    }
    editingIndex = null;
  }

  function cancelEdit(): void {
    editingIndex = null;
  }

  function removePoint(index: number): void {
    parsedPoints = parsedPoints.filter((_, i) => i !== index);
    if (parsedPoints.length === 0) {
      isParsed = false;
    }
  }

  function adjustLevel(index: number, delta: number): void {
    const newLevel = Math.max(0, parsedPoints[index].level + delta);
    parsedPoints[index].level = newLevel;
    parsedPoints = [...parsedPoints];
  }

  function movePoint(index: number, delta: number): void {
    const newIndex = index + delta;
    if (newIndex < 0 || newIndex >= parsedPoints.length) return;
    const temp = parsedPoints[index];
    parsedPoints[index] = parsedPoints[newIndex];
    parsedPoints[newIndex] = temp;
    parsedPoints = [...parsedPoints];
  }

  function resetToPaste(): void {
    isParsed = false;
    parsedPoints = [];
  }

  async function handleConfirm(): Promise<void> {
    if (parsedPoints.length === 0) return;

    creating = true;
    try {
      const pointWriteService = new IRPointWriteService(plugin.app);

      let createdCount = 0;
      for (const pt of parsedPoints) {
        await pointWriteService.createPdfPoint({
          deckId,
          pdfPath,
          title: pt.title,
          link: pt.resumeLink
        });
        createdCount++;
      }

      new Notice(t('irAddReadingPoint.notices.created', { count: createdCount }));
      logger.info(`[AddReadingPointModal] 创建 ${createdCount} 个阅读点 for ${pdfPath}`);

      await recomputeAndBroadcastIRData(plugin.app, 'import_materials');
      onCreated();
      onClose();
    } catch (error) {
      logger.error('[AddReadingPointModal] 创建阅读点失败:', error);
      new Notice(t('irAddReadingPoint.notices.createFailed', {
        message: error instanceof Error ? error.message : t('irAddReadingPoint.notices.unknownError')
      }));
    } finally {
      creating = false;
    }
  }

  function handleOverlayClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
      onClose();
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={handleOverlayClick}>
  <div class="arp-modal">
    <div class="arp-header">
      <h3>{t('irAddReadingPoint.title')}</h3>
      <span class="arp-parent-info" title={pdfPath}>
        {parentTitle}
      </span>
      <button type="button" class="clickable-icon arp-close" onclick={onClose} aria-label={t('irAddReadingPoint.closeAriaLabel')}>
        <ObsidianIcon name="x" size={16} />
      </button>
    </div>

    <div class="arp-body">
      {#if !isParsed}
        <div class="arp-paste-section">
          <p class="arp-hint">
            {t('irAddReadingPoint.hint')}
          </p>
          <textarea
            class="arp-textarea"
            bind:value={pasteText}
            placeholder={t('irAddReadingPoint.placeholder')}
            rows={10}
          ></textarea>
        </div>
      {:else}
        <div class="arp-results-section">
          <div class="arp-results-header">
            <span class="arp-results-count">{t('irAddReadingPoint.parsedCount', { count: parsedPoints.length })}</span>
            <button class="arp-btn-text" onclick={resetToPaste}>
              <ObsidianIcon name="arrow-left" size={14} />
              {t('irAddReadingPoint.rePaste')}
            </button>
          </div>

          <div class="arp-points-list">
            {#each parsedPoints as pt, index (index)}
              <div class="arp-point-item" style="padding-left: {16 + pt.level * 20}px">
                <div class="arp-point-level-controls">
                  <button
                    class="clickable-icon arp-btn-icon"
                    onclick={() => adjustLevel(index, -1)}
                    disabled={pt.level === 0}
                    title={t('irAddReadingPoint.actions.decreaseLevel')}
                  >
                    <ObsidianIcon name="chevron-left" size={12} />
                  </button>
                  <button
                    class="clickable-icon arp-btn-icon"
                    onclick={() => adjustLevel(index, 1)}
                    title={t('irAddReadingPoint.actions.increaseLevel')}
                  >
                    <ObsidianIcon name="chevron-right" size={12} />
                  </button>
                </div>

                <div class="arp-point-content">
                  {#if editingIndex === index}
                    <input
                      class="arp-edit-input"
                      bind:value={editTitle}
                      onkeydown={(e) => {
                        if (e.key === 'Enter') confirmEdit(index);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      onblur={() => confirmEdit(index)}
                    />
                  {:else}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <span class="arp-point-title" ondblclick={() => startEdit(index)}>
                      {pt.title}
                    </span>
                  {/if}
                  <span class="arp-point-page">p.{pt.pageNumber}</span>
                </div>

                <div class="arp-point-actions">
                  <button type="button" class="clickable-icon arp-btn-icon" onclick={() => movePoint(index, -1)} disabled={index === 0} title={t('irAddReadingPoint.actions.moveUp')}>
                    <ObsidianIcon name="chevron-up" size={12} />
                  </button>
                  <button type="button" class="clickable-icon arp-btn-icon" onclick={() => movePoint(index, 1)} disabled={index === parsedPoints.length - 1} title={t('irAddReadingPoint.actions.moveDown')}>
                    <ObsidianIcon name="chevron-down" size={12} />
                  </button>
                  <button type="button" class="clickable-icon arp-btn-icon danger" onclick={() => removePoint(index)} title={t('irAddReadingPoint.actions.remove')}>
                    <ObsidianIcon name="trash-2" size={12} />
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <div class="arp-footer">
      <button class="arp-btn-secondary" onclick={onClose}>{t('irAddReadingPoint.actions.cancel')}</button>
      {#if !isParsed}
        <button class="arp-btn-primary" onclick={handleParse} disabled={!pasteText.trim()}>
          {t('irAddReadingPoint.actions.parse')}
        </button>
      {:else}
        <button class="arp-btn-primary" onclick={handleConfirm} disabled={parsedPoints.length === 0 || creating}>
          {creating ? t('irAddReadingPoint.actions.creating') : t('irAddReadingPoint.actions.confirmCreate', { count: parsedPoints.length })}
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--layer-modal);
  }

  .arp-modal {
    width: 520px;
    max-width: 90vw;
    max-height: 80vh;
    background: var(--background-primary);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .arp-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .arp-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
    flex-shrink: 0;
  }

  .arp-parent-info {
    flex: 1;
    font-size: 12px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .arp-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    flex-shrink: 0;
  }

  .arp-close:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .arp-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    min-height: 200px;
  }

  .arp-hint {
    margin: 0 0 8px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .arp-textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-secondary);
    color: var(--text-normal);
    font-family: var(--font-monospace);
    font-size: 12px;
    line-height: 1.5;
    resize: vertical;
    outline: none;
  }

  .arp-textarea:focus {
    border-color: var(--interactive-accent);
  }

  .arp-textarea::placeholder {
    color: var(--text-faint);
  }

  .arp-results-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .arp-results-count {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 500;
  }

  .arp-points-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .arp-point-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 4px;
    transition: background 0.1s;
  }

  .arp-point-item:hover {
    background: var(--background-secondary);
  }

  .arp-point-level-controls {
    display: flex;
    gap: 1px;
    flex-shrink: 0;
  }

  .arp-point-content {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .arp-point-title {
    flex: 1;
    font-size: 13px;
    color: var(--text-normal);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: text;
  }

  .arp-point-page {
    flex-shrink: 0;
    font-size: 11px;
    color: var(--text-faint);
    padding: 1px 6px;
    background: var(--background-secondary);
    border-radius: 4px;
  }

  .arp-edit-input {
    flex: 1;
    padding: 2px 6px;
    border: 1px solid var(--interactive-accent);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 13px;
    outline: none;
  }

  .arp-point-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.1s;
  }

  .arp-point-item:hover .arp-point-actions {
    opacity: 1;
  }

  .arp-btn-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.1s;
  }

  .arp-btn-icon:hover:not(:disabled) {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .arp-btn-icon:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .arp-btn-icon.danger:hover:not(:disabled) {
    color: var(--text-error);
  }

  .arp-btn-text {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
  }

  .arp-btn-text:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .arp-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .arp-btn-secondary {
    padding: 6px 14px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: transparent;
    color: var(--text-normal);
    font-size: 13px;
    cursor: pointer;
  }

  .arp-btn-secondary:hover {
    background: var(--background-secondary);
  }

  .arp-btn-primary {
    padding: 6px 14px;
    border: none;
    border-radius: 6px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  }

  .arp-btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .arp-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
