<!--
  Mounts an Obsidian native Setting text input inside Svelte settings panels.
  Structural props remount the Setting; value updates sync in place to keep focus.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import { Setting } from "obsidian";

  interface Props {
    name: string;
    desc?: string;
    value: string;
    placeholder?: string;
    /** When set, configures the underlying input as a number field. */
    inputType?: "text" | "number";
    min?: number;
    max?: number;
    step?: number;
    onChange: (value: string) => void;
    className?: string;
  }

  let {
    name,
    desc = "",
    value,
    placeholder = "",
    inputType = "text",
    min,
    max,
    step,
    onChange,
    className = "",
  }: Props = $props();

  let host = $state<HTMLElement | null>(null);
  let textApi: {
    setValue: (next: string) => unknown;
    inputEl: HTMLInputElement;
  } | null = null;
  let mountedKey = "";
  let onChangeRef = untrack(() => onChange);

  $effect.pre(() => {
    onChangeRef = onChange;
  });

  $effect(() => {
    const el = host;
    if (!el) {
      textApi = null;
      mountedKey = "";
      return;
    }

    const key = `${name}\0${desc}\0${placeholder}\0${inputType}\0${min ?? ""}\0${max ?? ""}\0${step ?? ""}`;
    if (key !== mountedKey || !textApi) {
      mountedKey = key;
      el.replaceChildren();
      const setting = new Setting(el).setName(name);
      if (desc) {
        setting.setDesc(desc);
      }
      setting.addText((text) => {
        textApi = text;
        text.setPlaceholder(placeholder).setValue(value).onChange((next) => {
          onChangeRef(next);
        });
        if (inputType === "number") {
          text.inputEl.type = "number";
          if (min !== undefined) {
            text.inputEl.min = String(min);
          }
          if (max !== undefined) {
            text.inputEl.max = String(max);
          }
          if (step !== undefined) {
            text.inputEl.step = String(step);
          }
        }
      });
      return;
    }

    if (textApi.inputEl.value !== value) {
      textApi.setValue(value);
    }
  });
</script>

<div
  class={`ir-obsidian-setting-text-host${className ? ` ${className}` : ""}`}
  bind:this={host}
></div>

<style>
  .ir-obsidian-setting-text-host {
    width: 100%;
  }

  .ir-obsidian-setting-text-host :global(.setting-item) {
    border: none;
    padding: 0;
  }

  .ir-obsidian-setting-text-host :global(input) {
    max-width: 100%;
  }
</style>
