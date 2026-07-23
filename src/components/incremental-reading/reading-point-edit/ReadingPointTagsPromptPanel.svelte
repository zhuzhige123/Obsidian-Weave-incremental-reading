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
    onDraftChange?: (draft: string) => void;
  }

  let {
    app,
    tags = $bindable([]),
    disabled = false,
    onTagsChange,
    onDraftChange
  }: Props = $props();

  let tagInput = $state<{ commitPendingDraft?: () => void } | null>(null);

  $effect(() => {
    onTagsChange?.(tags);
  });

  export function commitPendingDraft(): void {
    tagInput?.commitPendingDraft?.();
  }
</script>

<div class="reading-point-tags-prompt-panel">
  <IRReadingPointTagInput
    bind:this={tagInput}
    {app}
    bind:tags
    {disabled}
    {onDraftChange}
  />
</div>
