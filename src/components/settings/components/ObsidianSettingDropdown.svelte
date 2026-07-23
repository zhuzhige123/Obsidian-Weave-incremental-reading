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
    name: string;
    desc?: string;
    value: string;
    options: ObsidianSettingDropdownOption[];
    onChange: (value: string) => void;
    className?: string;
  }

  let {
    name,
    desc = "",
    value,
    options,
    onChange,
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

    el.replaceChildren();
    const setting = new Setting(el).setName(name);
    if (desc) {
      setting.setDesc(desc);
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
  class={`ir-obsidian-setting-dropdown-host${className ? ` ${className}` : ""}`}
  bind:this={host}
></div>

<style>
  .ir-obsidian-setting-dropdown-host {
    width: 100%;
  }

  .ir-obsidian-setting-dropdown-host :global(.setting-item) {
    border: none;
    padding: 0;
  }

  .ir-obsidian-setting-dropdown-host :global(.dropdown) {
    max-width: 100%;
  }
</style>
