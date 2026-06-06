<!--
  Obsidian 原生图标组件
  封装 Obsidian 的图标系统供 Svelte 组件使用
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { setIcon } from 'obsidian';
  import { resolveObsidianIconName } from '../../icons/obsidian-icon-resolver';

  let {
    name,
    size = 16,
    class: className = ''
  }: {
    name: string;
    size?: number | string;
    class?: string;
  } = $props();

  let iconElement: HTMLSpanElement;

  const numericSize = $derived.by(() => {
    if (typeof size === 'number' && Number.isFinite(size)) {
      return size;
    }
    if (typeof size === 'string') {
      const parsed = Number.parseInt(size, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  });

  const resolvedSizeStyle = $derived.by(() => {
    if (typeof size === 'number' && Number.isFinite(size)) {
      return `${size}px`;
    }

    if (typeof size === 'string' && size.trim().length > 0) {
      return size.trim();
    }

    return '16px';
  });

  onMount(() => {
    if (iconElement) {
      setIcon(iconElement, resolveObsidianIconName(name));
      // 确保 SVG 尺寸正确
      const svg = iconElement.querySelector('svg');
      if (svg && numericSize !== null) {
        svg.setAttribute('width', String(numericSize));
        svg.setAttribute('height', String(numericSize));
      }
    }
  });

  // 当图标名称或尺寸变化时更新图标
  $effect(() => {
    if (iconElement && name) {
      setIcon(iconElement, resolveObsidianIconName(name));
      // 确保 SVG 尺寸正确
      const svg = iconElement.querySelector('svg');
      if (svg && numericSize !== null) {
        svg.setAttribute('width', String(numericSize));
        svg.setAttribute('height', String(numericSize));
      }
    }
  });
</script>

<span
  bind:this={iconElement}
  class="obsidian-icon {className}"
  style="width: {resolvedSizeStyle}; height: {resolvedSizeStyle}; min-width: {resolvedSizeStyle}; min-height: {resolvedSizeStyle}; display: inline-flex; align-items: center; justify-content: center;"
  role="img"
  aria-label={name}
></span>

<style>
  .obsidian-icon {
    vertical-align: middle;
    line-height: 1;
    flex-shrink: 0;
  }

  .obsidian-icon :global(svg) {
    width: 100% !important;
    height: 100% !important;
    vertical-align: top;
    flex-shrink: 0;
  }
</style>


