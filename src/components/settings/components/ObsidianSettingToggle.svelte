<!--
  Mounts an Obsidian native Setting toggle inside Svelte settings panels.
-->
<script lang="ts">
  import { Setting } from "obsidian";

  interface Props {
    name?: string;
    desc?: string;
    value: boolean;
    onChange: (value: boolean) => void;
    /** Hide the name/desc column (table cells / compact rows). */
    compact?: boolean;
    className?: string;
  }

  let {
    name = "",
    desc = "",
    value,
    onChange,
    compact = false,
    className = "",
  }: Props = $props();

  let host = $state<HTMLElement | null>(null);

  $effect(() => {
    const el = host;
    if (!el) {
      return;
    }

    const current = value;
    void name;
    void desc;
    void compact;

    el.replaceChildren();
    const setting = new Setting(el);
    if (name) {
      setting.setName(name);
    }
    if (desc) {
      setting.setDesc(desc);
    }
    if (compact) {
      setting.setClass("ir-obsidian-setting-toggle--compact");
    }
    setting.addToggle((toggle) => {
      toggle.setValue(current).onChange(onChange);
    });
  });
</script>

<div
  class={`ir-obsidian-setting-toggle-host${compact ? " ir-obsidian-setting-toggle-host--compact" : ""}${className ? ` ${className}` : ""}`}
  bind:this={host}
></div>

<style>
  .ir-obsidian-setting-toggle-host {
    width: 100%;
  }

  .ir-obsidian-setting-toggle-host :global(.setting-item) {
    border: none;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    padding: 0.65em 0;
  }

  .ir-obsidian-setting-toggle-host--compact {
    width: auto;
  }

  .ir-obsidian-setting-toggle-host--compact :global(.setting-item) {
    padding: 0;
    justify-content: flex-end;
  }

  .ir-obsidian-setting-toggle-host--compact :global(.setting-item-info) {
    display: none;
  }

  .ir-obsidian-setting-toggle-host--compact :global(.setting-item-control) {
    margin: 0;
  }

  .ir-obsidian-setting-toggle-host :global(.setting-item-name) {
    color: var(--text-normal);
  }

  .ir-obsidian-setting-toggle-host :global(.setting-item-description) {
    color: var(--text-muted);
  }
</style>
