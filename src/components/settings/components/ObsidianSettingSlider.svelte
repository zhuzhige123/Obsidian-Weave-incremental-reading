<!--
  Mounts an Obsidian native Setting slider inside Svelte settings panels.
-->
<script lang="ts">
  import { Setting } from "obsidian";

  interface Props {
    name: string;
    desc?: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    disabled?: boolean;
    /** Optional value label shown beside the slider (units / formatting). */
    formatValue?: (value: number) => string;
    onChange: (value: number) => void;
    className?: string;
  }

  let {
    name,
    desc = "",
    value,
    min,
    max,
    step = 1,
    disabled = false,
    formatValue,
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
    void name;
    void desc;
    void min;
    void max;
    void step;
    void disabled;
    void formatValue;

    el.replaceChildren();
    const setting = new Setting(el).setName(name);
    if (desc) {
      setting.setDesc(desc);
    }
    setting.addSlider((slider) => {
      slider
        .setLimits(min, max, step)
        .setValue(current)
        .setDynamicTooltip()
        .setDisabled(disabled)
        .onChange(onChange);
    });
    if (formatValue) {
      setting.controlEl.createSpan({
        cls: "ir-obsidian-setting-slider-value",
        text: formatValue(current),
      });
    }
  });
</script>

<div
  class={`ir-obsidian-setting-slider-host${className ? ` ${className}` : ""}`}
  class:is-disabled={disabled}
  bind:this={host}
></div>

<style>
  .ir-obsidian-setting-slider-host {
    width: 100%;
  }

  .ir-obsidian-setting-slider-host :global(.setting-item) {
    border: none;
    padding: 0;
  }

  .ir-obsidian-setting-slider-host :global(.ir-obsidian-setting-slider-value) {
    min-width: 3.25rem;
    text-align: right;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    font-variant-numeric: tabular-nums;
  }

  .ir-obsidian-setting-slider-host.is-disabled {
    opacity: 0.55;
  }
</style>
