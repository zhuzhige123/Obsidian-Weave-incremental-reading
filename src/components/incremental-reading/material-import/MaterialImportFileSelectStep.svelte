<script lang="ts">
  import type { App } from 'obsidian';
  import ObsidianIcon from '../../ui/ObsidianIcon.svelte';
  import { tr } from '../../../utils/i18n';
  import { createMaterialImportFileTreeHelpers } from './material-import-file-tree';
  import type { MaterialImportTreeNode } from './material-import-types';
  import './material-import-modal.css';

  interface Props {
    app: App;
    excludedImportFolderPath: string;
    open: boolean;
    importing: boolean;
    importProgress: { current: number; total: number };
    isPdfImportMode: boolean;
    isEpubImportMode: boolean;
    onNext: (paths: string[]) => void;
  }

  let {
    app,
    excludedImportFolderPath,
    open,
    importing,
    importProgress,
    isPdfImportMode,
    isEpubImportMode,
    onNext
  }: Props = $props();

  let t = $derived($tr);
  const treeHelpers = createMaterialImportFileTreeHelpers(app, excludedImportFolderPath);

  let treeData = $state<MaterialImportTreeNode[]>([]);
  let searchQuery = $state('');
  let searchFullTreeReady = $state(false);

  const selectedCount = $derived.by(() => treeHelpers.countSelectedFiles(treeData));
  const filteredTreeData = $derived.by(() => {
    if (!searchQuery.trim()) return treeData;
    return treeHelpers.filterTree(treeData, searchQuery.toLowerCase());
  });

  function initializeTree(): void {
    treeHelpers.clearCache();
    treeData = treeHelpers.buildTreeChildren(app.vault.getRoot(), false, false);
    searchQuery = '';
    searchFullTreeReady = false;
  }

  function handleToggleSelect(node: MaterialImportTreeNode): void {
    const realNode = treeHelpers.findNodeByPath(treeData, node.path) ?? node;
    treeData = treeHelpers.toggleSelect(treeData, realNode);
  }

  function handleToggleExpand(node: MaterialImportTreeNode): void {
    const realNode = treeHelpers.findNodeByPath(treeData, node.path) ?? node;
    treeData = treeHelpers.toggleExpand(treeData, realNode);
  }

  function handleNext(): void {
    const paths = treeHelpers.getSelectedPaths(treeData);
    if (paths.length > 0) {
      onNext(paths);
    }
  }

  $effect(() => {
    if (open) {
      initializeTree();
    }
  });

  $effect(() => {
    if (!open || !searchQuery.trim()) {
      return;
    }

    const result = treeHelpers.ensureFullTreeLoadedForSearch(treeData, searchQuery, searchFullTreeReady);
    treeData = result.tree;
    searchFullTreeReady = result.searchFullTreeReady;
  });
</script>

{#snippet TreeNodeComponent(node: MaterialImportTreeNode, depth: number)}
  <div class="tree-node" style="--depth: {depth}">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <svelte:element
      this={node.type === 'folder' ? 'button' : 'div'}
      class="node-row"
      class:selected={node.selected}
      class:indeterminate={node.indeterminate}
      type={node.type === 'folder' ? 'button' : undefined}
      tabindex={node.type === 'folder' ? undefined : -1}
      onclick={(e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('.checkbox-wrapper')) return;
        const realNode = treeHelpers.findNodeByPath(treeData, node.path) ?? node;
        if (realNode.type === 'folder') {
          handleToggleExpand(realNode);
        } else {
          handleToggleSelect(realNode);
        }
      }}
    >
      {#if node.type === 'folder' && node.hasChildren}
        <span class="expand-icon" class:expanded={node.expanded}>
          <ObsidianIcon name="chevron-right" size={14} />
        </span>
      {:else if node.type === 'folder'}
        <span class="expand-icon placeholder"></span>
      {/if}

      <label class="checkbox-wrapper">
        <input
          type="checkbox"
          checked={node.selected}
          indeterminate={node.indeterminate}
          onchange={() => handleToggleSelect(treeHelpers.findNodeByPath(treeData, node.path) ?? node)}
        />
        <span class="checkbox-box"></span>
      </label>

      <span class="node-icon">
        {#if node.type === 'folder'}
          <ObsidianIcon name={node.expanded ? 'folder-open' : 'folder'} size={16} />
        {:else}
          {@const ext = (node.path.split('.').pop() || '').toLowerCase()}
          <ObsidianIcon name={ext === 'epub' ? 'book-open' : ext === 'pdf' ? 'file' : 'file-text'} size={16} />
        {/if}
      </span>

      <span class="node-name" title={node.path}>{node.name}</span>

      {#if node.type === 'folder'}
        <span class="node-count">{node.fileCount ?? ''}</span>
      {/if}
    </svelte:element>

    {#if node.type === 'folder' && node.expanded && node.children.length > 0}
      <div class="node-children">
        {#each node.children as child (child.path)}
          {@render TreeNodeComponent(child, depth + 1)}
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

<div class="step-content">
  <div class="search-bar">
    <ObsidianIcon name="search" size={16} />
    <input
      type="text"
      placeholder={t('irImport.search.placeholder')}
      bind:value={searchQuery}
      class="search-input"
    />
    {#if searchQuery}
      <button class="clickable-icon btn-icon-sm" onclick={() => searchQuery = ''}>
        <ObsidianIcon name="x" size={14} />
      </button>
    {/if}
  </div>

  <div class="toolbar">
    <span class="info-text">
      {t('irImport.selection.selectedFiles', { count: selectedCount })}
    </span>
  </div>

  <div class="tree-container">
    {#if filteredTreeData.length === 0}
      <div class="empty-state">
        <ObsidianIcon name={searchQuery ? 'search-x' : 'file-question'} size={32} />
        <p class="empty-text">{searchQuery ? t('irImport.empty.noMatch') : t('irImport.empty.noFiles')}</p>
        <p class="empty-hint-text">{searchQuery ? t('irImport.empty.noMatchHint') : t('irImport.empty.noFilesHint')}</p>
      </div>
    {:else}
      {#each filteredTreeData as node (node.path)}
        {@render TreeNodeComponent(node, 0)}
      {/each}
    {/if}
  </div>
</div>

<footer class="modal-footer">
  {#if importing}
    <div class="progress-bar-container">
      <div class="progress-bar">
        <div
          class="progress-fill"
          style="width: {importProgress.total > 0 ? (importProgress.current / importProgress.total * 100) : 0}%"
        ></div>
      </div>
      <span class="progress-text">
        {#if isPdfImportMode}
          {t('irImport.progress.parsingPdfOutline')}
        {:else if isEpubImportMode}
          {t('irImport.progress.parsingEpubOutline')}
        {:else}
          {t('irImport.progress.importing', { current: importProgress.current, total: importProgress.total })}
        {/if}
      </span>
    </div>
  {:else}
    <button class="btn-primary" onclick={handleNext} disabled={selectedCount === 0}>
      {t('irImport.buttons.nextWithCount', { count: selectedCount })}
      <ObsidianIcon name="arrow-right" size={14} />
    </button>
  {/if}
</footer>
