<script lang="ts">
  interface Props {
    label: string;
    disabled?: boolean;
    onClick?: () => void;
  }

  let {
    label,
    disabled = false,
    onClick
  }: Props = $props();

  function handleClick() {
    if (disabled) return;
    onClick?.();
  }
</script>

<button
  class="settings-help-trigger"
  aria-label={label}
  title={label}
  type="button"
  onclick={handleClick}
  disabled={disabled}
>
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
</button>

<style>
  .settings-help-trigger {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--interactive-accent);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    opacity: 0.8;
  }

  .settings-help-trigger:hover:not(:disabled) {
    opacity: 1;
    color: var(--interactive-accent);
    background: var(--interactive-accent-hover);
  }

  .settings-help-trigger:active:not(:disabled) {
    transform: scale(0.95);
    background: var(--background-modifier-active);
  }

  .settings-help-trigger:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .settings-help-trigger svg {
    width: 18px;
    height: 18px;
  }
</style>
