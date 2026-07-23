<!--
  增量阅读标签组编辑器
  职责：创建/编辑 IRTagGroup 的弹窗表单
  
  @version 3.0.0
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { Notice } from 'obsidian';
  import { tr } from '../../../utils/i18n';
  import { logger } from '../../../utils/logger';
  import type { IncrementalReadingSettingsHost } from '../types/incremental-reading-settings-host';
  import type { IRTagGroup, IRTagGroupProfile } from '../../../types/ir-types';
  import { DEFAULT_TAG_GROUP, DEFAULT_TAG_GROUP_PROFILE } from '../../../types/ir-types';
  import EnhancedIcon from '../../ui/EnhancedIcon.svelte';
  import ObsidianSettingSlider from '../components/ObsidianSettingSlider.svelte';
  import ObsidianSettingText from '../components/ObsidianSettingText.svelte';

  let t = $derived($tr);

  export type TagGroupMatchedTopic = {
    topicId: string;
    topicName: string;
    matchedPointCount: number;
  };

  interface Props {
    plugin: IncrementalReadingSettingsHost;
    group: IRTagGroup | null;
    profile: IRTagGroupProfile | null;
    matchedTopics?: TagGroupMatchedTopic[];
    onSave: (payload: {
      group: IRTagGroup;
      profile: IRTagGroupProfile;
    }) => void | Promise<void>;
    onCancel: () => void;
  }

  let {
    plugin,
    group,
    profile,
    matchedTopics = [],
    onSave,
    onCancel
  }: Props = $props();

  const isDefaultGroup = $derived(group?.id === DEFAULT_TAG_GROUP.id);

  // 表单状态
  let name = $state(
    untrack(() =>
      group?.id === DEFAULT_TAG_GROUP.id
        ? group?.name || DEFAULT_TAG_GROUP.name
        : group?.name || ''
    )
  );
  let matchPriority = $state(
    untrack(() =>
      group?.id === DEFAULT_TAG_GROUP.id
        ? DEFAULT_TAG_GROUP.matchPriority
        : group?.matchPriority || 100
    )
  );
  let tags = $state<string[]>(
    untrack(() =>
      group?.id === DEFAULT_TAG_GROUP.id
        ? []
        : group?.matchAnyTags
          ? [...group.matchAnyTags]
          : []
    )
  );
  let tagInput = $state('');
  let showTagSuggestions = $state(false);
  let intervalFactorBase = $state(
    untrack(() => String(profile?.intervalFactorBase ?? DEFAULT_TAG_GROUP_PROFILE.intervalFactorBase))
  );
  let initialIntervalMultiplier = $state(
    untrack(() =>
      String(profile?.initialIntervalMultiplier ?? DEFAULT_TAG_GROUP_PROFILE.initialIntervalMultiplier)
    )
  );
  let loadHalfLifeDays = $state<string>(
    untrack(() => Number.isFinite(profile?.loadHalfLifeDays) ? String(profile?.loadHalfLifeDays) : '')
  );

  // 从库中收集已有标签
  let existingTags = $state<string[]>([]);

  $effect(() => {
    if (!isDefaultGroup) {
      loadExistingTags();
    }
  });

  async function loadExistingTags() {
    try {
      const { IRPointTagService } = await import(
        '../../../services/incremental-reading/IRPointTagService'
      );
      const tagService = new IRPointTagService(plugin.app);
      existingTags = await tagService.getAllKnownTags();
    } catch (error) {
      logger.warn('[IRTagGroupEditor] 加载标签失败:', error);
    }
  }

  // 过滤标签建议
  const filteredSuggestions = $derived.by(() => {
    if (!tagInput.trim()) return [];
    const lower = tagInput.toLowerCase();
    return existingTags
      .filter(tag => tag.includes(lower) && !tags.includes(tag))
      .slice(0, 8);
  });

  const matchedTopicTotal = $derived(
    matchedTopics.reduce((sum, topic) => sum + (topic.matchedPointCount || 0), 0)
  );

  // 添加标签
  function addTag(tag: string) {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      new Notice(t('irTagGroup.tagExists'));
      return;
    }
    tags = [...tags, trimmed];
    tagInput = '';
    showTagSuggestions = false;
  }

  // 移除标签
  function removeTag(index: number) {
    tags = tags.filter((_, i) => i !== index);
  }

  // 处理标签输入
  function handleTagKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredSuggestions.length > 0) {
        addTag(filteredSuggestions[0]);
      } else if (tagInput.trim()) {
        addTag(tagInput);
      }
    } else if (e.key === 'Escape') {
      showTagSuggestions = false;
    }
  }

  // 验证并保存
  async function handleSave() {
    if (!name.trim()) {
      new Notice(t('irTagGroup.nameRequired'));
      return;
    }
    if (!isDefaultGroup && tags.length === 0) {
      new Notice(t('irTagGroup.tagRequired'));
      return;
    }

    const now = new Date().toISOString();
    const savedGroup: IRTagGroup = isDefaultGroup
      ? {
          id: DEFAULT_TAG_GROUP.id,
          name: name.trim() || DEFAULT_TAG_GROUP.name,
          description: group?.description || DEFAULT_TAG_GROUP.description,
          matchAnyTags: [],
          matchPriority: DEFAULT_TAG_GROUP.matchPriority,
          createdAt: group?.createdAt || DEFAULT_TAG_GROUP.createdAt,
          updatedAt: now
        }
      : {
          id: group?.id || `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: name.trim(),
          description: '',
          matchAnyTags: tags,
          matchPriority,
          createdAt: group?.createdAt || now,
          updatedAt: now
        };

    const savedProfile: IRTagGroupProfile = {
      ...(profile || DEFAULT_TAG_GROUP_PROFILE),
      groupId: savedGroup.id,
      intervalFactorBase: Math.max(
        1.1,
        Math.min(3, Number(intervalFactorBase) || DEFAULT_TAG_GROUP_PROFILE.intervalFactorBase)
      ),
      initialIntervalMultiplier: Math.max(
        0.7,
        Math.min(
          1.5,
          Number(initialIntervalMultiplier) || DEFAULT_TAG_GROUP_PROFILE.initialIntervalMultiplier
        )
      ),
      loadHalfLifeDays: loadHalfLifeDays.trim()
        ? Math.max(1, Number(loadHalfLifeDays) || 0)
        : undefined,
      sampleCount: Number(profile?.sampleCount || DEFAULT_TAG_GROUP_PROFILE.sampleCount),
      updatedAt: now,
      history: profile?.history ? [...profile.history] : undefined
    };

    await onSave({
      group: savedGroup,
      profile: savedProfile
    });
  }

  // 点击背景关闭
  function handleOverlayClick() {
    onCancel();
  }
</script>

<div class="editor-overlay">
  <button
    type="button"
    class="editor-backdrop"
    aria-label={t('common.close')}
    onclick={handleOverlayClick}
  ></button>
  <div class="editor-dialog" role="dialog" aria-modal="true" tabindex="-1">
    <!-- 头部 -->
    <div class="dialog-header">
      <h3>
        {#if isDefaultGroup}
          {t('irTagGroup.editor.editDefaultTitle')}
        {:else if group}
          {t('irTagGroup.editor.editTitle')}
        {:else}
          {t('irTagGroup.editor.createTitle')}
        {/if}
      </h3>
      <button class="close-btn" onclick={onCancel}>
        <EnhancedIcon name="x" size={20} />
      </button>
    </div>

    <!-- 表单内容 -->
    <div class="dialog-body">
      <!-- 名称 -->
      <div class="form-group">
        <div class="form-label">
          {t('irTagGroup.editor.nameLabel')} <span class="required">*</span>
        </div>
        <input
          type="text"
          class="form-input"
          placeholder={t('irTagGroup.editor.namePlaceholder')}
          bind:value={name}
        />
        <p class="form-hint">
          {isDefaultGroup
            ? t('irTagGroup.editor.defaultNameHint')
            : t('irTagGroup.editor.nameHint')}
        </p>
      </div>

      {#if isDefaultGroup}
        <div class="form-group">
          <div class="form-label">{t('irTagGroup.editor.defaultRoleLabel')}</div>
          <p class="form-hint">{t('irTagGroup.editor.defaultRoleHint')}</p>
        </div>
      {:else}
        <!-- 匹配标签 -->
        <div class="form-group">
          <div class="form-label">
            {t('irTagGroup.editor.tagsLabel')} <span class="required">*</span>
          </div>
          <p class="form-hint">{t('irTagGroup.editor.tagsHint')}</p>
          
          <div class="tags-container">
            {#if tags.length > 0}
              <div class="tags-list">
                {#each tags as tag, i}
                  <div class="tag-chip">
                    <span>{tag}</span>
                    <button class="tag-remove" onclick={() => removeTag(i)}>
                      <EnhancedIcon name="x" size={12} />
                    </button>
                  </div>
                {/each}
              </div>
            {/if}

            <div class="tag-input-wrapper">
              <input
                type="text"
                class="tag-input"
                placeholder={t('irTagGroup.editor.tagsPlaceholder')}
                bind:value={tagInput}
                onkeydown={handleTagKeydown}
                onfocus={() => showTagSuggestions = true}
                onblur={() => window.setTimeout(() => showTagSuggestions = false, 200)}
              />

              {#if showTagSuggestions && filteredSuggestions.length > 0}
                <div class="tag-suggestions">
                  {#each filteredSuggestions as suggestion}
                    <button
                      type="button"
                      class="suggestion-item"
                      onclick={() => addTag(suggestion)}
                    >
                      {suggestion}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </div>

        <!-- 匹配优先级 -->
        <ObsidianSettingSlider
          name={t('irTagGroup.editor.priorityLabel')}
          desc={t('irTagGroup.editor.priorityHint')}
          min={1}
          max={200}
          step={1}
          value={matchPriority}
          onChange={(value) => {
            matchPriority = value;
          }}
          formatValue={(value) => String(value)}
        />
      {/if}

      <div class="form-group">
        <div class="form-label">{t('irTagGroup.editor.schedulingTitle')}</div>
        <p class="form-hint">{t('irTagGroup.editor.schedulingHint')}</p>
        <div class="profile-settings">
          <ObsidianSettingText
            name={t('irTagGroup.editor.intervalFactorBase')}
            value={intervalFactorBase}
            inputType="number"
            min={1.1}
            max={3}
            step={0.05}
            onChange={(value) => {
              intervalFactorBase = value;
            }}
          />
          <ObsidianSettingText
            name={t('irTagGroup.editor.coldStartMultiplier')}
            value={initialIntervalMultiplier}
            inputType="number"
            min={0.7}
            max={1.5}
            step={0.05}
            onChange={(value) => {
              initialIntervalMultiplier = value;
            }}
          />
          <ObsidianSettingText
            name={t('irTagGroup.editor.loadHalfLifeDays')}
            value={loadHalfLifeDays}
            inputType="number"
            min={1}
            step={1}
            placeholder={t('irTagGroup.editor.optionalPlaceholder')}
            onChange={(value) => {
              loadHalfLifeDays = value;
            }}
          />
        </div>
      </div>

      <div class="form-group">
        <div class="form-label">{t('irTagGroup.editor.matchedTopicsTitle')}</div>
        <p class="form-hint">{t('irTagGroup.editor.matchedTopicsHint')}</p>
        {#if matchedTopics.length === 0}
          <div class="matched-empty">{t('irTagGroup.editor.matchedTopicsEmpty')}</div>
        {:else}
          <div class="matched-summary">
            {t('irTagGroup.editor.matchedTopicsSummary', {
              topics: String(matchedTopics.length),
              points: String(matchedTopicTotal)
            })}
          </div>
          <div class="matched-list">
            {#each matchedTopics as topic (topic.topicId)}
              <div class="matched-item">
                <span class="matched-name">{topic.topicName}</span>
                <span class="matched-count">
                  {t('irTagGroup.editor.matchedTopicCount', {
                    count: String(topic.matchedPointCount)
                  })}
                </span>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- 算法说明 -->
      <div class="algorithm-note">
        <div class="note-title">
          <EnhancedIcon name="info" size={14} />
          <span>{t('irTagGroup.editor.algorithmNoteTitle')}</span>
        </div>
        <div class="note-content">
          {t('irTagGroup.editor.algorithmNoteContent')}
        </div>
      </div>
    </div>

    <!-- 底部按钮 -->
    <div class="dialog-footer">
      <button class="btn secondary" onclick={onCancel}>{t('irTagGroup.editor.cancelBtn')}</button>
      <button class="btn primary" onclick={handleSave}>
        {group ? t('irTagGroup.editor.saveBtn') : t('irTagGroup.editor.createBtn')}
      </button>
    </div>
  </div>
</div>

<style>
  .editor-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--weave-z-overlay);
    padding: var(--size-4-5);
  }

  .editor-backdrop {
    position: absolute;
    inset: 0;
    border: none;
    background: transparent;
    padding: 0;
    cursor: default;
  }

  .editor-dialog {
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    background: var(--background-primary);
    border-radius: var(--radius-l);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--size-4-4) var(--size-4-5);
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .dialog-header h3 {
    margin: 0;
    font-size: var(--font-ui-medium);
    font-weight: 600;
    color: var(--text-normal);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: var(--radius-s);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
  }

  .close-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .dialog-body {
    padding: var(--size-4-5);
    overflow-y: auto;
    flex: 1;
  }

  .form-group {
    margin-bottom: var(--size-4-4);
  }

  .form-label {
    font-size: var(--font-ui-small);
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: var(--size-4-1);
  }

  .required {
    color: var(--text-error);
  }

  .form-hint {
    margin: var(--size-4-1) 0 0;
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    line-height: 1.4;
  }

  .form-input,
  .tag-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--background-primary);
    color: var(--text-normal);
  }

  .tags-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    background: var(--background-secondary);
    border-radius: 999px;
    font-size: var(--font-ui-smaller);
  }

  .tag-remove {
    display: inline-flex;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0;
  }

  .tag-input-wrapper {
    position: relative;
  }

  .tag-suggestions {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(100% + 4px);
    z-index: 5;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    max-height: 180px;
    overflow-y: auto;
  }

  .suggestion-item {
    display: block;
    width: 100%;
    text-align: left;
    border: none;
    background: transparent;
    padding: 8px 12px;
    color: var(--text-normal);
    cursor: pointer;
  }

  .suggestion-item:hover {
    background: var(--background-modifier-hover);
  }

  .profile-settings {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }

  .matched-empty {
    padding: 12px;
    background: var(--background-secondary);
    border: 1px dashed var(--background-modifier-border);
    border-radius: var(--radius-m);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
  }

  .matched-summary {
    margin-bottom: 8px;
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }

  .matched-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 180px;
    overflow-y: auto;
  }

  .matched-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    font-size: var(--font-ui-smaller);
  }

  .matched-name {
    color: var(--text-normal);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .matched-count {
    flex-shrink: 0;
    color: var(--text-muted);
  }

  .algorithm-note {
    margin-top: 16px;
    padding: 12px;
    background: var(--background-secondary);
    border-radius: var(--radius-m);
  }

  .note-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-ui-smaller);
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: 6px;
  }

  .note-content {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    line-height: 1.45;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: var(--size-4-4) var(--size-4-5);
    border-top: 1px solid var(--background-modifier-border);
  }

  .btn {
    padding: 8px 14px;
    border-radius: var(--radius-s);
    border: 1px solid transparent;
    cursor: pointer;
    font-size: var(--font-ui-small);
  }

  .btn.secondary {
    background: var(--background-secondary);
    border-color: var(--background-modifier-border);
    color: var(--text-normal);
  }

  .btn.primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
</style>
