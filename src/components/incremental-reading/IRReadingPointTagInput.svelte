<!--
  IRReadingPointTagInput - Obsidian 风格阅读点标签输入（芯片 + 建议 + 回车添加）
-->
<script lang="ts">
  import type { App } from 'obsidian';
  import { Notice } from 'obsidian';
  import {
    buildTagSuggestionOptions,
    formatTagSuggestionLabel,
    normalizeTagSuggestionOptions,
    normalizeTagSuggestionValue,
    TagInputSuggest,
    type TagSuggestionItem
  } from '../../utils/tag-suggest';
  import { IRPointTagService, normalizeReadingPointTags } from '../../services/incremental-reading/IRPointTagService';
  import { tr } from '../../utils/i18n';

  interface Props {
    app: App;
    tags?: string[];
    disabled?: boolean;
  }

  let { app, tags = $bindable([]), disabled = false }: Props = $props();

  let t = $derived($tr);

  let tagDraft = $state('');
  let tagInputEl = $state<HTMLInputElement | null>(null);
  let tagSuggest: TagInputSuggest | null = null;
  let suggestionItems = $state<TagSuggestionItem[]>([]);

  function getTagDraftQuery(): string {
    return normalizeTagSuggestionValue(tagDraft);
  }

  function isTagDraftActive(): boolean {
    if (disabled || !tagInputEl) {
      return false;
    }
    return tagDraft.length > 0 || document.activeElement === tagInputEl;
  }

  function addTag(raw: string): void {
    const [normalized] = normalizeReadingPointTags([raw]);
    if (!normalized) {
      return;
    }
    if (tags.some((tag) => tag.toLowerCase() === normalized.toLowerCase())) {
      new Notice(t('irReadingPointEdit.tags.tagExists', { tag: formatTagSuggestionLabel(normalized) }), 2200);
      tagDraft = '';
      tagInputEl?.focus();
      return;
    }
    tags = [...tags, normalized];
    tagDraft = '';
    tagInputEl?.focus();
  }

  function removeTagAt(index: number): void {
    tags = tags.filter((_, itemIndex) => itemIndex !== index);
  }

  function buildCreateSuggestion(query: string): TagSuggestionItem | null {
    const normalized = normalizeTagSuggestionValue(query);
    if (!normalized) {
      return null;
    }
    const key = normalized.toLowerCase();
    if (tags.some((tag) => tag.toLowerCase() === key)) {
      return null;
    }
    if (suggestionItems.some((item) => item.key === key)) {
      return null;
    }
    const label = formatTagSuggestionLabel(normalized);
    const createKeyword = t('irReadingPointEdit.tags.createKeyword');
    return {
      key: `create:${key}`,
      tag: normalized,
      label: t('irReadingPointEdit.tags.createPrefix', { label }),
      count: 0,
      keywords: [normalized, label, createKeyword],
      searchText: `${normalized} ${label} ${createKeyword}`.toLowerCase(),
      isCreateSuggestion: true
    };
  }

  function handleTagKeydown(event: KeyboardEvent): void {
    if (disabled) {
      return;
    }
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const query = getTagDraftQuery();
      if (query) {
        addTag(query);
      }
      return;
    }
    if (event.key === 'Backspace' && !tagDraft && tags.length > 0) {
      removeTagAt(tags.length - 1);
    }
  }

  async function loadSuggestionItems(): Promise<void> {
    const tagService = new IRPointTagService(app);
    const [knownTags, vaultOptions] = await Promise.all([
      tagService.getAllKnownTags(),
      Promise.resolve(buildTagSuggestionOptions(app, [], 'incremental-reading'))
    ]);
    const merged = new Map<string, { name: string; count: number }>();
    for (const name of knownTags) {
      const normalized = normalizeTagSuggestionValue(name);
      if (normalized) {
        merged.set(normalized.toLowerCase(), { name: normalized, count: 0 });
      }
    }
    for (const option of vaultOptions) {
      const key = option.name.toLowerCase();
      const existing = merged.get(key);
      if (existing) {
        existing.count = Math.max(existing.count, option.count);
      } else {
        merged.set(key, option);
      }
    }
    suggestionItems = normalizeTagSuggestionOptions(Array.from(merged.values()));
  }

  $effect(() => {
    void loadSuggestionItems();
  });

  $effect(() => {
    if (!tagInputEl) {
      tagSuggest?.destroy();
      tagSuggest = null;
      return;
    }

    const suggest = new TagInputSuggest(app, tagInputEl, {
      getItems: () => suggestionItems,
      getQuery: () => getTagDraftQuery(),
      isActive: () => isTagDraftActive(),
      onSelectTag: (tag) => addTag(tag),
      createSuggestion: (query) => buildCreateSuggestion(query),
      limit: 40
    });

    tagSuggest = suggest;

    return () => {
      suggest.destroy();
      if (tagSuggest === suggest) {
        tagSuggest = null;
      }
    };
  });
</script>

<div class="ir-tag-input-wrapper reading-point-tag-input" class:is-disabled={disabled}>
  {#each tags as tag, index (tag.toLowerCase())}
    <span class="ir-tag-chip">
      {formatTagSuggestionLabel(tag)}
      {#if !disabled}
        <button
          type="button"
          class="ir-tag-chip-remove"
          aria-label={t('irReadingPointEdit.tags.removeAriaLabel', { tag })}
          onclick={() => removeTagAt(index)}
        >
          ×
        </button>
      {/if}
    </span>
  {/each}
  <input
    bind:this={tagInputEl}
    class="ir-tag-input"
    type="text"
    bind:value={tagDraft}
    {disabled}
    placeholder={tags.length === 0 ? t('irReadingPointEdit.tags.placeholder') : ''}
    onkeydown={handleTagKeydown}
  />
</div>

<style>
  .reading-point-tag-input.is-disabled {
    opacity: 0.65;
  }
</style>
