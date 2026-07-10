<script lang="ts">
  import ObsidianIcon from '../../ui/ObsidianIcon.svelte';

  interface Props {
    t: (key: string, vars?: Record<string, string | number>) => string;
    selectedCount: number;
    onSelectAllDisplayed: () => void;
    onClearSelection: () => void;
    onShowBatchActionsMenu: (event: MouseEvent) => void;
    onExitSelectionMode: () => void;
  }

  let {
    t,
    selectedCount,
    onSelectAllDisplayed,
    onClearSelection,
    onShowBatchActionsMenu,
    onExitSelectionMode,
  }: Props = $props();
</script>

<div class="batch-floating-toolbar" role="toolbar" aria-label={t('irSidebar.batch.modeActive')}>
  <span
    class="batch-floating-toolbar__count"
    title={t('irSidebar.batch.selectedCount', { count: selectedCount })}
    aria-label={t('irSidebar.batch.selectedCount', { count: selectedCount })}
  >
    {selectedCount}
  </span>
  <div class="batch-floating-toolbar__actions">
    <button
      type="button"
      class="clickable-icon batch-floating-toolbar__btn"
      onclick={onSelectAllDisplayed}
      title={t('irSidebar.batch.selectAllVisible')}
      aria-label={t('irSidebar.batch.selectAllVisible')}
    >
      <ObsidianIcon name="square-check" size={16} />
    </button>
    {#if selectedCount > 0}
      <button
        type="button"
        class="clickable-icon batch-floating-toolbar__btn"
        onclick={onClearSelection}
        title={t('irSidebar.batch.clearSelection')}
        aria-label={t('irSidebar.batch.clearSelection')}
      >
        <ObsidianIcon name="eraser" size={16} />
      </button>
      <button
        type="button"
        class="clickable-icon batch-floating-toolbar__btn batch-floating-toolbar__btn--primary"
        onclick={onShowBatchActionsMenu}
        title={t('irSidebar.batch.openBatchActions')}
        aria-label={t('irSidebar.batch.openBatchActions')}
      >
        <ObsidianIcon name="copy-check" size={16} />
      </button>
    {/if}
    <button
      type="button"
      class="clickable-icon batch-floating-toolbar__btn"
      onclick={onExitSelectionMode}
      title={t('irSidebar.batch.exitSelectionMode')}
      aria-label={t('irSidebar.batch.exitSelectionMode')}
    >
      <ObsidianIcon name="x" size={16} />
    </button>
  </div>
</div>
