<!--
  ReadingPointTraceLinkPromptPanel - 编辑溯源链接（链接输入 + 定位预览）
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { WeavePlugin } from '../../../main';
  import MarkdownRenderer from '../../atoms/MarkdownRenderer.svelte';
  import type { IRReadingPointEditDraft } from '../../../services/incremental-reading/reading-point-edit/IRReadingPointEditTypes';
  import { parseReadingTargetInput } from '../../../services/incremental-reading/reading-target/IRReadingTargetParser';
  import { buildReadingTargetPreviewMarkdown } from '../../../services/incremental-reading/reading-target/IRReadingTargetCurrentLocation';
  import { getReadingTargetKindLabel } from '../../../services/incremental-reading/reading-target/IRReadingTargetTitleResolver';
  import type { ParsedReadingTarget } from '../../../services/incremental-reading/reading-target/IRReadingTargetTypes';
  import { tr } from '../../../utils/i18n';

  export interface ReadingPointTraceLinkPanelState {
    linkInput: string;
    parsedTarget: ParsedReadingTarget | null;
    preserveScheduleOnLinkChange: boolean;
    dirty: boolean;
    canSubmit: boolean;
    previewMarkdown: string;
    previewSourcePath: string;
  }

  interface Props {
    plugin: WeavePlugin;
    draft: IRReadingPointEditDraft;
    onStateChange?: (state: ReadingPointTraceLinkPanelState) => void;
  }

  let { plugin, draft, onStateChange }: Props = $props();

  let t = $derived($tr);

  let linkInput = $state(draft.linkInput);
  const originalLinkInput = draft.originalLinkInput;
  let preserveScheduleOnLinkChange = $state(true);
  let parsedTarget = $state<ParsedReadingTarget | null>(null);
  let previewMarkdown = $state('');
  let previewSourcePath = $state('');
  let linkInputTouched = $state(false);

  const validationMessage = $derived(parsedTarget?.validationError || '');
  const linkChanged = $derived(linkInput.trim() !== originalLinkInput.trim());
  const kindLabel = $derived.by(() => {
    if (parsedTarget && parsedTarget.kind !== 'unknown') {
      return getReadingTargetKindLabel(parsedTarget.kind);
    }
    return '';
  });
  const canSubmit = $derived(
    !linkChanged ||
      Boolean(
        parsedTarget && !parsedTarget.validationError && parsedTarget.kind !== 'unknown'
      )
  );

  function buildPanelState(): ReadingPointTraceLinkPanelState {
    return {
      linkInput: linkInput.trim(),
      parsedTarget,
      preserveScheduleOnLinkChange,
      dirty: linkChanged,
      canSubmit,
      previewMarkdown,
      previewSourcePath,
    };
  }

  function refreshParsedTarget(): void {
    const contextPath = draft.sourceFile || plugin.app.workspace.getActiveFile()?.path || '';
    const trimmed = linkInput.trim();
    parsedTarget = trimmed ? parseReadingTargetInput(plugin.app, trimmed, contextPath) : null;
    previewMarkdown =
      parsedTarget && !parsedTarget.validationError && parsedTarget.kind !== 'unknown'
        ? buildReadingTargetPreviewMarkdown(parsedTarget, draft.title || t('irReadingPointEdit.previewFallback'))
        : '';
    previewSourcePath = parsedTarget?.sourceFilePath || contextPath;
  }

  function syncState(): void {
    onStateChange?.(buildPanelState());
  }

  function handleLinkInputChange(): void {
    linkInputTouched = true;
    refreshParsedTarget();
    syncState();
  }

  function handlePreserveScheduleChange(): void {
    syncState();
  }

  onMount(() => {
    refreshParsedTarget();
    syncState();
  });
</script>

<div class="reading-point-trace-link-body">
  <div class="add-reading-target-panel">
    <span class="panel-title">{t('irReadingPointEdit.traceLink.linkTitle')}</span>
    <textarea
      class="link-input"
      bind:value={linkInput}
      oninput={handleLinkInputChange}
      rows="4"
      placeholder={t('irReadingPointEdit.traceLink.linkPlaceholder')}
    ></textarea>
    {#if parsedTarget && parsedTarget.kind !== 'unknown' && !validationMessage}
      <div class="target-meta">
        <span class="target-kind">{kindLabel}</span>
      </div>
    {/if}
    {#if validationMessage && linkInputTouched}
      <p class="field-error">{validationMessage}</p>
    {:else if !linkInput.trim()}
      <p class="field-hint">{t('irReadingPointEdit.traceLink.supportedFormatsHint')}</p>
    {/if}
  </div>

  {#if previewMarkdown}
    <div class="add-reading-target-panel preview-panel">
      <span class="panel-title">{t('irReadingPointEdit.traceLink.locationPreview')}</span>
      <div class="preview-surface">
        <MarkdownRenderer plugin={plugin} source={previewMarkdown} sourcePath={previewSourcePath} />
      </div>
    </div>
  {/if}

  {#if linkChanged}
    <div class="add-reading-target-panel preserve-panel">
      <label class="preserve-toggle">
        <input
          type="checkbox"
          bind:checked={preserveScheduleOnLinkChange}
          onchange={handlePreserveScheduleChange}
        />
        <span>{t('irReadingPointEdit.traceLink.preserveSchedule')}</span>
      </label>
      <p class="field-hint">{t('irReadingPointEdit.traceLink.preserveScheduleHint')}</p>
    </div>
  {/if}
</div>

<style>
  .reading-point-trace-link-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    min-width: 0;
  }

  .add-reading-target-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    width: 100%;
  }

  .panel-title {
    font-size: var(--font-ui-small);
    font-weight: var(--font-semibold);
    color: var(--text-normal);
  }

  .link-input {
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

  .target-kind {
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

  .preserve-panel {
    gap: 6px;
  }

  .preserve-toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-ui-small);
    color: var(--text-normal);
    cursor: pointer;
  }
</style>
