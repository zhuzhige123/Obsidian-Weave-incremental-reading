<script lang="ts">
  interface Props {
    onAction?: (actionId: string) => void;
  }

  let { onAction }: Props = $props();

  const buttons = [
    { id: 'review', label: '复查' },
    { id: 'tomorrow', label: '明天' },
    { id: 'normal', label: '正常' },
    { id: 'in3days', label: '3天后' },
    { id: 'intensive', label: '攻坚' },
    { id: 'in10days', label: '10天后' },
    { id: 'later', label: '稍后' },
    { id: 'plus2days', label: '+2天' }
  ] as const;
</script>

<div class="weave-ir-bottom-toolbar-preview" aria-label="weave-ir-bottom-toolbar-preview">
  <div class="btn-row">
    {#each buttons as btn (btn.id)}
      <button
        type="button"
        class="clickable-icon weave-ir-bottom-toolbar-preview__btn"
        onclick={() => onAction?.(btn.id)}
      >
        {btn.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .weave-ir-bottom-toolbar-preview {
    width: 100%;
    position: sticky;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    padding: 10px 12px;
    background: transparent;
    z-index: 50;
  }

  .btn-row {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
  }

  .weave-ir-bottom-toolbar-preview :global(button.weave-ir-bottom-toolbar-preview__btn) {
    appearance: none;
    -webkit-appearance: none;
    width: auto;
    height: auto;
    min-height: 40px;
    padding: 0 10px;
    border: none;
    box-shadow: none;
    background: transparent;
    border-radius: var(--clickable-icon-radius, 999px);
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
  }

  .weave-ir-bottom-toolbar-preview :global(button.weave-ir-bottom-toolbar-preview__btn:hover) {
    color: var(--text-normal);
    background-color: var(--background-modifier-hover);
  }
</style>
