<script lang="ts">
  import type { ImportStep } from '../../../types/content-split-types';
  import { tr } from '../../../utils/i18n';

  interface Props {
    currentStep: ImportStep;
    isPdfImportMode: boolean;
    isEpubImportMode: boolean;
  }

  let { currentStep, isPdfImportMode, isEpubImportMode }: Props = $props();
  let t = $derived($tr);
</script>

{#if currentStep !== 'select'}
  <div class="step-indicator">
    <div class="step completed">
      <span class="step-num">1</span>
      <span class="step-label">{t('irImport.steps.select')}</span>
    </div>
    <div class="step-line"></div>
    <div
      class="step"
      class:completed={currentStep === 'preview'}
      class:active={currentStep === 'split-mode' || currentStep === 'configure'}
    >
      <span class="step-num">2</span>
      <span class="step-label">
        {isPdfImportMode || isEpubImportMode ? t('irImport.steps.outline') : t('irImport.steps.split')}
      </span>
    </div>
    <div class="step-line"></div>
    <div class="step" class:active={currentStep === 'preview'}>
      <span class="step-num">3</span>
      <span class="step-label">{t('irImport.steps.confirm')}</span>
    </div>
  </div>
{/if}
