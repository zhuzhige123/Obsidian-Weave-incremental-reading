<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    open: boolean;
    title: string;
    closeLabel?: string;
    confirmLabel?: string;
    maxWidth?: string;
    showFooter?: boolean;
    onClose?: () => void;
    children?: Snippet;
    footer?: Snippet;
  }

  let {
    open,
    title,
    closeLabel = 'Close',
    confirmLabel = 'OK',
    maxWidth = '560px',
    showFooter = true,
    onClose,
    children,
    footer
  }: Props = $props();

  const titleId = `settings-help-modal-title-${Math.random().toString(36).slice(2, 10)}`;

  function closeModal() {
    onClose?.();
  }

  function handleOverlayClick(event: MouseEvent) {
    if (event.target !== event.currentTarget) return;
    closeModal();
  }

  function handleOverlayKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }

    if (event.target !== event.currentTarget) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      closeModal();
    }
  }
</script>

{#if open}
  <div
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    tabindex="-1"
    onclick={handleOverlayClick}
    onkeydown={handleOverlayKeydown}
  >
    <div
      class="help-modal"
      role="document"
      tabindex="-1"
      style:--settings-help-modal-width={maxWidth}
    >
      <div class="help-modal-header">
        <h3 id={titleId}>{title}</h3>
        <button
          class="close-btn"
          type="button"
          aria-label={closeLabel}
          onclick={closeModal}
        >&times;</button>
      </div>

      <div class="help-modal-content settings-help-modal-content">
        {@render children?.()}
      </div>

      {#if showFooter}
        <div class="help-modal-footer">
          {#if footer}
            {@render footer()}
          {:else}
            <button class="btn btn-primary" type="button" onclick={closeModal}>
              {confirmLabel}
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--weave-z-overlay);
    backdrop-filter: blur(2px);
  }

  .help-modal {
    background: var(--background-primary);
    border-radius: var(--radius-l);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    max-width: var(--settings-help-modal-width);
    width: 90%;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .help-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-4);
    padding: var(--size-4-5) var(--size-4-6);
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .help-modal-header h3 {
    margin: 0;
    font-size: var(--font-ui-larger);
    font-weight: 600;
    color: var(--text-normal);
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: var(--radius-s);
    background: transparent;
    color: var(--text-muted);
    font-size: var(--font-ui-larger);
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .close-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .help-modal-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--size-4-6);
  }

  .settings-help-modal-content :global(.help-item) {
    margin-bottom: 24px;
  }

  .settings-help-modal-content :global(.help-item:last-child) {
    margin-bottom: 0;
  }

  .settings-help-modal-content :global(.help-item-title) {
    font-size: var(--font-ui-medium);
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 8px;
  }

  .settings-help-modal-content :global(.help-item-desc) {
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    line-height: 1.6;
    margin: 0;
  }

  .settings-help-modal-content :global(.help-item-desc + .help-item-desc) {
    margin-top: 10px;
  }

  .settings-help-modal-content :global(.help-item-desc strong) {
    color: var(--text-normal);
    font-weight: 600;
  }

  .settings-help-modal-content :global(.help-list) {
    margin: 8px 0 0 0;
    padding-left: 20px;
    list-style: disc;
  }

  .settings-help-modal-content :global(.help-list li) {
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    line-height: 1.8;
    margin-bottom: 6px;
  }

  .settings-help-modal-content :global(.help-list li strong) {
    color: var(--text-normal);
    font-weight: 600;
  }

  .help-modal-footer {
    padding: var(--size-4-4) var(--size-4-6);
    border-top: 1px solid var(--background-modifier-border);
    display: flex;
    justify-content: flex-end;
  }

  .help-modal-footer .btn {
    min-width: 100px;
  }

  @media (max-width: 640px) {
    .help-modal {
      max-width: 95%;
      margin: 10px;
    }

    .help-modal-header {
      padding: var(--size-4-4) var(--size-4-5);
    }

    .help-modal-content {
      padding: var(--size-4-5);
    }

    .help-modal-footer {
      padding: var(--size-4-3) var(--size-4-5);
    }
  }
</style>
