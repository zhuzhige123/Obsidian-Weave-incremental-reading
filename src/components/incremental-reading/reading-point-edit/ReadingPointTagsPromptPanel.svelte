<!--
  ReadingPointTagsPromptPanel - 编辑标签弹窗内容区（芯片输入 + 建议）
-->
<script lang="ts">
  import type { App } from 'obsidian';
  import IRReadingPointTagInput from '../IRReadingPointTagInput.svelte';

  interface Props {
    app: App;
    tags?: string[];
    disabled?: boolean;
    onTagsChange?: (tags: string[]) => void;
  }

  let { app, tags = $bindable([]), disabled = false, onTagsChange }: Props = $props();

  $effect(() => {
    onTagsChange?.(tags);
  });
</script>

<div class="reading-point-tags-prompt-panel">
  <IRReadingPointTagInput {app} bind:tags {disabled} />
</div>
