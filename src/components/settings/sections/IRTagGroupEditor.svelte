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
  import type { IRTagGroup, IRTagGroupMatchSource, IRTagGroupProfile } from '../../../types/ir-types';
  import { DEFAULT_TAG_GROUP_PROFILE } from '../../../types/ir-types';
  import EnhancedIcon from '../../ui/EnhancedIcon.svelte';

  let t = $derived($tr);

  interface Props {
    plugin: IncrementalReadingSettingsHost;
    group: IRTagGroup | null;
    profile: IRTagGroupProfile | null;
    availableScopes: Array<{ topicId: string; topicName: string }>;
    selectedScopeTopicIds: string[];
    onSave: (payload: {
      group: IRTagGroup;
      profile: IRTagGroupProfile;
      targetTopicIds: string[];
    }) => void | Promise<void>;
    onCancel: () => void;
  }

  let { plugin, group, profile, availableScopes, selectedScopeTopicIds, onSave, onCancel }: Props = $props();

  // 表单状态
  let name = $state(untrack(() => group?.name || ''));
  let matchPriority = $state(untrack(() => group?.matchPriority || 100));
  let tags = $state<string[]>(untrack(() => group?.matchAnyTags ? [...group.matchAnyTags] : []));
  let tagInput = $state('');
  let showTagSuggestions = $state(false);
  let intervalFactorBase = $state(
    untrack(() => profile?.intervalFactorBase ?? DEFAULT_TAG_GROUP_PROFILE.intervalFactorBase)
  );
  let initialIntervalMultiplier = $state(
    untrack(() => profile?.initialIntervalMultiplier ?? DEFAULT_TAG_GROUP_PROFILE.initialIntervalMultiplier)
  );
  let loadHalfLifeDays = $state<string>(
    untrack(() => Number.isFinite(profile?.loadHalfLifeDays) ? String(profile?.loadHalfLifeDays) : '')
  );
  let targetTopicIds = $state<string[]>(
    untrack(() => {
      const base = selectedScopeTopicIds.length > 0
        ? selectedScopeTopicIds
        : availableScopes.map((scope) => scope.topicId);
      return Array.from(new Set(base.map((value) => String(value || '').trim()).filter(Boolean)));
    })
  );

  // 匹配源配置
  let useYamlTags = $state(untrack(() => group?.matchSource?.yamlTags ?? true));
  let useInlineTags = $state(untrack(() => group?.matchSource?.inlineTags ?? true));
  let customProperties = $state<string[]>(
    untrack(() => group?.matchSource?.customProperties ? [...group.matchSource.customProperties] : [])
  );
  let customPropInput = $state('');
  let showCustomProps = $state(untrack(() => (group?.matchSource?.customProperties?.length ?? 0) > 0));

  // 从库中收集已有标签
  let existingTags = $state<string[]>([]);

  $effect(() => {
    loadExistingTags();
  });

  async function loadExistingTags() {
    try {
      const files = plugin.app.vault.getMarkdownFiles();
      const tagSet = new Set<string>();

      for (const file of files) {
        const cache = plugin.app.metadataCache.getFileCache(file);
        
        // frontmatter tags
        const fmTags = cache?.frontmatter?.tags;
        if (Array.isArray(fmTags)) {
          fmTags.forEach(t => tagSet.add(String(t).toLowerCase()));
        } else if (typeof fmTags === 'string') {
          fmTags.split(',').forEach(t => tagSet.add(t.trim().toLowerCase()));
        }

        // inline #tags
        cache?.tags?.forEach(t => {
          tagSet.add(t.tag.replace(/^#/, '').toLowerCase());
        });
      }

      existingTags = Array.from(tagSet).sort();
    } catch (error) {
      logger.warn('[IRTagGroupEditor] 加载标签失败:', error);
    }
  }

  // 过滤标签建议
  const filteredSuggestions = $derived.by(() => {
    if (!tagInput.trim()) return [];
    const lower = tagInput.toLowerCase();
    return existingTags
      .filter(t => t.includes(lower) && !tags.includes(t))
      .slice(0, 8);
  });

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
    if (tags.length === 0) {
      new Notice(t('irTagGroup.tagRequired'));
      return;
    }
    if (targetTopicIds.length === 0) {
      new Notice(t('irTagGroup.editor.scopeRequired'));
      return;
    }

    const now = new Date().toISOString();
    const matchSource: IRTagGroupMatchSource = {
      yamlTags: useYamlTags,
      inlineTags: useInlineTags,
      customProperties: customProperties.length > 0 ? customProperties : []
    };

    const savedGroup: IRTagGroup = {
      id: group?.id || `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      description: '',
      matchAnyTags: tags,
      matchPriority,
      matchSource,
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
      profile: savedProfile,
      targetTopicIds
    });
  }

  function toggleScope(topicId: string) {
    const normalized = String(topicId || '').trim();
    if (!normalized) return;
    if (targetTopicIds.includes(normalized)) {
      targetTopicIds = targetTopicIds.filter((value) => value !== normalized);
      return;
    }
    targetTopicIds = [...targetTopicIds, normalized];
  }

  function selectAllScopes() {
    targetTopicIds = availableScopes.map((scope) => scope.topicId);
  }

  function clearScopes() {
    targetTopicIds = [];
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
      <h3>{group ? t('irTagGroup.editor.editTitle') : t('irTagGroup.editor.createTitle')}</h3>
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
        <p class="form-hint">{t('irTagGroup.editor.nameHint')}</p>
      </div>

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

      <!-- 匹配源配置 -->
      <div class="form-group">
        <div class="form-label">{t('irTagGroup.editor.matchSourceLabel')}</div>
        <p class="form-hint">{t('irTagGroup.editor.matchSourceHint')}</p>
        <div class="match-source-options">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={useYamlTags} />
            <span>{t('irTagGroup.editor.customYamlTags')}</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={useInlineTags} />
            <span>{t('irTagGroup.editor.inlineTags')}</span>
          </label>
          <label class="checkbox-label">
            <input
              type="checkbox"
              checked={showCustomProps}
              onchange={(e) => {
                showCustomProps = (e.target as HTMLInputElement).checked;
                if (!showCustomProps) customProperties = [];
              }}
            />
            <span>{t('irTagGroup.editor.customYaml')}</span>
          </label>
        </div>

        {#if showCustomProps}
          <div class="custom-props-container">
            {#if customProperties.length > 0}
              <div class="tags-list">
                {#each customProperties as prop, i}
                  <div class="tag-chip prop-chip">
                    <span>{prop}</span>
                    <button class="tag-remove" onclick={() => { customProperties = customProperties.filter((_, idx) => idx !== i); }}>
                      <EnhancedIcon name="x" size={12} />
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
            <input
              type="text"
              class="tag-input"
              placeholder={t('irTagGroup.editor.customPropertyPlaceholder')}
              bind:value={customPropInput}
              onkeydown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const trimmed = customPropInput.trim();
                  if (trimmed && !customProperties.includes(trimmed)) {
                    customProperties = [...customProperties, trimmed];
                  }
                  customPropInput = '';
                }
              }}
            />
          </div>
        {/if}
      </div>

      <!-- 匹配优先级 -->
      <div class="form-group">
        <div class="form-label">{t('irTagGroup.editor.priorityLabel')}</div>
        <div class="priority-input">
          <input
            type="range"
            min="1"
            max="200"
            step="1"
            bind:value={matchPriority}
            class="priority-slider"
          />
          <span class="priority-value">{matchPriority}</span>
        </div>
        <p class="form-hint">
          {t('irTagGroup.editor.priorityHint')}
        </p>
      </div>

      <div class="form-group">
        <div class="form-label">{t('irTagGroup.editor.schedulingTitle')}</div>
        <p class="form-hint">{t('irTagGroup.editor.schedulingHint')}</p>
        <div class="profile-grid">
          <label class="profile-field">
            <span>{t('irTagGroup.editor.intervalFactorBase')}</span>
            <input type="number" min="1.1" max="3" step="0.05" bind:value={intervalFactorBase} />
          </label>
          <label class="profile-field">
            <span>{t('irTagGroup.editor.coldStartMultiplier')}</span>
            <input type="number" min="0.7" max="1.5" step="0.05" bind:value={initialIntervalMultiplier} />
          </label>
          <label class="profile-field">
            <span>{t('irTagGroup.editor.loadHalfLifeDays')}</span>
            <input type="number" min="1" step="1" bind:value={loadHalfLifeDays} placeholder={t('irTagGroup.editor.optionalPlaceholder')} />
          </label>
        </div>
      </div>

      <div class="form-group">
        <div class="form-label">{t('irTagGroup.editor.scopeTitle')}</div>
        <p class="form-hint">{t('irTagGroup.editor.scopeHint')}</p>
        {#if availableScopes.length === 0}
          <div class="scope-empty">{t('irTagGroup.editor.scopeEmpty')}</div>
        {:else}
          <div class="scope-toolbar">
            <button type="button" class="scope-btn" onclick={selectAllScopes}>{t('irTagGroup.editor.scopeSelectAll')}</button>
            <button type="button" class="scope-btn" onclick={clearScopes}>{t('irTagGroup.editor.scopeClear')}</button>
            <span class="scope-count">{t('irTagGroup.editor.scopeCount', { selected: String(targetTopicIds.length), total: String(availableScopes.length) })}</span>
          </div>
          <div class="scope-list">
            {#each availableScopes as scope}
              <label class="scope-item">
                <input
                  type="checkbox"
                  checked={targetTopicIds.includes(scope.topicId)}
                  onchange={() => toggleScope(scope.topicId)}
                />
                <span>{scope.topicName}</span>
              </label>
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

  /* 头部 */
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
    transition: all 0.15s ease;
  }

  .close-btn:hover {
    background: var(--background-secondary);
    color: var(--text-normal);
  }

  /* 表单内容 */
  .dialog-body {
    flex: 1;
    padding: var(--size-4-5);
    overflow-y: auto;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .form-label {
    display: block;
    font-size: var(--font-ui-small);
    font-weight: 500;
    color: var(--text-normal);
    margin-bottom: 6px;
  }

  .required {
    color: #ef4444;
  }

  .form-hint {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    margin: 6px 0 0;
  }

  .form-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: var(--font-ui-small);
    transition: border-color 0.15s ease;
  }

  .form-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .form-input::placeholder {
    color: var(--text-faint);
  }

  /* 标签输入 */
  .tags-container {
    background: var(--background-secondary);
    border-radius: var(--radius-m);
    padding: 10px;
  }

  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }

  .tag-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-radius: var(--radius-s);
    font-size: var(--font-ui-smaller);
  }

  .tag-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: none;
    border-radius: var(--radius-s);
    background: transparent;
    color: var(--text-on-accent);
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.15s ease;
  }

  .tag-remove:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.2);
  }

  .tag-input-wrapper {
    position: relative;
  }

  .tag-input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: var(--font-ui-smaller);
  }

  .tag-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .tag-input::placeholder {
    color: var(--text-faint);
  }

  .tag-suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-height: 200px;
    overflow-y: auto;
    z-index: 10;
  }

  .suggestion-item {
    display: block;
    width: 100%;
    border: none;
    background: transparent;
    text-align: left;
    padding: 8px 12px;
    font-size: var(--font-ui-smaller);
    color: var(--text-normal);
    cursor: pointer;
    transition: background 0.1s ease;
  }

  .suggestion-item:hover {
    background: var(--background-secondary);
  }

  /* 匹配源配置 */
  .match-source-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-ui-smaller);
    color: var(--text-normal);
    cursor: pointer;
  }

  .checkbox-label input[type="checkbox"] {
    margin: 0;
  }

  .custom-props-container {
    margin-top: 8px;
    padding: 10px;
    background: var(--background-secondary);
    border-radius: var(--radius-s);
  }

  .prop-chip {
    background: var(--text-accent) !important;
  }

  /* 优先级输入 */
  .priority-input {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .priority-slider {
    flex: 1;
    height: 6px;
    -webkit-appearance: none;
    appearance: none;
    background: var(--background-modifier-border);
    border-radius: var(--radius-s);
    cursor: pointer;
  }

  .priority-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    background: var(--interactive-accent);
    border-radius: 50%;
    cursor: pointer;
  }

  .priority-value {
    min-width: 40px;
    font-size: var(--font-ui-small);
    font-weight: 600;
    color: var(--text-normal);
    text-align: right;
  }

  .profile-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 10px;
    margin-top: 8px;
  }

  .profile-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }

  .profile-field input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: var(--font-ui-smaller);
  }

  .profile-field input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .scope-empty {
    padding: 12px;
    background: var(--background-secondary);
    border: 1px dashed var(--background-modifier-border);
    border-radius: var(--radius-m);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
  }

  .scope-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 8px;
    margin-bottom: 10px;
  }

  .scope-btn {
    padding: 6px 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 999px;
    background: var(--background-secondary);
    color: var(--text-normal);
    font-size: var(--font-ui-smaller);
    cursor: pointer;
  }

  .scope-btn:hover {
    background: var(--background-secondary-alt);
    border-color: var(--interactive-accent);
  }

  .scope-count {
    margin-left: auto;
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }

  .scope-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 8px;
  }

  .scope-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    font-size: var(--font-ui-smaller);
    color: var(--text-normal);
    cursor: pointer;
  }

  .scope-item:hover {
    border-color: var(--interactive-accent);
    background: var(--background-secondary-alt);
  }

  .scope-item input[type="checkbox"] {
    margin: 0;
  }

  /* 算法说明 */
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
    font-weight: 500;
    color: var(--text-normal);
    margin-bottom: 6px;
  }

  .note-content {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    line-height: 1.5;
  }

  /* 底部按钮 */
  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: var(--size-4-4) var(--size-4-5);
    border-top: 1px solid var(--background-modifier-border);
  }

  .btn {
    padding: 8px 18px;
    border: none;
    border-radius: var(--radius-s);
    font-size: var(--font-ui-small);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn.secondary {
    background: var(--background-secondary);
    color: var(--text-normal);
  }

  .btn.secondary:hover {
    background: var(--background-modifier-hover);
  }

  .btn.primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .btn.primary:hover {
    background: var(--interactive-accent-hover);
  }
</style>
