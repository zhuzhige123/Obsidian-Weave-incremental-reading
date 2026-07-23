<!--
  增量阅读标签组管理器
  职责：管理增量阅读的材料类型标签组（IRTagGroup）
  
  功能：
  - 显示默认组 + 自定义标签组列表
  - 创建/编辑/删除自定义标签组；编辑默认组参数
  - 显示标签组统计信息（文档数、样本量等）
  
  @version 3.0.0
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Notice, Menu } from 'obsidian';
  import { tr as trStore } from '../../../utils/i18n';
  import type { IRTagGroup, IRTagGroupProfile } from '../../../types/ir-types';
  import type { IncrementalReadingSettingsHost } from '../types/incremental-reading-settings-host';
  import { DEFAULT_TAG_GROUP, DEFAULT_TAG_GROUP_PROFILE } from '../../../types/ir-types';
  import EnhancedIcon from '../../ui/EnhancedIcon.svelte';
  import IRTagGroupEditor, {
    type TagGroupMatchedTopic,
  } from './IRTagGroupEditor.svelte';
  import IRTagGroupStatsModal from './IRTagGroupStatsModal.svelte';
  import { showObsidianConfirm } from '../../../utils/obsidian-confirm';
  import { IRTagGroupService } from '../../../services/incremental-reading/IRTagGroupService';
  import { IRStorageService } from '../../../services/incremental-reading/IRStorageService';

  let t = $derived($trStore);

  interface Props {
    plugin: IncrementalReadingSettingsHost;
  }

  let { plugin }: Props = $props();

  // 状态管理
  let tagGroups = $state<IRTagGroup[]>([]);
  let profiles = $state<Record<string, IRTagGroupProfile>>({});
  let documentCounts = $state<Record<string, number>>({});
  let isLoading = $state(true);
  let showEditor = $state(false);
  let editingGroup = $state<IRTagGroup | null>(null);
  let editingProfile = $state<IRTagGroupProfile | null>(null);
  let editingMatchedTopics = $state<TagGroupMatchedTopic[]>([]);
  let loadError = $state<string | null>(null);
  let hasInitialized = $state(false);
  let showStatsModal = $state(false);
  let statsGroup = $state<IRTagGroup | null>(null);
  let statsProfile = $state<IRTagGroupProfile | null>(null);

  type EditorSavePayload = {
    group: IRTagGroup;
    profile: IRTagGroupProfile;
  };

  const displayGroups = $derived.by(() => {
    const defaults = tagGroups.filter((group) => group.id === DEFAULT_TAG_GROUP.id);
    const customs = tagGroups
      .filter((group) => group.id !== DEFAULT_TAG_GROUP.id)
      .sort((a, b) => (a.matchPriority ?? 0) - (b.matchPriority ?? 0));
    if (defaults.length > 0) {
      return [...defaults, ...customs];
    }
    return [
      {
        ...DEFAULT_TAG_GROUP,
        name: t('irTagGroup.defaultGroupName'),
      },
      ...customs,
    ];
  });

  // 获取或创建服务
  async function getOrCreateService(): Promise<IRTagGroupService> {
    if (plugin.irTagGroupService) {
      return plugin.irTagGroupService;
    }
    
    const service = new IRTagGroupService(plugin.app);
    await service.initialize();
    plugin.irTagGroupService = service;
    return service;
  }

  // 加载数据
  async function loadData() {
    if (hasInitialized) {
      return;
    }
    hasInitialized = true;
    
    isLoading = true;
    loadError = null;
    
    try {
      const service = await getOrCreateService();
      
      const allGroups = await service.getAllGroups();
      tagGroups = allGroups;
      
      const stats = await service.getGroupStats();
      
      const newProfiles: Record<string, IRTagGroupProfile> = {};
      const newCounts: Record<string, number> = {};
      
      for (const stat of stats) {
        newProfiles[stat.group.id] = stat.profile;
        newCounts[stat.group.id] = stat.documentCount;
      }
      
      profiles = newProfiles;
      documentCounts = newCounts;
    } catch (error) {
      loadError = (error as Error).message;
    } finally {
      isLoading = false;
    }
  }

  onMount(async () => {
    await loadData();
  });

  async function handleCreate() {
    editingGroup = null;
    editingProfile = null;
    await loadMatchedTopicsForEditor(null);
    showEditor = true;
  }

  async function loadMatchedTopicsForEditor(group: IRTagGroup | null) {
    try {
      const service = await getOrCreateService();
      const groupId = group?.id || '';
      if (!groupId) {
        // New group: show all topics with zero matches (will sync globally).
        const scopes = await service.getDeckScopes();
        editingMatchedTopics = scopes.map((scope) => ({
          topicId: scope.topicId,
          topicName: scope.topicName,
          matchedPointCount: 0,
        }));
        return;
      }
      editingMatchedTopics = await service.getAutoMatchedTopicResults(groupId);
    } catch {
      editingMatchedTopics = [];
    }
  }

  async function handleEdit(group: IRTagGroup) {
    editingGroup = { ...group };
    editingProfile = profiles[group.id]
      ? { ...profiles[group.id] }
      : { ...DEFAULT_TAG_GROUP_PROFILE, groupId: group.id };
    await loadMatchedTopicsForEditor(group);
    showEditor = true;
  }

  function handleCreateClick() {
    void handleCreate();
  }

  function handleShowStats(group: IRTagGroup) {
    statsGroup = group;
    statsProfile = profiles[group.id] || DEFAULT_TAG_GROUP_PROFILE;
    showStatsModal = true;
  }

  function handleCloseStats() {
    showStatsModal = false;
    statsGroup = null;
    statsProfile = null;
  }

  async function handleDelete(group: IRTagGroup) {
    if (group.id === DEFAULT_TAG_GROUP.id) {
      new Notice(t('irTagGroup.cannotDeleteDefault'));
      return;
    }

    const confirmed = await showObsidianConfirm(
      plugin.app,
      t('irTagGroup.deleteConfirm', { name: group.name }),
      { title: t('common.confirmDelete') }
    );
    
    if (!confirmed) return;

    try {
      const service = await getOrCreateService();
      
      const storage = new IRStorageService(plugin.app);
      await storage.initialize();
      await service.deleteGroup(group.id, {
        getAllChunkData: () => storage.getAllChunkData() as Promise<any>,
        saveChunkData: (d: any) => storage.saveChunkData(d),
        getAllSources: () => storage.getAllSources() as Promise<any>,
        saveSource: (d: any) => storage.saveSource(d)
      });
      hasInitialized = false;
      await loadData();
      new Notice(t('irTagGroup.deleted', { name: group.name }));
    } catch (error) {
      new Notice(t('irTagGroup.deleteFailed'));
    }
  }

  async function handleSave(payload: EditorSavePayload) {
    try {
      const service = await getOrCreateService();

      const groupResult = await service.saveGroup(payload.group, {
        profile: payload.profile,
      });
      const affectedTopicIds = groupResult.affectedTopicIds;
      const actionNotice = editingGroup
        ? t('irTagGroup.updated', { name: payload.group.name })
        : t('irTagGroup.created', { name: payload.group.name });
      const syncSuffix = t('irTagGroup.syncedTopicsSuffix', { count: String(affectedTopicIds.length) });
      new Notice(`${actionNotice}${syncSuffix}`);

      showEditor = false;
      editingGroup = null;
      editingProfile = null;
      editingMatchedTopics = [];
      
      hasInitialized = false;
      await loadData();
    } catch (error) {
      new Notice(t('irTagGroup.saveFailed') + (error as Error).message);
    }
  }

  function handleCloseEditor() {
    showEditor = false;
    editingGroup = null;
    editingProfile = null;
    editingMatchedTopics = [];
  }

  function formatFactor(value: number): string {
    return value.toFixed(2) + 'x';
  }

  function displayGroupName(group: IRTagGroup): string {
    if (group.id === DEFAULT_TAG_GROUP.id) {
      return group.name?.trim() || t('irTagGroup.defaultGroupName');
    }
    return group.name;
  }

  function showActionsMenu(group: IRTagGroup, event: MouseEvent) {
    const menu = new Menu();
    
    menu.addItem((item) => {
      item.setTitle(t('irTagGroup.menuStats'))
        .setIcon('bar-chart-2')
        .onClick(() => handleShowStats(group));
    });
    
    menu.addItem((item) => {
      item.setTitle(t('irTagGroup.menuEdit'))
        .setIcon('edit-2')
        .onClick(() => {
          void handleEdit(group);
        });
    });

    if (group.id !== DEFAULT_TAG_GROUP.id) {
      menu.addSeparator();
      menu.addItem((item) => {
        item.setTitle(t('irTagGroup.menuDelete'))
          .setIcon('trash-2')
          .onClick(() => handleDelete(group));
      });
    }
    
    menu.showAtMouseEvent(event);
  }
</script>

<div class="ir-tag-group-manager">
  <!-- 头部 -->
  <div class="manager-header">
    <div class="header-info">
      <div class="header-title">{t('irTagGroup.managerTitle')}</div>
      <p class="header-desc">
        {t('irTagGroup.managerDesc')}
      </p>
    </div>
    <button class="create-btn" onclick={handleCreateClick}>
      <EnhancedIcon name="plus" size={16} />
      <span>{t('irTagGroup.createBtn')}</span>
    </button>
  </div>

  <!-- 内容区 -->
  {#if isLoading}
    <div class="loading-state">
      <EnhancedIcon name="loader" size={24} />
      <span>{t('irTagGroup.loading')}</span>
    </div>
  {:else if loadError}
    <div class="error-state">
      <EnhancedIcon name="alert-circle" size={24} />
      <span>{t('irTagGroup.loadFailed')}{loadError}</span>
      <button class="retry-btn" onclick={() => { hasInitialized = false; loadData(); }}>
        {t('irTagGroup.retryBtn')}
      </button>
    </div>
  {:else}
    <div class="tag-group-table-container">
      <table class="tag-group-table">
        <thead>
          <tr>
            <th class="col-name">{t('irTagGroup.colName')}</th>
            <th class="col-tags">{t('irTagGroup.colTags')}</th>
            <th class="col-docs">{t('irTagGroup.colDocs')}</th>
            <th class="col-factor">{t('irTagGroup.colFactor')}</th>
            <th class="col-samples">{t('irTagGroup.colSamples')}</th>
            <th class="col-priority">{t('irTagGroup.colPriority')}</th>
            <th class="col-actions">{t('irTagGroup.colActions')}</th>
          </tr>
        </thead>
        <tbody>
          {#each displayGroups as group (group.id)}
            {@const profile = profiles[group.id] || DEFAULT_TAG_GROUP_PROFILE}
            {@const docCount = documentCounts[group.id] || 0}
            {@const isDefault = group.id === DEFAULT_TAG_GROUP.id}
            <tr class:is-default={isDefault}>
              <td class="col-name">
                <span class="group-name">{displayGroupName(group)}</span>
                {#if isDefault}
                  <span class="default-badge">{t('irTagGroup.defaultBadge')}</span>
                {/if}
              </td>
              <td class="col-tags">
                <div class="tags-cell">
                  {#if isDefault}
                    <span class="tag-badge is-muted">{t('irTagGroup.defaultTagsLabel')}</span>
                  {:else}
                    {#each group.matchAnyTags.slice(0, 3) as tag}
                      <span class="tag-badge">{tag}</span>
                    {/each}
                    {#if group.matchAnyTags.length > 3}
                      <span class="tag-more">+{group.matchAnyTags.length - 3}</span>
                    {/if}
                  {/if}
                </div>
              </td>
              <td class="col-docs">{docCount}</td>
              <td class="col-factor">{formatFactor(profile.intervalFactorBase)}</td>
              <td class="col-samples">{profile.sampleCount}</td>
              <td class="col-priority">{isDefault ? '—' : group.matchPriority}</td>
              <td class="col-actions">
                <button 
                  class="menu-btn"
                  onclick={(e) => showActionsMenu(group, e)}
                  title={t('irTagGroup.moreActions')}
                >
                  <EnhancedIcon name="more-horizontal" size={18} />
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="default-group-hint">{t('irTagGroup.defaultGroupHint')}</div>
  {/if}
</div>

<!-- 编辑器弹窗 -->
{#if showEditor}
  <IRTagGroupEditor
    {plugin}
    group={editingGroup}
    profile={editingProfile}
    matchedTopics={editingMatchedTopics}
    onSave={handleSave}
    onCancel={handleCloseEditor}
  />
{/if}

<!-- 统计模态窗 -->
{#if showStatsModal && statsGroup && statsProfile}
  <IRTagGroupStatsModal
    group={statsGroup}
    profile={statsProfile}
    onClose={handleCloseStats}
  />
{/if}

<style>
  .ir-tag-group-manager {
    margin: var(--size-4-3) 0;
    padding: var(--size-4-4);
    background: var(--background-secondary);
    border-radius: var(--radius-m);
  }

  .manager-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--size-4-4);
  }

  .header-info {
    flex: 1;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: var(--size-4-2);
    font-size: var(--font-ui-medium);
    font-weight: 600;
    color: var(--text-normal);
    margin-bottom: var(--size-4-1);
  }

  .header-desc {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    margin: 0;
  }

  .create-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: none;
    border-radius: var(--radius-s);
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    cursor: pointer;
    font-size: var(--font-ui-small);
    white-space: nowrap;
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px;
    color: var(--text-muted);
  }

  .retry-btn {
    margin-top: 4px;
    padding: 6px 12px;
    border-radius: var(--radius-s);
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    cursor: pointer;
  }

  .tag-group-table-container {
    overflow-x: auto;
  }

  .tag-group-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-ui-smaller);
  }

  .tag-group-table th,
  .tag-group-table td {
    padding: 10px 8px;
    text-align: left;
    border-bottom: 1px solid var(--background-modifier-border);
    vertical-align: middle;
  }

  .tag-group-table th {
    color: var(--text-muted);
    font-weight: 600;
  }

  .tag-group-table tr.is-default {
    background: color-mix(in srgb, var(--interactive-accent) 6%, transparent);
  }

  .col-name {
    min-width: 120px;
  }

  .group-name {
    font-weight: 600;
    color: var(--text-normal);
  }

  .default-badge {
    display: inline-block;
    margin-left: 6px;
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--background-modifier-border);
    color: var(--text-muted);
    font-size: 10px;
    font-weight: 600;
  }

  .tags-cell {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .tag-badge {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    color: var(--text-normal);
  }

  .tag-badge.is-muted {
    color: var(--text-muted);
  }

  .tag-more {
    color: var(--text-muted);
  }

  .menu-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: var(--radius-s);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
  }

  .menu-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .default-group-hint {
    margin-top: 12px;
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }
</style>
