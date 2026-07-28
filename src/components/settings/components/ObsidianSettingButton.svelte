<!--
  Mounts an Obsidian native Setting button inside Svelte settings panels.
-->
<script lang="ts">
  import { Setting } from "obsidian";

  interface Props {
    name: string;
    desc?: string;
    buttonText: string;
    onClick: () => void;
    cta?: boolean;
    className?: string;
  }

  let {
    name,
    desc = "",
    buttonText,
    onClick,
    cta = false,
    className = "",
  }: Props = $props();

  let host = $state<HTMLElement | null>(null);

  $effect(() => {
    const el = host;
    if (!el) {
      return;
    }

    void name;
    void desc;
    void buttonText;
    void cta;

    el.replaceChildren();
    const setting = new Setting(el).setName(name);
    if (desc) {
      setting.setDesc(desc);
    }
    setting.addButton((button) => {
      button.setButtonText(buttonText).onClick(onClick);
      if (cta) {
        button.setCta();
      }
    });
  });
</script>

<div
  class={`ir-obsidian-setting-button-host${className ? ` ${className}` : ""}`}
  bind:this={host}
></div>

<style>
  .ir-obsidian-setting-button-host {
    width: 100%;
  }

  .ir-obsidian-setting-button-host :global(.setting-item) {
    border: none;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    padding: 0.65em 0;
  }

  .ir-obsidian-setting-button-host :global(.setting-item-name) {
    color: var(--text-normal);
  }

  .ir-obsidian-setting-button-host :global(.setting-item-description) {
    color: var(--text-muted);
  }
</style>
