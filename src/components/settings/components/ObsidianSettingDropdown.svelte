<!--
  Mounts an Obsidian native Setting dropdown inside Svelte settings panels.
-->
<script lang="ts">
  import { Setting } from "obsidian";

  export type ObsidianSettingDropdownOption = {
    id: string;
    label: string;
  };

  interface Props {
    name?: string;
    desc?: string;
    value: string;
    options: ObsidianSettingDropdownOption[];
    onChange: (value: string) => void;
    /** Hide the name/desc column (control-only rows). */
    compact?: boolean;
    className?: string;
  }

  let {
    name = "",
    desc = "",
    value,
    options,
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
    const optionList = options;
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
      setting.setClass("ir-obsidian-setting-dropdown--compact");
    }
    setting.addDropdown((dropdown) => {
      for (const option of optionList) {
        dropdown.addOption(option.id, option.label);
      }
      dropdown.setValue(current);
      dropdown.onChange(onChange);
    });
  });
</script>

<div
  class={`ir-obsidian-setting-dropdown-host${compact ? " ir-obsidian-setting-dropdown-host--compact" : ""}${className ? ` ${className}` : ""}`}
  bind:this={host}
></div>

<style>
  .ir-obsidian-setting-dropdown-host {
    width: 100%;
  }

  .ir-obsidian-setting-dropdown-host :global(.setting-item) {
    border: none;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    padding: 0.65em 0;
  }

  .ir-obsidian-setting-dropdown-host--compact {
    width: auto;
  }

  .ir-obsidian-setting-dropdown-host--compact :global(.setting-item) {
    padding: 0;
    justify-content: flex-end;
  }

  .ir-obsidian-setting-dropdown-host--compact :global(.setting-item-info) {
    display: none;
  }

  .ir-obsidian-setting-dropdown-host--compact :global(.setting-item-control) {
    margin: 0;
  }

  .ir-obsidian-setting-dropdown-host :global(.dropdown) {
    max-width: 100%;
  }

  .ir-obsidian-setting-dropdown-host :global(.setting-item-name) {
    color: var(--text-normal);
  }

  .ir-obsidian-setting-dropdown-host :global(.setting-item-description) {
    color: var(--text-muted);
  }
</style>
