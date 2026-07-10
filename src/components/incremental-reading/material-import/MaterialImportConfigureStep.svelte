<script lang="ts">
  import ObsidianIcon from '../../ui/ObsidianIcon.svelte';
  import type { RuleSplitConfig } from '../../../types/content-split-types';
  import { tr } from '../../../utils/i18n';
  import './material-import-modal.css';

  interface Props {
    ruleSplitConfig: RuleSplitConfig;
    onBack: () => void;
    onConfirm: () => void;
  }

  let { ruleSplitConfig = $bindable(), onBack, onConfirm }: Props = $props();
  let t = $derived($tr);
</script>

<div class="step-content">
  <div class="section-header">
    <h4 class="section-title">{t('irImport.configure.sectionTitle')}</h4>
  </div>

  <div class="config-form">
    <div class="config-group">
      <label class="config-toggle">
        <input type="checkbox" bind:checked={ruleSplitConfig.enableWholeFile} />
        <span class="toggle-label">{t('irImport.configure.wholeFile')}</span>
      </label>
      {#if ruleSplitConfig.enableWholeFile}
        <div class="config-options">
          <span class="option-hint">{t('irImport.configure.wholeFileHint')}</span>
        </div>
      {/if}
    </div>

    <div class="config-group">
      <label class="config-toggle">
        <input type="checkbox" bind:checked={ruleSplitConfig.enableHeadingSplit} disabled={ruleSplitConfig.enableWholeFile} />
        <span class="toggle-label">{t('irImport.configure.headingSplit')}</span>
      </label>
      {#if ruleSplitConfig.enableHeadingSplit}
        <div class="config-options">
          <span class="option-label">{t('irImport.configure.headingLevels')}</span>
          <div class="checkbox-group">
            {#each [1, 2, 3, 4, 5, 6] as level}
              <label class="checkbox-item">
                <input
                  type="checkbox"
                  checked={ruleSplitConfig.headingLevels.includes(level)}
                  onchange={() => {
                    if (ruleSplitConfig.headingLevels.includes(level)) {
                      ruleSplitConfig.headingLevels = ruleSplitConfig.headingLevels.filter((l) => l !== level);
                    } else {
                      ruleSplitConfig.headingLevels = [...ruleSplitConfig.headingLevels, level].sort();
                    }
                  }}
                />
                <span>H{level}</span>
              </label>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <div class="config-group">
      <label class="config-toggle">
        <input type="checkbox" bind:checked={ruleSplitConfig.enableBlankLineSplit} disabled={ruleSplitConfig.enableWholeFile} />
        <span class="toggle-label">{t('irImport.configure.blankLineSplit')}</span>
      </label>
      {#if ruleSplitConfig.enableBlankLineSplit}
        <div class="config-options">
          <span class="option-label">{t('irImport.configure.blankLineCount')}</span>
          <input type="number" class="input-number" min="1" max="10" bind:value={ruleSplitConfig.blankLineCount} />
        </div>
      {/if}
    </div>

    <div class="config-group">
      <label class="config-toggle">
        <input type="checkbox" bind:checked={ruleSplitConfig.enableSymbolSplit} disabled={ruleSplitConfig.enableWholeFile} />
        <span class="toggle-label">{t('irImport.configure.symbolSplit')}</span>
      </label>
      {#if ruleSplitConfig.enableSymbolSplit}
        <div class="config-options">
          <span class="option-label">{t('irImport.configure.splitSymbol')}</span>
          <input
            type="text"
            class="input-text"
            bind:value={ruleSplitConfig.splitSymbol}
            placeholder={t('irImport.configure.splitSymbolPlaceholder')}
          />
        </div>
      {/if}
    </div>

    <div class="config-group">
      <label class="config-toggle">
        <input type="checkbox" bind:checked={ruleSplitConfig.filterEmptyBlocks} />
        <span class="toggle-label">{t('irImport.configure.filterEmpty')}</span>
      </label>
    </div>

    <div class="config-group">
      <label class="config-toggle">
        <input type="checkbox" bind:checked={ruleSplitConfig.preserveHeadingAsTitle} />
        <span class="toggle-label">{t('irImport.configure.preserveHeading')}</span>
      </label>
    </div>

    <div class="config-group">
      <div class="config-options">
        <span class="option-label">{t('irImport.configure.minCharCount')}</span>
        <input type="number" class="input-number" min="0" max="1000" bind:value={ruleSplitConfig.minBlockCharCount} />
      </div>
    </div>
  </div>
</div>

<footer class="modal-footer modal-footer-row">
  <button class="clickable-icon btn-secondary btn-compact" onclick={onBack}>
    <ObsidianIcon name="arrow-left" size={14} />
    {t('irImport.buttons.back')}
  </button>
  <button class="btn-primary btn-compact" onclick={onConfirm}>
    {t('irImport.buttons.next')}
    <ObsidianIcon name="arrow-right" size={14} />
  </button>
</footer>
